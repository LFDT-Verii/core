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
const { nanoid } = require('nanoid');
const {
  deliverNextNotificationEvent,
} = require('./deliver-notification-event');
const { startPollingWorker } = require('./start-polling-worker');

const DEFAULT_POLL_INTERVAL_MS = 500;

const startNotificationDeliveryWorker = (options, context) => {
  const {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    workerId = newNotificationWorkerId(),
  } = options ?? {};

  if (context.config.notifications?.enabled !== true) {
    return { stop: async () => undefined, workerId };
  }

  return startPollingWorker(
    {
      name: 'Notification delivery worker',
      pollIntervalMs,
      processNext: deliverNextNotificationEvent,
      workerId,
    },
    context,
  );
};

const newNotificationWorkerId = () =>
  `notification-worker-${process.pid}-${nanoid(6)}`;

module.exports = {
  startNotificationDeliveryWorker,
};
