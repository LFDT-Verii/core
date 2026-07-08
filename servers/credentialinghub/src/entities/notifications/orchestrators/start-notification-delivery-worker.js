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

const startNotificationDeliveryWorker = (options, context) => {
  const {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    workerId = newNotificationWorkerId(),
  } = options ?? {};
  const { config } = context;

  if (!isNotificationDeliveryEnabled(config)) {
    return buildStoppedWorker(workerId);
  }

  const state = {
    running: true,
  };
  const completion = runNotificationDeliveryLoop(
    {
      pollIntervalMs,
      state,
      workerId,
    },
    context,
  );

  return {
    stop: async () => {
      // eslint-disable-next-line better-mutation/no-mutation
      state.running = false;
      await completion;
    },
    workerId,
  };
};

const isNotificationDeliveryEnabled = (config) =>
  config.notifications?.enabled === true;

const buildStoppedWorker = (workerId) => ({
  stop: async () => undefined,
  workerId,
});

const runNotificationDeliveryLoop = async (
  { pollIntervalMs, state, workerId },
  context,
) => {
  const { log } = context;

  log.info({ workerId }, 'Notification delivery worker started');

  await pollNotificationDelivery(
    {
      pollIntervalMs,
      state,
      workerId,
    },
    context,
  );

  log.info({ workerId }, 'Notification delivery worker stopped');
};

const pollNotificationDelivery = async (
  { pollIntervalMs, state, workerId },
  context,
) => {
  if (!state.running) {
    return;
  }

  await deliverOrWait(
    {
      pollIntervalMs,
      workerId,
    },
    context,
  );
  await pollNotificationDelivery(
    {
      pollIntervalMs,
      state,
      workerId,
    },
    context,
  );
};

const deliverOrWait = async ({ pollIntervalMs, workerId }, context) => {
  const { log } = context;

  try {
    const deliveredEvent = await deliverNextNotificationEvent(
      { workerId },
      context,
    );

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
