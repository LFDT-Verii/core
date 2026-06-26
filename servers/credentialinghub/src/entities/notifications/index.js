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

const {
  buildCredentialIssuedEvent,
  buildCredentialRejectedEvent,
  buildPresentationReceivedEvent,
  newNotificationEventId,
} = require('./domain/build-notification-event');
const {
  matchesNotificationEventType,
  shouldEmitNotificationEvent,
} = require('./domain/event-type-matching');
const {
  DefaultNotificationEventTypes,
  NotificationEventTypes,
} = require('./domain/event-types');
const {
  DEFAULT_SIGNATURE_HEADER_NAME,
  buildWebhookSignatureHeaders,
} = require('./domain/hmac-headers');
const {
  NotificationWorkerModes,
  buildNotificationConfig,
  parseNotificationEventTypes,
} = require('./domain/notification-config');
const { NotificationQueueTypes } = require('./domain/notification-queue-types');
const { NotificationEventStatuses } = require('./domain/notification-statuses');
const {
  enqueueNotificationEvents,
} = require('./orchestrators/enqueue-notification-events');
const {
  notificationEnqueueAdapterPlugin,
} = require('./plugins/notification-enqueue-adapter-plugin');

module.exports = {
  DEFAULT_SIGNATURE_HEADER_NAME,
  DefaultNotificationEventTypes,
  NotificationEventStatuses,
  NotificationEventTypes,
  NotificationQueueTypes,
  NotificationWorkerModes,
  buildCredentialIssuedEvent,
  buildCredentialRejectedEvent,
  buildNotificationConfig,
  buildPresentationReceivedEvent,
  buildWebhookSignatureHeaders,
  enqueueNotificationEvents,
  matchesNotificationEventType,
  newNotificationEventId,
  notificationEnqueueAdapterPlugin,
  parseNotificationEventTypes,
  shouldEmitNotificationEvent,
};
