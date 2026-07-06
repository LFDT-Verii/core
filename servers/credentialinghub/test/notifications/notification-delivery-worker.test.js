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
const http = require('node:http');
const {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
} = require('node:test');
const { bindRepo, mongoDb } = require('@spencejs/spence-mongo-repos');
const { wait } = require('@verii/common-functions');
const { expect } = require('expect');
const createTestFastify = require('../helpers/create-test-fastify');
const {
  NotificationEventStatuses,
  buildNotificationConfig,
  startNotificationDeliveryWorker,
} = require('../../src/entities/notifications');

const WEBHOOK_SECRET = 'delivery-secret';

describe('notification delivery worker', () => {
  let fastify;
  let receiver;
  let receiverBehavior;
  let receiverUrl;
  let receivedRequests;
  let context;
  let repos;
  let worker;

  before(async () => {
    receivedRequests = [];
    receiver = await startWebhookReceiver(receivedRequests, () =>
      receiverBehavior(),
    );
    const { port } = receiver.address();
    receiverUrl = `http://127.0.0.1:${port}/notifications`;
  });

  beforeEach(async () => {
    receivedRequests.splice(0, receivedRequests.length);
    receiverBehavior = async () => ({ body: '', statusCode: 204 });
    fastify = createTestFastify({
      notifications: buildTestNotificationConfig(receiverUrl),
    });
    await fastify.ready();
    repos = bindRepo(fastify);
    context = buildWorkerContext({ fastify, repos });
    await mongoDb().collection('notification_events').deleteMany({});
  });

  afterEach(async () => {
    if (worker != null) {
      await worker.stop();

      worker = undefined;
    }
    await fastify.close();
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      receiver.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('should deliver a pending event and mark it delivered', async () => {
    const event = buildEvent({ id: 'evt_delivered' });
    await repos.notification_events.insertEvents([event]);

    worker = startNotificationDeliveryWorker(
      {
        pollIntervalMs: 5,
        workerId: 'worker-1',
      },
      context,
    );

    await waitForCondition(() => receivedRequests.length === 1);

    expect(receivedRequests[0]).toEqual(
      expect.objectContaining({
        body: event,
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'verii-event-id': event.id,
          'verii-event-time': event.occurredAt,
          'verii-event-type': event.type,
          'verii-signature': expect.stringMatching(/^t=\d+,v1=[a-f0-9]+$/),
        }),
      }),
    );
    expectWebhookSignature(receivedRequests[0]);
    await waitForEventStatus(event.id, NotificationEventStatuses.DELIVERED);
    await stopWorker();

    const storedEvent = await loadEvent(event.id);
    expect(storedEvent).toEqual(
      expect.objectContaining({
        _id: event.id,
        deliveredAt: expect.any(Date),
        retentionExpiresAt: expect.any(Date),
        status: NotificationEventStatuses.DELIVERED,
      }),
    );
    expect(storedEvent).not.toHaveProperty('lastError');
    expect(storedEvent).not.toHaveProperty('lockedBy');
    expect(storedEvent).not.toHaveProperty('lockedUntil');
  });

  it('should mark retryable webhook failures for another attempt', async () => {
    receiverBehavior = async () => ({
      body: 'temporary outage',
      statusCode: 500,
    });
    const event = buildEvent({ id: 'evt_retry' });
    await repos.notification_events.insertEvents([event]);

    worker = startNotificationDeliveryWorker(
      {
        pollIntervalMs: 5,
        workerId: 'worker-1',
      },
      context,
    );

    await waitForEventStatus(event.id, NotificationEventStatuses.RETRYING);
    await stopWorker();

    const storedEvent = await loadEvent(event.id);
    expect(storedEvent).toEqual(
      expect.objectContaining({
        _id: event.id,
        lastError: {
          message: 'Webhook delivery failed with status 500',
          responseBody: 'temporary outage',
          statusCode: 500,
        },
        nextAttemptAt: expect.any(Date),
        status: NotificationEventStatuses.RETRYING,
      }),
    );
    expect(storedEvent).not.toHaveProperty('lockedBy');
    expect(storedEvent).not.toHaveProperty('lockedUntil');
  });

  it('should mark permanent webhook failures dead', async () => {
    receiverBehavior = async () => ({ body: 'bad request', statusCode: 400 });
    const event = buildEvent({ id: 'evt_dead' });
    await repos.notification_events.insertEvents([event]);

    worker = startNotificationDeliveryWorker(
      {
        pollIntervalMs: 5,
        workerId: 'worker-1',
      },
      context,
    );

    await waitForEventStatus(event.id, NotificationEventStatuses.DEAD);
    await stopWorker();

    const storedEvent = await loadEvent(event.id);
    expect(storedEvent).toEqual(
      expect.objectContaining({
        _id: event.id,
        deadAt: expect.any(Date),
        lastError: {
          message: 'Webhook delivery failed with status 400',
          responseBody: 'bad request',
          statusCode: 400,
        },
        retentionExpiresAt: expect.any(Date),
        status: NotificationEventStatuses.DEAD,
      }),
    );
    expect(storedEvent).not.toHaveProperty('lockedBy');
    expect(storedEvent).not.toHaveProperty('lockedUntil');
  });

  it('should mark timed out webhook deliveries for retry', async () => {
    receiverBehavior = async () => {
      await wait(50);
      return { body: '', statusCode: 204 };
    };
    await replaceFastify({
      notifications: buildTestNotificationConfig(receiverUrl, {
        webhookTimeoutMs: 5,
      }),
    });
    await mongoDb().collection('notification_events').deleteMany({});
    const event = buildEvent({ id: 'evt_timeout' });
    await repos.notification_events.insertEvents([event]);

    worker = startNotificationDeliveryWorker(
      {
        pollIntervalMs: 5,
        workerId: 'worker-1',
      },
      context,
    );

    await waitForEventStatus(event.id, NotificationEventStatuses.RETRYING);
    await stopWorker();

    expect(await loadEvent(event.id)).toEqual(
      expect.objectContaining({
        _id: event.id,
        lastError: expect.objectContaining({
          message: expect.stringMatching(/abort/i),
        }),
        status: NotificationEventStatuses.RETRYING,
      }),
    );
  });

  it('should not poll or deliver when notifications are disabled', async () => {
    await replaceFastify({
      notifications: buildNotificationConfig({ enabled: false }),
    });
    await mongoDb().collection('notification_events').deleteMany({});
    const event = buildEvent({ id: 'evt_disabled' });
    await repos.notification_events.insertEvents([event]);

    worker = startNotificationDeliveryWorker(
      {
        pollIntervalMs: 5,
        workerId: 'worker-disabled',
      },
      context,
    );

    expect(worker.workerId).toEqual('worker-disabled');
    await stopWorker();

    expect(receivedRequests).toEqual([]);
    expect(await loadEvent(event.id)).toEqual(
      expect.objectContaining({
        _id: event.id,
        status: NotificationEventStatuses.PENDING,
      }),
    );
  });

  const replaceFastify = async (configOverrides) => {
    await fastify.close();

    fastify = undefined;

    fastify = createTestFastify(configOverrides);
    await fastify.ready();

    repos = bindRepo(fastify);
    context = buildWorkerContext({ fastify, repos });
  };

  const stopWorker = async () => {
    await worker.stop();

    worker = undefined;
  };
});

