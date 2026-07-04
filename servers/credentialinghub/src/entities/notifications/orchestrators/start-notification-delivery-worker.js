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
  isNotificationDeliveryEnabled,
} = require('./deliver-notification-event');

const DEFAULT_POLL_INTERVAL_MS = 500;

const startNotificationDeliveryWorker = ({
  config,
  httpClient,
  log,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  repos,
  workerId = newNotificationWorkerId(),
}) => {
  if (!isNotificationDeliveryEnabled(config)) {
    return buildStoppedWorker(workerId);
  }

  const state = {
    running: true,
  };
  const completion = runNotificationDeliveryLoop({
    config,
    httpClient,
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

const buildStoppedWorker = (workerId) => {
  return {
    stop: stopAlreadyStoppedWorker,
    workerId,
  };
};

const stopAlreadyStoppedWorker = async () => {
  return undefined;
};

const runNotificationDeliveryLoop = async ({
  config,
  httpClient,
  log,
  pollIntervalMs,
  repos,
  state,
  workerId,
}) => {
  log.info({ workerId }, 'Notification delivery worker started');

  await pollNotificationDelivery({
    config,
    httpClient,
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
  httpClient,
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
    httpClient,
    log,
    pollIntervalMs,
    repos,
    workerId,
  });
  await pollNotificationDelivery({
    config,
    httpClient,
    log,
    pollIntervalMs,
    repos,
    state,
    workerId,
  });
};

const deliverOrWait = async ({
  config,
  httpClient,
  log,
  pollIntervalMs,
  repos,
  workerId,
}) => {
  try {
    const deliveredEvent = await deliverNextNotificationEvent({
      config,
      httpClient,
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

const newNotificationWorkerId = () => {
  return `notification-worker-${process.pid}-${nanoid(6)}`;
};

module.exports = {
  startNotificationDeliveryWorker,
};
