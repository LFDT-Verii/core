/*
 * Copyright 2026 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
const canonicalize = require('canonicalize');
const ethUrlParser = require('eth-url-parser');
const newError = require('http-errors');
const { isEmpty, compact, castArray, find } = require('lodash/fp');
const { nanoid } = require('nanoid');
const { createCommitment, KeyPurposes } = require('@verii/crypto');
const { toDidUrl } = require('@verii/did-doc');
const { getRevocationRegistry } = require('@verii/verii-issuing');

const NotificationStatuses = {
  SENT: 'sent',
  SKIPPED_NO_MESSAGING_SETTINGS: 'skipped_no_messaging_settings',
  FAILED: 'failed',
  ALREADY_SENT: 'already_sent',
};

const revokeCredential = async (
  { credentialId, message, linkedCredential },
  context,
) => {
  const credential = await context.repos.credentials.findById(credentialId, {
    _id: 1,
    did: 1,
    credentialReference: 1,
    credentialSubjectId: 1,
    depotId: 1,
    content: 1,
    contentHash: 1,
    tags: 1,
    typeMetadata: 1,
    credentialStatus: 1,
    acceptedAt: 1,
    jwtVc: 1,
    rejectedAt: 1,
    rejectedReason: 1,
    revokedAt: 1,
    notifiedOfRevocationAt: 1,
    createdAt: 1,
    updatedAt: 1,
  });
  validateCredentialCanBeRevoked(credential, credentialId);

  const revokedCredential =
    credential.revokedAt == null
      ? await revokeActiveCredential(credential, context)
      : credential;

  const { credential: notifiedCredential, notification } =
    await sendRevocationMessage(
      revokedCredential,
      { message, linkedCredential },
      context,
    );

  return {
    credential: notifiedCredential,
    notification,
  };
};

const validateCredentialCanBeRevoked = (credential, credentialId) => {
  if (credential == null) {
    throw newError.NotFound(`Credential ${credentialId} not found`);
  }
  if (credential.did == null) {
    throw newError.BadRequest(`Credential ${credentialId} is not issued`);
  }
  if (isEmpty(resolveRevocationStatus(credential)?.id)) {
    throw newError.BadRequest(
      `Credential status not found for ${credentialId}`,
    );
  }
};

const resolveRevocationStatus = (credential) =>
  find(
    (status) => !isEmpty(status?.id),
    castArray(credential.credentialStatus),
  );

const revokeActiveCredential = async (credential, context) => {
  await setRevokedOnChain(resolveRevocationStatus(credential).id, context);
  return context.repos.credentials.update(credential._id, {
    revokedAt: new Date(),
  });
};

const setRevokedOnChain = async (credentialStatusUrl, context) => {
  const {
    tenant: { caoDid, keysByPurpose },
  } = context;
  const {
    parameters: { address, listId, index },
  } = ethUrlParser.parse(credentialStatusUrl);

  const dltKey = keysByPurpose[KeyPurposes.DLT_TRANSACTIONS];
  if (dltKey?._id == null) {
    throw newError.BadRequest('Revocation key not found');
  }

  const revocationRegistry = await getRevocationRegistry(
    { dltOperatorKMSKeyId: dltKey._id },
    context,
  );
  return revocationRegistry.setRevokedStatusSigned({
    accountId: address,
    listId,
    index,
    caoDid,
  });
};

const sendRevocationMessage = async (
  credential,
  { message, linkedCredential },
  context,
) => {
  if (credential.notifiedOfRevocationAt != null) {
    return {
      credential,
      notification: { status: NotificationStatuses.ALREADY_SENT },
    };
  }

  const exchange = await resolveCredentialExchange(credential, context);
  const { messagingSettings } = exchange ?? {};
  if (!hasMessagingSettings(messagingSettings)) {
    return {
      credential,
      notification: {
        status: NotificationStatuses.SKIPPED_NO_MESSAGING_SETTINGS,
      },
    };
  }

  const body = buildRevocationMessage(
    credential,
    { message, linkedCredential, messagingSettings, exchange },
    context,
  );
  try {
    await context.fetch.post(messagingSettings.webhookUrl, body, {
      headers: {
        Authorization: await generateMessagingToken(
          body,
          messagingSettings.webhookUrl,
          context,
        ),
      },
    });
    return {
      credential: await context.repos.credentials.update(credential._id, {
        notifiedOfRevocationAt: new Date(),
      }),
      notification: { status: NotificationStatuses.SENT },
    };
  } catch (error) {
    context.log.warn({ err: error }, 'revocation message failed');
    return {
      credential,
      notification: {
        status: NotificationStatuses.FAILED,
        error: error.message,
      },
    };
  }
};

const resolveCredentialExchange = (credential, { repos }) =>
  repos.exchanges.findLatestVnApiExchangeByDepotId(credential.depotId, {
    _id: 1,
    messagingSettings: 1,
  });

const hasMessagingSettings = (messagingSettings) =>
  !isEmpty(messagingSettings?.webhookUrl) &&
  !isEmpty(messagingSettings?.authToken);

const buildRevocationMessage = (
  credential,
  { message, linkedCredential, messagingSettings, exchange },
  { tenant },
) => ({
  id: nanoid(),
  pushToken: messagingSettings.authToken,
  message,
  data: {
    exchangeId: `${exchange._id}`,
    notificationType: resolveNotificationType(linkedCredential),
    replacementCredentialType:
      resolveReplacementCredentialType(linkedCredential),
    issuer: tenant.did,
    credentialId: credential.did,
    credentialTypes: resolveCredentialTypes(credential),
    count: 1,
  },
});

const resolveNotificationType = (linkedCredential) =>
  linkedCredential == null ? 'CredentialRevoked' : 'CredentialReplaced';

const resolveReplacementCredentialType = (linkedCredential) =>
  linkedCredential?.credentialType;

const resolveCredentialTypes = (credential) =>
  !isEmpty(credential.content?.type)
    ? credential.content.type
    : compact([
        'VerifiableCredential',
        credential.typeMetadata?.credentialType,
      ]);

const generateMessagingToken = async (body, webhookUrl, context) => {
  const {
    kms,
    tenant,
    traceId,
    tenant: { keysByPurpose },
  } = context;
  const exchangesKey = keysByPurpose[KeyPurposes.EXCHANGES];
  const hash = createCommitment(canonicalize(body));
  const jwt = await kms.signJwt({ hash }, exchangesKey._id, {
    subject: body.data.exchangeId,
    audience: new URL(webhookUrl).origin,
    jti: traceId,
    issuer: tenant.did,
    kid: toDidUrl(tenant.did, exchangesKey.kidFragment),
    nbf: new Date(),
    expiresIn: '1w',
  });
  return `Bearer ${jwt}`;
};

module.exports = { revokeCredential, NotificationStatuses };
