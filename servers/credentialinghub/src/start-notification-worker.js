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
const { initHttpClient } = require('@verii/http-client');
const { createServer } = require('@verii/server-provider');
const { flow } = require('lodash/fp');
const config = require('./config');
const { initServer } = require('./init-server');
const { startNotificationDeliveryWorker } = require('./entities/notifications');

const createNotificationWorkerServer = () =>
  flow(createServer, initServer)(config);

const startNotificationWorker = async ({
  createAppServer = createNotificationWorkerServer,
} = {}) => {
  const server = await createAppServer();
  try {
    await server.ready();

    const worker = startNotificationDeliveryWorker(
      {},
      {
        config: server.config,
        fetch: buildNotificationDeliveryFetch(server.config, server.log),
        log: server.log,
        repos: bindRepo(server),
      },
    );

    let shutdownPromise;
    const shutdown = () => {
      if (shutdownPromise == null) {
        // eslint-disable-next-line better-mutation/no-mutation
        shutdownPromise = stopNotificationWorker({ server, worker });
      }

      return shutdownPromise;
    };
    const shutdownOrExit = () => {
      /* node:coverage ignore next */
      shutdown().catch((error) => {
        console.error(error);
        process.exit(1);
      });
    };

    process.once('SIGINT', shutdownOrExit);
    process.once('SIGTERM', shutdownOrExit);
    const shutdownOnMessage = (message) => {
      if (message === 'shutdown') {
        process.off('message', shutdownOnMessage);
        shutdownOrExit();
      }
    };

    process.on('message', shutdownOnMessage);

    return { server, worker };
  } catch (error) {
    await server.close();
    throw error;
  }
};

const buildNotificationDeliveryFetch = (serverConfig, log) =>
  initHttpClient({
    isTest: serverConfig.isTest,
    requestTimeout: serverConfig.notifications.webhook.timeoutMs,
    responseErrorMode: 'return',
    traceIdHeader: serverConfig.traceIdHeader,
    tlsRejectUnauthorized: serverConfig.tlsRejectUnauthorized,
  })({
    log,
  });

const stopNotificationWorker = async ({ server, worker }) => {
  try {
    await worker.stop();
  } finally {
    await server.close();
  }
};

/* node:coverage ignore next */
/* istanbul ignore next */
const startNotificationWorkerCli = () => {
  startNotificationWorker().catch((error) => {
    console.error(error);
    process.exit(1);
  });
};

/* node:coverage ignore next */
/* istanbul ignore next */
if (require.main === module) {
  startNotificationWorkerCli();
}

module.exports = {
  buildNotificationDeliveryFetch,
  createNotificationWorkerServer,
  startNotificationWorker,
  startNotificationWorkerCli,
};
