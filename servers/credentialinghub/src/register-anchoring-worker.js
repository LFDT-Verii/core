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
  buildAnchoringWorkerContext,
  startAnchoringWorker,
} = require('./entities/anchoring');

// Anchoring needs the app server's KMS, RPC provider and blockchain
// authentication, so the worker runs in the app server's process. Each app
// server runs one; they share the queue through each job's lock.
const registerAnchoringWorker = (server) => {
  if (!server.config.anchoring.workerEnabled) {
    return;
  }

  let worker;
  server.addHook('onReady', async () => {
    worker = startAnchoringWorker({}, buildAnchoringWorkerContext(server));
  });
  // Stop before the server closes MongoDB, so a job in progress can finish.
  server.addHook('preClose', async () => worker?.stop());
};

module.exports = { registerAnchoringWorker };
