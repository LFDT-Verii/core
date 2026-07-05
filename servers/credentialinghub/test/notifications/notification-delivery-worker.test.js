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
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const {
  NotificationEventStatuses,
  deliverNextNotificationEvent,
} = require('../../src/entities/notifications');

const WEBHOOK_SECRET = 'delivery-secret';

describe('notification delivery worker', () => {
  let receiver;
  let receiverBody;
  let receiverStatusCode;
  let receiverUrl;
  let receivedRequests;

  before(async () => {
    receivedRequests = [];
    receiver = await startWebhookReceiver(receivedRequests, () => ({
      body: receiverBody,
      statusCode: receiverStatusCode,
    }));
    const { port } = receiver.address();
    receiverUrl = `http://127.0.0.1:${port}/notifications`;
  });

  beforeEach(() => {
    receivedRequests.splice(0, receivedRequests.length);
    receiverBody = '';
    receiverStatusCode = 204;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      receiver.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('should deliver a claimed event and mark it delivered', async () => {
    const now = new Date('2026-06-25T10:15:30.000Z');
    const event = {
      id: 'evt_test',
      type: 'credential.issued',
      version: 1,
      occurredAt: '2026-06-25T10:15:29.000Z',
      resource: { type: 'credential', id: 'credential-id' },
      data: {},
      links: {},
    };
    const repos = buildRepos({
      claimedEvent: {
        _id: event.id,
        attempts: 1,
        payload: event,
        status: NotificationEventStatuses.DELIVERING,
      },
    });

    await expect(
      deliverNextNotificationEvent({
        config: buildConfig(receiverUrl),
        log: testLog,
        now,
        repos,
        workerId: 'worker-1',
      }),
    ).resolves.toEqual(true);

    expect(receivedRequests).toEqual([
      expect.objectContaining({
        body: event,
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'verii-event-id': event.id,
          'verii-event-type': event.type,
          'verii-event-time': event.occurredAt,
          'verii-signature': expect.stringMatching(/^t=\d+,v1=[a-f0-9]+$/),
        }),
      }),
    ]);
    expectWebhookSignature(receivedRequests[0]);
    expect(
      repos.notification_events.markDelivered.mock.calls[0].arguments[0],
    ).toEqual({
      eventId: event.id,
      now,
      retentionExpiresAt: new Date('2026-07-25T10:15:30.000Z'),
    });
  });

  it('should return false when no due event is available', async () => {
    const repos = buildRepos({ claimedEvent: null });

    await expect(
      deliverNextNotificationEvent({
        config: buildConfig(receiverUrl),
        log: testLog,
        repos,
        workerId: 'worker-1',
      }),
    ).resolves.toEqual(false);

    expect(receivedRequests).toEqual([]);
    expect(repos.notification_events.markDelivered.mock.callCount()).toEqual(0);
    expect(repos.notification_events.markRetrying.mock.callCount()).toEqual(0);
    expect(repos.notification_events.markDead.mock.callCount()).toEqual(0);
  });

  it('should mark retryable failures for another attempt', async () => {
    const now = new Date('2026-06-25T10:15:30.000Z');
    receiverBody = 'temporary outage';
    receiverStatusCode = 500;
    const repos = buildRepos({
      claimedEvent: {
        _id: 'evt_retry',
        attempts: 1,
        payload: buildEvent({ id: 'evt_retry' }),
        status: NotificationEventStatuses.DELIVERING,
      },
    });

    await expect(
      deliverNextNotificationEvent({
        config: buildConfig(receiverUrl),
        log: testLog,
        now,
        repos,
        workerId: 'worker-1',
      }),
    ).resolves.toEqual(true);

    expect(
      repos.notification_events.markRetrying.mock.calls[0].arguments[0],
    ).toEqual({
      eventId: 'evt_retry',
      lastError: {
        message: 'Webhook delivery failed with status 500',
        responseBody: 'temporary outage',
        statusCode: 500,
      },
      nextAttemptAt: new Date('2026-06-25T10:15:31.000Z'),
      now,
    });
    expect(repos.notification_events.markDelivered.mock.callCount()).toEqual(0);
    expect(repos.notification_events.markDead.mock.callCount()).toEqual(0);
  });

  it('should mark permanent failures dead', async () => {
    const now = new Date('2026-06-25T10:15:30.000Z');
    receiverBody = 'bad request';
    receiverStatusCode = 400;
    const repos = buildRepos({
      claimedEvent: {
        _id: 'evt_dead',
        attempts: 1,
        payload: buildEvent({ id: 'evt_dead' }),
        status: NotificationEventStatuses.DELIVERING,
      },
    });

    await expect(
      deliverNextNotificationEvent({
        config: buildConfig(receiverUrl),
        log: testLog,
        now,
        repos,
        workerId: 'worker-1',
      }),
    ).resolves.toEqual(true);

    expect(
      repos.notification_events.markDead.mock.calls[0].arguments[0],
    ).toEqual({
      eventId: 'evt_dead',
      lastError: {
        message: 'Webhook delivery failed with status 400',
        responseBody: 'bad request',
        statusCode: 400,
      },
      now,
      retentionExpiresAt: new Date('2026-07-25T10:15:30.000Z'),
    });
    expect(repos.notification_events.markDelivered.mock.callCount()).toEqual(0);
    expect(repos.notification_events.markRetrying.mock.callCount()).toEqual(0);
  });
});

const buildRepos = ({ claimedEvent }) => ({
  notification_events: {
    claimDueEvent: mock.fn(async () => claimedEvent),
    markDead: mock.fn(async () => claimedEvent),
    markDelivered: mock.fn(async () => claimedEvent),
    markRetrying: mock.fn(async () => claimedEvent),
  },
});

const buildConfig = (webhookUrl) => ({
  notifications: {
    enabled: true,
    retentionDays: 30,
    webhook: {
      maxAttempts: 3,
      secret: WEBHOOK_SECRET,
      signatureHeaderName: 'Verii-Signature',
      timeoutMs: 1000,
      url: webhookUrl,
    },
    worker: {
      lockDurationMs: 30000,
    },
  },
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

const startWebhookReceiver = (receivedRequests, responseBuilder) =>
  new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        receivedRequests.push({
          body: JSON.parse(rawBody),
          headers: req.headers,
          rawBody,
        });
        const response = responseBuilder();
        res.writeHead(response.statusCode).end(response.body);
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

const testLog = {
  debug: () => {},
  error: () => {},
  info: () => {},
  warn: () => {},
};