const buildTestNotificationConfig = (webhookUrl, overrides = {}) =>
  buildNotificationConfig({
    allowInsecureWebhookUrl: true,
    enabled: true,
    webhookSecret: WEBHOOK_SECRET,
    webhookTimeoutMs: 1000,
    webhookUrl,
    ...overrides,
  });

const buildWorkerContext = ({ fastify, repos }) => ({
  config: fastify.config,
  log: fastify.log,
  repos,
});

const buildEvent = ({ id = 'evt_test' } = {}) => ({
  id,
  type: 'credential.issued',
  version: 1,
  occurredAt: '2026-06-25T10:15:29.000Z',
  resource: { type: 'credential', id: 'credential-id' },
  data: {},
  links: {},
});

const loadEvent = (eventId) =>
  mongoDb().collection('notification_events').findOne({ _id: eventId });

const waitForEventStatus = (eventId, status) =>
  waitForCondition(async () => {
    const event = await loadEvent(eventId);
    return event?.status === status;
  });

const waitForCondition = async (
  condition,
  timeoutMs = 1000,
  deadline = Date.now() + timeoutMs,
) => {
  if (await condition()) {
    return;
  }

  if (Date.now() > deadline) {
    throw new Error('Timed out waiting for condition');
  }

  await wait(5);
  await waitForCondition(condition, timeoutMs, deadline);
};

const startWebhookReceiver = (receivedRequests, responseBuilder) =>
  new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          receivedRequests.push({
            body: JSON.parse(rawBody),
            headers: req.headers,
            rawBody,
          });
          const response = await responseBuilder();
          res.writeHead(response.statusCode).end(response.body);
        } catch (error) {
          res.writeHead(500).end(error.message);
        }
      });
    });

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server);
    });
  });

const expectWebhookSignature = ({ headers, rawBody }) => {
  const signatureParts = Object.fromEntries(
    headers['verii-signature'].split(',').map((part) => part.split('=')),
  );
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${signatureParts.t}.${rawBody}`)
    .digest('hex');

  expect(signatureParts.v1).toEqual(expectedSignature);
};
