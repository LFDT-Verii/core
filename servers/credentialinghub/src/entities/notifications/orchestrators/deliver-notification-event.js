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

const { buildWebhookSignatureHeaders } = require('../domain');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOCK_DURATION_MS = 30000;
const MAX_ERROR_BODY_LENGTH = 500;
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
    const response = await postWebhook(event, context);

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

const postWebhook = async (event, context) => {
  const { config, fetch } = context;
  const rawBody = JSON.stringify(event.payload);

  return fetch.post(config.notifications.webhook.url, rawBody, {
    headers: buildWebhookSignatureHeaders({
      event: event.payload,
      rawBody,
      secret: config.notifications.webhook.secret,
      signatureHeaderName: config.notifications.webhook.signatureHeaderName,
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
  const body = await response.text();
  return body.slice(0, MAX_ERROR_BODY_LENGTH);
};

const markFailedDelivery = async (event, error, now, context) => {
  const { config, repos } = context;
  const failedUpdate = {
    eventId: event._id,
    lastError: normalizeDeliveryError(error),
    lockedBy: event.lockedBy,
    now,
  };

  if (shouldRetryDelivery(error, event, config)) {
    await repos.notification_events.markRetrying({
      ...failedUpdate,
      nextAttemptAt: nextAttemptAt(now, event.attempts),
    });
    return;
  }

  await repos.notification_events.markDead({
    ...failedUpdate,
    retentionExpiresAt: retentionExpiresAt(config, now),
  });
};

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
