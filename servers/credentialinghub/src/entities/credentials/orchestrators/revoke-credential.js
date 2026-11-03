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
const ethUrlParser = require('eth-url-parser');
const newError = require('http-errors');
const { isEmpty, compact, castArray, find } = require('lodash/fp');
const { KeyPurposes } = require('@verii/crypto');
const { getRevocationRegistry } = require('@verii/verii-issuing');
const {
  sendWalletMessage,
  WalletMessageStatuses,
} = require('../../wallet-messages');

const NotificationStatuses = {
  ...WalletMessageStatuses,
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
    dataModelVersion: 1,
    acceptedAt: 1,
    jwtVc: 1,
    envelopeFormat: 1,
    rejectedAt: 1,
    rejectedReason: 1,
    signingAlgorithm: 1,
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
  const notification = await sendWalletMessage(
    {
      exchange,
      message,
      data: buildRevocationMessageData(credential, linkedCredential, context),
    },
    context,
  );
  if (notification.status !== NotificationStatuses.SENT) {
    return { credential, notification };
  }

  return markNotifiedOfRevocation(credential, notification, context);
};

// The credential is already revoked, so a failed write reports the message as
// failed instead of failing the request.
const markNotifiedOfRevocation = async (credential, notification, context) => {
  try {
    return {
      credential: await context.repos.credentials.update(credential._id, {
        notifiedOfRevocationAt: new Date(),
      }),
      notification,
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

// The latest VN API exchange carries the current wallet messaging settings,
// which may differ from the credential's issuance-time exchange.
const resolveCredentialExchange = (credential, { repos }) =>
  repos.exchanges.findLatestVnApiExchangeByDepotId(credential.depotId, {
    _id: 1,
    messagingSettings: 1,
  });

const buildRevocationMessageData = (
  credential,
  linkedCredential,
  { tenant },
) => ({
  notificationType: resolveNotificationType(linkedCredential),
  replacementCredentialType: resolveReplacementCredentialType(linkedCredential),
  issuer: tenant.did,
  credentialId: credential.did,
  credentialTypes: resolveCredentialTypes(credential),
  dataModelVersion: credential.dataModelVersion,
  envelopeFormat: credential.envelopeFormat,
  signingAlgorithm: credential.signingAlgorithm,
  count: 1,
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

module.exports = { revokeCredential, NotificationStatuses };
