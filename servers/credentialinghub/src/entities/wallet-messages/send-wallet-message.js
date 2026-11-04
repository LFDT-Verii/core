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
const { default: canonicalize } = require('canonicalize');
const { isEmpty } = require('lodash/fp');
const { nanoid } = require('nanoid');
const { createCommitment, KeyPurposes } = require('@verii/crypto');
const { toDidUrl } = require('@verii/did-doc');
const {
  findWebhookUrlError,
} = require('../notifications/domain/notification-config');

const WalletMessageStatuses = {
  SENT: 'sent',
  SKIPPED_NO_MESSAGING_SETTINGS: 'skipped_no_messaging_settings',
  FAILED: 'failed',
};

/**
 * Posts a message to the wallet's push URL saved on the exchange. Never throws.
 * @param {{exchange: Object, data: Object, message?: string}} args the exchange holding the
 *   wallet's messaging settings, and the message's data and text
 * @param {Object} context the request context
 * @returns {Promise<{status: string, error?: string}>} the outcome
 */
const sendWalletMessage = async ({ exchange, data, message }, context) => {
  const messagingSettings = exchange?.messagingSettings;
  if (!hasMessagingSettings(messagingSettings)) {
    return { status: WalletMessageStatuses.SKIPPED_NO_MESSAGING_SETTINGS };
  }

  try {
    const pushUrl = parsePushUrl(messagingSettings.webhookUrl, context);
    const body = {
      id: nanoid(),
      pushToken: messagingSettings.authToken,
      message,
      data: { ...data, exchangeId: `${exchange._id}` },
    };
    const response = await context.fetch.post(pushUrl, body, {
      headers: {
        Authorization: await generateMessagingToken(body, pushUrl, context),
      },
    });
    // The body isn't needed. Destroying it closes the connection, whereas left unread it holds the
    // connection open, and draining it would wait on however slowly the wallet's server sends it.
    // Destroying an unfinished body emits an abort error, which needs a listener.
    response.rawBody?.on('error', ignoreError).destroy();
    validatePushResponse(response);
    return { status: WalletMessageStatuses.SENT };
  } catch (error) {
    context.log.warn(
      { err: error, notificationType: data.notificationType },
      'wallet message failed',
    );
    return { status: WalletMessageStatuses.FAILED, error: error.message };
  }
};

const ignoreError = () => {};

const hasMessagingSettings = (messagingSettings) =>
  !isEmpty(messagingSettings?.webhookUrl) &&
  !isEmpty(messagingSettings?.authToken);

// The HTTP client only throws for 4xx and 5xx and doesn't follow redirects, so a 3xx means
// the message wasn't delivered either.
const validatePushResponse = ({ statusCode }) => {
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`push url responded with ${statusCode}`);
  }
};

// Push URLs come from the wallet, so refuse ones that aren't https or that carry credentials.
// Returns the normalized href, because the HTTP client only accepts a lowercase scheme.
const parsePushUrl = (webhookUrl, { config }) => {
  const urlError = findWebhookUrlError(
    webhookUrl,
    config.walletMessagesAllowInsecureUrl,
  );
  if (urlError != null) {
    throw new Error(`push url ${urlError}`);
  }
  return new URL(webhookUrl).href;
};

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

module.exports = { sendWalletMessage, WalletMessageStatuses };
