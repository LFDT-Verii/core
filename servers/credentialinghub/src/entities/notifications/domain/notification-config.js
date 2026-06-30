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
  maxConcurrency: 4,
  allowInsecureWebhookUrl: false,
};

const buildNotificationConfig = (options = {}) => {
  const normalizedOptions = normalizeNotificationConfigOptions(options);

  validateNotificationConfigOptions(normalizedOptions);

  const eventTypes = parseNotificationEventTypes(
    normalizedOptions.webhookEventTypes,
  );
  const config = buildStaticNotificationConfig(normalizedOptions, eventTypes);

  if (normalizedOptions.enabled) {
    validateEnabledWebhookConfig(normalizedOptions);
  }

  return config;
};

const normalizeNotificationConfigOptions = (options) => ({
  ...DEFAULT_NOTIFICATION_CONFIG_OPTIONS,
  ...options,
});

const validateNotificationConfigOptions = ({ workerMode, queueType }) => {
  validateWorkerMode(workerMode);
  validateQueueType(queueType);
};

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
    maxConcurrency,
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
    maxConcurrency,
  },
});

const validateEnabledWebhookConfig = ({
  webhookUrl,
  webhookSecret,
  allowInsecureWebhookUrl,
}) => {
  validateWebhookUrl(webhookUrl, { allowInsecureWebhookUrl });
  validateRequiredString(webhookSecret, 'NOTIFICATIONS_WEBHOOK_SECRET');
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

const validateWorkerMode = (workerMode) => {
  if (Object.values(NotificationWorkerModes).includes(workerMode)) {
    return;
  }

  throw new Error(`Invalid notifications worker mode: ${workerMode}`);
};

const validateQueueType = (queueType) => {
  if (Object.values(NotificationQueueTypes).includes(queueType)) {
    return;
  }

  throw new Error(`Invalid notifications queue type: ${queueType}`);
};

const validateWebhookUrl = (webhookUrl, { allowInsecureWebhookUrl }) => {
  validateRequiredString(webhookUrl, 'NOTIFICATIONS_WEBHOOK_URL');
  const parsedUrl = parseWebhookUrl(webhookUrl);

  validateWebhookUrlHost(parsedUrl);
  validateWebhookUrlCredentials(parsedUrl);
  validateWebhookUrlProtocol(parsedUrl, { allowInsecureWebhookUrl });
};

const parseWebhookUrl = (webhookUrl) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch (error) {
    throw new Error(`Invalid notifications webhook URL: ${webhookUrl}`, {
      cause: error,
    });
  }

  return parsedUrl;
};

const validateWebhookUrlHost = (parsedUrl) => {
  if (!parsedUrl.hostname) {
    throw new Error('Notifications webhook URL must include a host');
  }
};

const validateWebhookUrlCredentials = (parsedUrl) => {
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('Notifications webhook URL must not include credentials');
  }
};

const validateWebhookUrlProtocol = (parsedUrl, { allowInsecureWebhookUrl }) => {
  if (parsedUrl.protocol !== 'https:' && !allowInsecureWebhookUrl) {
    throw new Error('Notifications webhook URL must use https');
  }
};

const validateRequiredString = (value, envVarName) => {
  if (typeof value === 'string' && value.trim()) {
    return;
  }

  throw new Error(`${envVarName} is required when notifications are enabled`);
};

module.exports = {
  NotificationWorkerModes,
  buildNotificationConfig,
  parseNotificationEventTypes,
};
