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
const { after, afterEach, beforeEach, describe, it } = require('node:test');
const { bindRepo, mongoDb } = require('@spencejs/spence-mongo-repos');
const { wait } = require('@verii/common-functions');
const { expect } = require('expect');
const nock = require('nock').default;
const createTestFastify = require('../helpers/create-test-fastify');
const {
  NotificationEventStatuses,
  buildNotificationConfig,
  deliverNextNotificationEvent,
  startNotificationDeliveryWorker,
} = require('../../src/entities/notifications');
const {
  buildNotificationDeliveryFetch,
} = require('../../src/start-notification-worker');

const WEBHOOK_SECRET = 'delivery-secret';
const WEBHOOK_URL = 'http://operator.localhost.test/notifications';
const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 30;
const INITIAL_RETRY_DELAY_MS = 1000;

describe('notification delivery worker', () => {
  let fastify;
  let context;
  let repos;
  let worker;

  beforeEach(async () => {
    activateNock();
    nock.cleanAll();
    fastify = createTestFastify({
      notifications: buildTestNotificationConfig(),
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
    if (fastify != null) {
      await fastify.close();

      fastify = undefined;
    }
    nock.cleanAll();
  });

  after(() => {
    nock.cleanAll();
    nock.restore();
  });

  it('should deliver a pending event and mark it delivered', async () => {
    const event = buildEvent({ id: 'evt_delivered' });
    const webhook = nockWebhook({ event });
    await repos.notification_events.insertEvents([event]);

    worker = startNotificationDeliveryWorker(
      {
        pollIntervalMs: 5,
        workerId: 'worker-1',
      },
      context,
    );

    await waitForCondition(() => webhook.scope.isDone());
    await waitForEventStatus(event.id, NotificationEventStatuses.DELIVERED);
    await stopWorker();

    expect(webhook.body).toEqual(event);
    expect(webhook.headers).toEqual(
      expect.objectContaining({
        'content-type': 'application/json',
        'verii-event-id': event.id,
        'verii-event-time': event.occurredAt,
        'verii-event-type': event.type,
        'verii-signature': expect.stringMatching(/^t=\d+,v1=[a-f0-9]+$/),
      }),
    );
    expectWebhookSignature({
      rawBody: JSON.stringify(event),
      signatureHeader: webhook.headers['verii-signature'],
    });

    const storedEvent = await loadEvent(event.id);
    expect(storedEvent).toEqual(
      expect.objectContaining({
        _id: event.id,
        deliveredAt: expect.any(Date),
        retentionExpiresAt: expect.any(Date),
        status: NotificationEventStatuses.DELIVERED,
      }),
    );
    expectRetentionExpiresAt(storedEvent, 'deliveredAt');
    expect(storedEvent).not.toHaveProperty('lastError');
    expect(storedEvent).not.toHaveProperty('lockedBy');
    expect(storedEvent).not.toHaveProperty('lockedUntil');
  });

  it('should mark retryable webhook failures for another attempt', async () => {
    nockWebhook({
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
    expect(storedEvent.nextAttemptAt.getTime()).toEqual(
      storedEvent.updatedAt.getTime() + INITIAL_RETRY_DELAY_MS,
    );
    expect(storedEvent).not.toHaveProperty('lockedBy');
    expect(storedEvent).not.toHaveProperty('lockedUntil');
  });

  it('should omit oversized webhook failure bodies', async () => {
    const oversizedBody = 'x'.repeat(501);
    nockWebhook({
      body: oversizedBody,
      headers: {
        'content-length': String(oversizedBody.length),
      },
      statusCode: 500,
    });
    const event = buildEvent({ id: 'evt_large_failure_body' });
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
          responseBody: '[omitted: response body exceeds 500 bytes]',
          statusCode: 500,
        },
        status: NotificationEventStatuses.RETRYING,
      }),
    );
  });

  it('should mark permanent webhook failures dead', async () => {
    nockWebhook({ body: 'bad request', statusCode: 400 });
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
    expectRetentionExpiresAt(storedEvent, 'deadAt');
    expect(storedEvent).not.toHaveProperty('lockedBy');
    expect(storedEvent).not.toHaveProperty('lockedUntil');
  });

  it('should mark timed out webhook deliveries for retry', async () => {
    nockWebhook({
      error: Object.assign(new Error('Headers Timeout Error'), {
        code: 'UND_ERR_HEADERS_TIMEOUT',
        name: 'HeadersTimeoutError',
      }),
    });
    await replaceFastify({
      notifications: buildTestNotificationConfig({
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
          message: expect.stringMatching(/timeout/i),
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
    await wait(10);
    await stopWorker();

    expect(await loadEvent(event.id)).toEqual(
      expect.objectContaining({
        _id: event.id,
        status: NotificationEventStatuses.PENDING,
      }),
    );
  });

  it('should skip delivery when notifications are disabled', async () => {
    await replaceFastify({
      notifications: buildNotificationConfig({ enabled: false }),
    });
    await mongoDb().collection('notification_events').deleteMany({});
    const event = buildEvent({ id: 'evt_deliver_disabled' });
    await repos.notification_events.insertEvents([event]);

    await expect(
      deliverNextNotificationEvent({ workerId: 'worker-disabled' }, context),
    ).resolves.toEqual(false);

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

const activateNock = () => {
  if (!nock.isActive()) {
    nock.activate();
  }
};

const buildTestNotificationConfig = (overrides = {}) =>
  buildNotificationConfig({
    allowInsecureWebhookUrl: true,
    enabled: true,
    retentionDays: RETENTION_DAYS,
    webhookSecret: WEBHOOK_SECRET,
    webhookTimeoutMs: 1000,
    webhookUrl: WEBHOOK_URL,
    ...overrides,
  });

const buildWorkerContext = ({ fastify, repos }) => ({
  config: fastify.config,
  fetch: buildNotificationDeliveryFetch(fastify.config, fastify.log),
  log: fastify.log,
  repos,
});

const nockWebhook = ({
  body = '',
  error,
  event,
  headers,
  statusCode = 204,
} = {}) => {
  const url = new URL(WEBHOOK_URL);
  const webhook = {
    body: undefined,
    headers: {},
  };
  let interceptor = nock(url.origin)
    .matchHeader('content-type', captureHeader(webhook, 'content-type'))
    .matchHeader('verii-event-id', captureHeader(webhook, 'verii-event-id'))
    .matchHeader('verii-event-time', captureHeader(webhook, 'verii-event-time'))
    .matchHeader('verii-event-type', captureHeader(webhook, 'verii-event-type'))
    .matchHeader('verii-signature', captureHeader(webhook, 'verii-signature'))
    .post(url.pathname, (requestBody) => {
      webhook.body = requestBody;
      return (
        event == null || JSON.stringify(requestBody) === JSON.stringify(event)
      );
    });

  if (error != null) {
    webhook.scope = interceptor.replyWithError(error);
    return webhook;
  }

  const scope = interceptor.reply(statusCode, body, headers);

  webhook.scope = scope;
  return webhook;
};

const captureHeader = (webhook, headerName) => (value) => {
  webhook.headers[headerName] = value;
  return true;
};

const expectRetentionExpiresAt = (storedEvent, retainedFromField) => {
  expect(storedEvent.retentionExpiresAt.getTime()).toEqual(
    storedEvent[retainedFromField].getTime() + RETENTION_DAYS * DAY_MS,
  );
};

const expectWebhookSignature = ({ rawBody, signatureHeader }) => {
  const signatureParts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('=')),
  );
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${signatureParts.t}.${rawBody}`)
    .digest('hex');

  expect(signatureParts.v1).toEqual(expectedSignature);
};

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
