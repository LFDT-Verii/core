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
const { anchorNextCredential } = require('./anchor-next-credential');

const startAnchoringWorker = (options, workerContext) => {
  const { workerId = `anchoring-worker-${process.pid}-${nanoid(6)}` } =
    options ?? {};
  const { config, log } = workerContext;
  const state = { running: true };

  log.info({ workerId }, 'Anchoring worker started');
  const completion = pollAnchoring(
    { pollIntervalMs: config.anchoring.pollIntervalMs, state, workerId },
    workerContext,
  ).then(() => log.info({ workerId }, 'Anchoring worker stopped'));

  return {
    stop: async () => {
      // eslint-disable-next-line better-mutation/no-mutation
      state.running = false;
      await completion;
    },
    workerId,
  };
};

const pollAnchoring = async ({ pollIntervalMs, state, workerId }, context) => {
  while (state.running) {
    // One job at a time, like the notification delivery worker.
    // eslint-disable-next-line no-await-in-loop
    await anchorOrWait({ pollIntervalMs, workerId }, context);
  }
};

const anchorOrWait = async ({ pollIntervalMs, workerId }, context) => {
  try {
    if (await anchorNextCredential({ workerId }, context)) {
      return;
    }
  } catch (error) {
    context.log.error({ err: error, workerId }, 'Anchoring worker error');
  }

  await wait(pollIntervalMs);
};

module.exports = { startAnchoringWorker };
