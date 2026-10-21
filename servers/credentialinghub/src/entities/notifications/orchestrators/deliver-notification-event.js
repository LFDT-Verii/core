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

const { pick } = require('lodash/fp');
const {
  buildWebhookSignatureHeaders,
  findWebhookUrlError,
} = require('../domain');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOCK_DURATION_MS = 30000;
const MAX_ERROR_BODY_LENGTH = 500;
const OVERSIZED_ERROR_BODY_MESSAGE = `[omitted: response body exceeds ${MAX_ERROR_BODY_LENGTH} bytes]`;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429]);

const deliverNextNotificationEvent = async ({ workerId }, context) => {
  const { config, repos } = context;
  const now = new Date();

  if (!areNotificationsEnabled(config)) {
    return false;
  }

  const event = await repos.notification_events.claimDueEvent({
    now,
    workerId,
    lockDurationMs: getLockDurationMs(config),
  });

  if (event == null) {
    return false;
  }

  await deliverClaimedNotificationEvent(event, now, context);
  return true;
};

const areNotificationsEnabled = (config) =>
  config.notifications?.enabled === true;

const getLockDurationMs = (config) =>
  config.notifications.worker?.lockDurationMs ?? DEFAULT_LOCK_DURATION_MS;

const deliverClaimedNotificationEvent = async (event, now, context) => {
  const { config, log, repos } = context;

  try {
    const destination = await resolveEventDestination(event, context);
    const destinationError = findDestinationError(destination, config);

    if (destinationError != null) {
      await markDeadDelivery(event, destinationError, now, context);
      return;
    }

    const response = await postWebhook(event, destination, context);

    if (isSuccessResponse(response)) {
      await repos.notification_events.markDelivered(
        buildDeliveredUpdate(event, config, now),
      );
      return;
    }

    const error = await buildHttpDeliveryError(response);
    await markFailedDelivery(event, error, now, context);
  } catch (error) {
    log?.warn?.({ err: error, eventId: event._id }, 'Webhook delivery failed');
    await markFailedDelivery(event, error, now, context);
  }
};

const resolveEventDestination = (
  event,
  { config, db, resolveDestination = resolveHubWebhookDestination },
) => resolveDestination(event, { config, db });

const resolveHubWebhookDestination = (event, { config }) =>
  pick(['url', 'secret', 'signatureHeaderName'], config.notifications.webhook);

// Like a 4xx response, a missing or invalid destination is permanent, so the
// event is marked dead without a retry.
const findDestinationError = (destination, config) => {
  if (destination == null) {
    return { message: 'no_destination' };
  }

  if (typeof destination.secret !== 'string' || destination.secret === '') {
    return {
      message: 'invalid_destination: secret must be a non-empty string',
    };
  }

  const urlError = findWebhookUrlError(
    destination.url,
    config.notifications.webhook.allowInsecureUrl,
  );
  return urlError && { message: `invalid_destination: url ${urlError}` };
};

const postWebhook = async (event, destination, { fetch }) => {
  const rawBody = JSON.stringify(event.payload);

  return fetch.post(destination.url, rawBody, {
    headers: buildWebhookSignatureHeaders({
      event: event.payload,
      rawBody,
      secret: destination.secret,
      signatureHeaderName: destination.signatureHeaderName,
    }),
  });
};

const isSuccessResponse = (response) =>
  response.statusCode >= 200 && response.statusCode < 300;

const buildHttpDeliveryError = async (response) => ({
  message: `Webhook delivery failed with status ${response.statusCode}`,
  responseBody: await readResponseExcerpt(response),
  statusCode: response.statusCode,
});

const readResponseExcerpt = async (response) => {
  if (isResponseBodyTooLarge(response)) {
    await response.rawBody?.dump({ limit: MAX_ERROR_BODY_LENGTH });
    return OVERSIZED_ERROR_BODY_MESSAGE;
  }

  return readRawBodyExcerpt(response.rawBody);
};

const readRawBodyExcerpt = async (rawBody) => {
  if (rawBody == null) {
    return '';
  }

  const chunks = [];
  let bodyLength = 0;

  for await (const chunk of rawBody) {
    const bodyChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

    bodyLength += bodyChunk.length;

    if (bodyLength > MAX_ERROR_BODY_LENGTH) {
      await rawBody.dump({ limit: MAX_ERROR_BODY_LENGTH });
      return OVERSIZED_ERROR_BODY_MESSAGE;
    }

    chunks.push(bodyChunk);
  }

  return Buffer.concat(chunks, bodyLength).toString();
};

const isResponseBodyTooLarge = (response) => {
  const contentLength = parseContentLength(response.resHeaders);
  return contentLength != null && contentLength > MAX_ERROR_BODY_LENGTH;
};

const parseContentLength = (headers = {}) => {
  const headerValue = headers['content-length'] ?? headers['Content-Length'];
  const normalizedValue = Array.isArray(headerValue)
    ? headerValue[0]
    : headerValue;
  const contentLength = Number(normalizedValue);
  return Number.isFinite(contentLength) ? contentLength : undefined;
};

const markFailedDelivery = async (event, error, now, context) => {
  const { config, repos } = context;

  if (shouldRetryDelivery(error, event, config)) {
    await repos.notification_events.markRetrying({
      ...buildFailedUpdate(event, error, now),
      nextAttemptAt: nextAttemptAt(now, event.attempts),
    });
    return;
  }

  await markDeadDelivery(event, error, now, context);
};

const markDeadDelivery = (event, error, now, { config, repos }) =>
  repos.notification_events.markDead({
    ...buildFailedUpdate(event, error, now),
    retentionExpiresAt: retentionExpiresAt(config, now),
  });

const buildFailedUpdate = (event, error, now) => ({
  eventId: event._id,
  lastError: normalizeDeliveryError(error),
  lockedBy: event.lockedBy,
  now,
});

const shouldRetryDelivery = (error, event, config) =>
  event.attempts < config.notifications.webhook.maxAttempts &&
  (error.statusCode == null ||
    error.statusCode >= 500 ||
    RETRYABLE_STATUS_CODES.has(error.statusCode));

const normalizeDeliveryError = (error) => ({
  message: error.message,
  responseBody: error.responseBody,
  statusCode: error.statusCode,
});

const buildDeliveredUpdate = (event, config, now) => ({
  eventId: event._id,
  lockedBy: event.lockedBy,
  now,
  retentionExpiresAt: retentionExpiresAt(config, now),
});

const retentionExpiresAt = (config, now) =>
  new Date(now.getTime() + config.notifications.retentionDays * DAY_MS);

const nextAttemptAt = (now, attempts) =>
  new Date(now.getTime() + Math.min(60000, 1000 * 2 ** (attempts - 1)));

module.exports = {
  deliverClaimedNotificationEvent,
  deliverNextNotificationEvent,
};
