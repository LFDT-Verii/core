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

const path = require('node:path');
const { afterEach, describe, it } = require('node:test');
const { loadTestEnv } = require('@verii/tests-helpers');
const { expect } = require('expect');
const createTestFastify = require('../helpers/create-test-fastify');

loadTestEnv(path.resolve(__dirname, '../helpers/.env.test'));

const {
  startNotificationWorker,
} = require('../../src/start-notification-worker');

const PROCESS_EVENTS = ['SIGINT', 'SIGTERM', 'message'];

describe('standalone notification worker', () => {
  let processListeners;
  let server;
  let worker;

  afterEach(async () => {
    if (worker != null) {
      await worker.stop();
      worker = undefined;
    }
    if (server != null) {
      await server.close();
      server = undefined;
    }
    restoreProcessListeners(processListeners);
    processListeners = undefined;
  });

  it('should start the worker with the credentialing hub server context', async () => {
    processListeners = snapshotProcessListeners();

    const started = await startNotificationWorker({
      createAppServer: () => createTestFastify(),
    });
    ({ server, worker } = started);

    expect(server.config.notifications.enabled).toEqual(false);
    expect(worker.workerId).toMatch(/^notification-worker-/);
    expect(process.listeners('SIGINT').length).toEqual(
      processListeners.SIGINT.length + 1,
    );
    expect(process.listeners('SIGTERM').length).toEqual(
      processListeners.SIGTERM.length + 1,
    );
    expect(process.listeners('message').length).toEqual(
      processListeners.message.length + 1,
    );
  });

  it('should stop the worker when the parent process sends a shutdown message', async () => {
    processListeners = snapshotProcessListeners();
    let serverClosed;

    const started = await startNotificationWorker({
      createAppServer: () => {
        const app = createTestFastify();
        serverClosed = new Promise((resolve) => {
          app.addHook('onClose', resolve);
        });
        return app;
      },
    });
    ({ server, worker } = started);

    process.emit('message', 'shutdown');
    await serverClosed;

    expect(process.listeners('message').length).toEqual(
      processListeners.message.length,
    );

    server = undefined;
    worker = undefined;
  });

  it('should close the server when startup fails after server creation', async () => {
    processListeners = snapshotProcessListeners();
    const startupError = new Error('startup failed');
    let serverClosed = false;

    await expect(
      startNotificationWorker({
        createAppServer: () => {
          const app = createTestFastify();
          app.addHook('onReady', async () => {
            throw startupError;
          });
          app.addHook('onClose', () => {
            serverClosed = true;
          });
          return app;
        },
      }),
    ).rejects.toThrow(startupError);

    expect(serverClosed).toEqual(true);
    expect(process.listeners('SIGINT').length).toEqual(
      processListeners.SIGINT.length,
    );
    expect(process.listeners('SIGTERM').length).toEqual(
      processListeners.SIGTERM.length,
    );
    expect(process.listeners('message').length).toEqual(
      processListeners.message.length,
    );
  });
});

const snapshotProcessListeners = () =>
  Object.fromEntries(
    PROCESS_EVENTS.map((eventName) => [
      eventName,
      process.listeners(eventName),
    ]),
  );

const restoreProcessListeners = (snapshot) => {
  if (snapshot == null) {
    return;
  }

  for (const eventName of PROCESS_EVENTS) {
    for (const listener of process.listeners(eventName)) {
      removeProcessListenerIfAdded(snapshot, eventName, listener);
    }
  }
};

const removeProcessListenerIfAdded = (snapshot, eventName, listener) => {
  if (snapshot[eventName].includes(listener)) {
    return;
  }

  process.removeListener(eventName, listener);
};
