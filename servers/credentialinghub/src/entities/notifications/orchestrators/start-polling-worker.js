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
const { wait } = require('@verii/common-functions');

// Calls processNext until it reports nothing to do, then waits pollIntervalMs
// before trying again, until stopped. The webhook delivery and anchoring
// workers both run on it.
const startPollingWorker = (
  { name, pollIntervalMs, processNext, workerId },
  context,
) => {
  const { log } = context;
  const state = { running: true };

  log.info({ workerId }, `${name} started`);
  const completion = poll(
    { name, pollIntervalMs, processNext, state, workerId },
    context,
  ).then(() => log.info({ workerId }, `${name} stopped`));

  return {
    stop: async () => {
      // eslint-disable-next-line better-mutation/no-mutation
      state.running = false;
      await completion;
    },
    workerId,
  };
};

const poll = async ({ state, ...options }, context) => {
  while (state.running) {
    // Processing one item at a time is intentional for the MVP.
    // eslint-disable-next-line no-await-in-loop
    await processOrWait(options, context);
  }
};

const processOrWait = async (
  { name, pollIntervalMs, processNext, workerId },
  context,
) => {
  try {
    if (await processNext({ workerId }, context)) {
      return;
    }
  } catch (error) {
    context.log.error({ err: error, workerId }, `${name} error`);
  }

  await wait(pollIntervalMs);
};

module.exports = { startPollingWorker };
