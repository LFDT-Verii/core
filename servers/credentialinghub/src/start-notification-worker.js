/**
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
 */

const { bindRepo } = require('@spencejs/spence-mongo-repos');
const { createServer } = require('@verii/server-provider');
const { flow } = require('lodash/fp');
const config = require('./config');
const { initServer } = require('./init-server');
const { startNotificationDeliveryWorker } = require('./entities/notifications');

const startNotificationWorker = async () => {
  const server = flow(createServer, initServer)(config);
  await server.ready();

  const worker = startNotificationDeliveryWorker({
    config: server.config,
    log: server.log,
    repos: bindRepo(server),
  });

  const shutdown = async () => {
    await worker.stop();
    await server.close();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.once('message', (message) => {
    if (message === 'shutdown') {
      shutdown();
    }
  });

  return { server, worker };
};

module.exports = {
  startNotificationWorker,
};
