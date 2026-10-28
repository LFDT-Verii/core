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

const crypto = require('node:crypto');
const { once } = require('node:events');
const http = require('node:http');
const path = require('node:path');
const { text } = require('node:stream/consumers');
const { after, afterEach, before, describe, it, mock } = require('node:test');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { buildMongoConnection, loadTestEnv } = require('@verii/tests-helpers');
const { expect } = require('expect');
const Fastify = require('fastify');
const { MongoClient } = require('mongodb');

const PROCESS_EVENTS = ['SIGINT', 'SIGTERM', 'message'];
const WORKER_MODULE_PATH = path.join(
  __dirname,
  '../helpers/notification-worker-module.js',
);

loadTestEnv(path.resolve(__dirname, '../helpers/.env.test'));
// The worker builds its config from the environment, as in production. The
// environment has none of the built-in CAO security provider's variables.
delete process.env.OPERATOR_API_TOKEN;
delete process.env.DEFAULT_CAO_DID;
delete process.env.VNF_OAUTH_CLIENT_ID;
delete process.env.VNF_OAUTH_CLIENT_SECRET;
Object.assign(process.env, {
  LOG_SEVERITY: 'silent',
  MONGO_URI: buildMongoConnection('test-credentialing-hub-notification-worker'),
  NOTIFICATIONS_ALLOW_INSECURE_WEBHOOK_URL: 'true',
  NOTIFICATIONS_ENABLED: 'true',
  NOTIFICATIONS_WEBHOOK_SECRET: 'hub-secret',
  NOTIFICATIONS_WEBHOOK_URL: 'https://hub.localhost.test/notifications',
});

const { startNotificationWorker } = require('../../src');
const {
  NotificationWorkerModes,
  buildNotificationConfig,
  newNotificationEventId,
} = require('../../src/entities/notifications');
const {
  buildNotificationEventDocument,
} = require('../../src/entities/notifications/repo/notification-events-repo-extension');
const {
  startEmbeddedNotificationWorker,
} = require('../../src/start-embedded-notification-worker');

describe('standalone notification worker', () => {
  let event;
  let processListeners;
  let receiver;
  let server;
  let worker;

  before(async () => {
    event = buildTestEvent();
    receiver = await startWebhookReceiver(event.id);
    process.env.NOTIFICATIONS_WEBHOOK_URL = receiver.url;
  });

  after(() => receiver.close());

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

  it('should start without the CAO security provider variables and deliver to the Hub-wide webhook', async () => {
    processListeners = snapshotProcessListeners();

    ({ server, worker } = await startNotificationWorker());
    await mongoDb()
      .collection('notification_events')
      .insertOne(buildNotificationEventDocument(event));
    const delivery = await receiver.received;

    expect(JSON.parse(delivery.rawBody)).toEqual(event);
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

    ({ server, worker } = await startNotificationWorker());
    const close = server.close.bind(server);
    const serverClosed = new Promise((resolve) => {
      mock.method(server, 'close', () => close().then(resolve));
    });

    process.emit('message', 'shutdown');
    await serverClosed;

    expect(process.listeners('message').length).toEqual(
      processListeners.message.length,
    );

    server = undefined;
    worker = undefined;
  });
});

describe('embedded notification worker module', () => {
  it(
    'should fork the configured module, whose resolver chooses the destination',
    { timeout: 20000 },
    async (t) => {
      const event = buildTestEvent();
      const receiver = await startWebhookReceiver(event.id);
      const client = await MongoClient.connect(process.env.MONGO_URI);
      const db = client.db();
      await db.collection('test_destinations').insertOne({
        _id: event.id,
        url: receiver.url,
      });
      await db
        .collection('notification_events')
        .insertOne(buildNotificationEventDocument(event));
      await client.close();
      const server = Fastify().decorate('config', {
        notifications: buildNotificationConfig({
          enabled: true,
          workerMode: NotificationWorkerModes.EMBEDDED_CHILD,
        }),
      });
      startEmbeddedNotificationWorker(server, {
        modulePath: WORKER_MODULE_PATH,
      });
      t.after(async () => {
        await server.close();
        receiver.close();
      });

      await server.ready();
      const delivery = await receiver.received;

      expect(JSON.parse(delivery.rawBody)).toEqual(event);
      expect(
        isSignedWith(
          delivery.headers['module-signature'],
          delivery.rawBody,
          'module-secret',
        ),
      ).toEqual(true);
    },
  );
});

// A local webhook receiver, which the worker reaches even from a child
// process. `received` resolves with the delivery of the given event.
const startWebhookReceiver = async (eventId) => {
  const { promise: received, resolve } = Promise.withResolvers();
  const server = http.createServer(async (request, response) => {
    const rawBody = await text(request);
    response.writeHead(204).end();
    if (request.headers['verii-event-id'] === eventId) {
      resolve({ headers: request.headers, rawBody });
    }
  });
  await once(server.listen(0, '127.0.0.1'), 'listening');

  return {
    url: `http://127.0.0.1:${server.address().port}/notifications`,
    received,
    close: () => {
      server.closeAllConnections();
      server.close();
    },
  };
};

const isSignedWith = (signatureHeader, rawBody, secret) => {
  const { t, v1 } = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('=')),
  );
  return (
    v1 ===
    crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  );
};

const buildTestEvent = () => ({
  id: newNotificationEventId(),
  type: 'credential.issued',
  version: 1,
  occurredAt: '2026-06-25T10:15:29.000Z',
  resource: { type: 'credential', id: 'credential-id' },
  data: {},
  links: {},
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
