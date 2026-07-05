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
const { wait } = require('@verii/common-functions');
const {
  deliverNextNotificationEvent,
} = require('./deliver-notification-event');

const DEFAULT_POLL_INTERVAL_MS = 500;

const startNotificationDeliveryWorker = ({
  config,
  fetch,
  log,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  repos,
  workerId = newNotificationWorkerId(),
}) => {
  const state = {
    running: true,
  };
  const completion = runNotificationDeliveryLoop({
    config,
    fetch,
    log,
    pollIntervalMs,
    repos,
    state,
    workerId,
  });

  return {
    stop: async () => {
      // eslint-disable-next-line better-mutation/no-mutation
      state.running = false;
      await completion;
    },
    workerId,
  };
};

const runNotificationDeliveryLoop = async ({
  config,
  fetch,
  log,
  pollIntervalMs,
  repos,
  state,
  workerId,
}) => {
  log.info({ workerId }, 'Notification delivery worker started');

  await pollNotificationDelivery({
    config,
    fetch,
    log,
    pollIntervalMs,
    repos,
    state,
    workerId,
  });

  log.info({ workerId }, 'Notification delivery worker stopped');
};

const pollNotificationDelivery = async ({
  config,
  fetch,
  log,
  pollIntervalMs,
  repos,
  state,
  workerId,
}) => {
  if (!state.running) {
    return;
  }

  await deliverOrWait({
    config,
    fetch,
    log,
    pollIntervalMs,
    repos,
    workerId,
  });
  await pollNotificationDelivery({
    config,
    fetch,
    log,
    pollIntervalMs,
    repos,
    state,
    workerId,
  });
};

const deliverOrWait = async ({
  config,
  fetch,
  log,
  pollIntervalMs,
  repos,
  workerId,
}) => {
  try {
    const deliveredEvent = await deliverNextNotificationEvent({
      config,
      fetch,
      log,
      repos,
      workerId,
    });

    if (deliveredEvent) {
      return;
    }
  } catch (error) {
    log.error({ err: error, workerId }, 'Notification delivery worker error');
  }

  await wait(pollIntervalMs);
};

const newNotificationWorkerId = () =>
  `notification-worker-${process.pid}-${nanoid(6)}`;

module.exports = {
  startNotificationDeliveryWorker,
};
