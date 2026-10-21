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

const { DefaultNotificationEventTypes } = require('./event-types');
const { DEFAULT_SIGNATURE_HEADER_NAME } = require('./hmac-headers');
const { NotificationQueueTypes } = require('./notification-queue-types');

const NotificationWorkerModes = {
  EMBEDDED_CHILD: 'embedded-child',
  STANDALONE: 'standalone',
  DISABLED: 'disabled',
};

const DEFAULT_NOTIFICATION_CONFIG_OPTIONS = {
  enabled: false,
  queueType: NotificationQueueTypes.MONGO,
  workerMode: NotificationWorkerModes.EMBEDDED_CHILD,
  retentionDays: 30,
  webhookEventTypes: DefaultNotificationEventTypes,
  signatureHeaderName: DEFAULT_SIGNATURE_HEADER_NAME,
  webhookTimeoutMs: 5000,
  maxAttempts: 12,
  allowInsecureWebhookUrl: false,
};

const buildNotificationConfig = (options = {}) => {
  const normalizedOptions = normalizeNotificationConfigOptions(options);

  const eventTypes = parseNotificationEventTypes(
    normalizedOptions.webhookEventTypes,
  );
  return buildStaticNotificationConfig(normalizedOptions, eventTypes);
};

const normalizeNotificationConfigOptions = (options) => ({
  ...DEFAULT_NOTIFICATION_CONFIG_OPTIONS,
  ...options,
});

const buildStaticNotificationConfig = (
  {
    enabled,
    queueType,
    workerMode,
    retentionDays,
    webhookUrl,
    webhookSecret,
    signatureHeaderName,
    webhookTimeoutMs,
    maxAttempts,
    allowInsecureWebhookUrl,
  },
  eventTypes,
) => ({
  enabled,
  queue: {
    type: queueType,
  },
  workerMode,
  retentionDays,
  webhook: {
    url: webhookUrl,
    eventTypes,
    secret: webhookSecret,
    signatureHeaderName,
    timeoutMs: webhookTimeoutMs,
    maxAttempts,
    allowInsecureUrl: allowInsecureWebhookUrl,
  },
});

// Checks the Hub-wide webhook URL and the URLs a destination resolver returns.
const findWebhookUrlError = (webhookUrl, allowInsecureWebhookUrl) => {
  const parsedUrl = URL.parse(webhookUrl);
  if (parsedUrl == null) {
    return 'must be a valid URL';
  }

  if (parsedUrl.username || parsedUrl.password) {
    return 'must not include credentials';
  }

  if (parsedUrl.protocol !== 'https:' && !allowInsecureWebhookUrl) {
    return 'must use https';
  }

  return undefined;
};

const parseNotificationEventTypes = (eventTypes) => {
  if (Array.isArray(eventTypes)) {
    return eventTypes.map((eventType) => eventType.trim()).filter(Boolean);
  }

  if (eventTypes == null) {
    return [];
  }

  return eventTypes
    .split(',')
    .map((eventType) => eventType.trim())
    .filter(Boolean);
};

module.exports = {
  NotificationWorkerModes,
  buildNotificationConfig,
  findWebhookUrlError,
  parseNotificationEventTypes,
};
