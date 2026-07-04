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
const { beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const {
  NotificationEventStatuses,
  deliverNextNotificationEvent,
  startNotificationDeliveryWorker,
} = require('../../src/entities/notifications');

const WEBHOOK_SECRET = 'delivery-secret';

describe('notification delivery worker', () => {
  let receiverStatusCode;
  let receiverUrl;
  let responseBody;

  beforeEach(() => {
    responseBody = '';
    receiverStatusCode = 204;
    receiverUrl = 'https://receiver.example/notifications';
  });

  it('should deliver a claimed event with the HTTP client and mark it delivered', async () => {
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
    const httpClient = buildHttpClient();

    await expect(
      deliverNextNotificationEvent({
        config: buildConfig(receiverUrl),
        httpClient,
        log: testLog,
        now,
        repos,
        workerId: 'worker-1',
      }),
    ).resolves.toEqual(true);

    const [url, rawBody, { headers }] = httpClient.post.mock.calls[0].arguments;
    expect(url).toEqual(receiverUrl);
    expect(JSON.parse(rawBody)).toEqual(event);
    expect(headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        'Verii-Event-Id': event.id,
        'Verii-Event-Type': event.type,
        'Verii-Event-Time': event.occurredAt,
        'Verii-Signature': expect.stringMatching(/^t=\d+,v1=[a-f0-9]+$/),
      }),
    );
    expectWebhookSignature({ headers, rawBody });
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
    const httpClient = buildHttpClient();

    await expect(
      deliverNextNotificationEvent({
        config: buildConfig(receiverUrl),
        httpClient,
        log: testLog,
        repos,
        workerId: 'worker-1',
      }),
    ).resolves.toEqual(false);

    expect(httpClient.post.mock.callCount()).toEqual(0);
    expect(repos.notification_events.markDelivered.mock.callCount()).toEqual(0);
    expect(repos.notification_events.markRetrying.mock.callCount()).toEqual(0);
    expect(repos.notification_events.markDead.mock.callCount()).toEqual(0);
  });

  it('should mark retryable failures for another attempt', async () => {
    const now = new Date('2026-06-25T10:15:30.000Z');
    responseBody = 'temporary outage';
    receiverStatusCode = 500;
    const repos = buildRepos({
      claimedEvent: {
        _id: 'evt_retry',
        attempts: 1,
        payload: buildEvent({ id: 'evt_retry' }),
        status: NotificationEventStatuses.DELIVERING,
      },
    });
    const httpClient = buildHttpClient({
      body: responseBody,
      statusCode: receiverStatusCode,
    });

    await expect(
      deliverNextNotificationEvent({
        config: buildConfig(receiverUrl),
        httpClient,
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
    responseBody = 'bad request';
    receiverStatusCode = 400;
    const repos = buildRepos({
      claimedEvent: {
        _id: 'evt_dead',
        attempts: 1,
        payload: buildEvent({ id: 'evt_dead' }),
        status: NotificationEventStatuses.DELIVERING,
      },
    });
    const httpClient = buildHttpClient({
      body: responseBody,
      statusCode: receiverStatusCode,
    });

    await expect(
      deliverNextNotificationEvent({
        config: buildConfig(receiverUrl),
        httpClient,
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

  it('should not mark a delivered event retrying when the delivered write fails', async () => {
    const now = new Date('2026-06-25T10:15:30.000Z');
    const writeError = new Error('database write failed');
    const repos = buildRepos({
      claimedEvent: {
        _id: 'evt_delivered_write_failed',
        attempts: 1,
        payload: buildEvent({ id: 'evt_delivered_write_failed' }),
        status: NotificationEventStatuses.DELIVERING,
      },
      markDelivered: async () => {
        throw writeError;
      },
    });
    const httpClient = buildHttpClient();

    await expect(
      deliverNextNotificationEvent({
        config: buildConfig(receiverUrl),
        httpClient,
        log: testLog,
        now,
        repos,
        workerId: 'worker-1',
      }),
    ).rejects.toThrow(writeError);

    expect(httpClient.post.mock.callCount()).toEqual(1);
    expect(repos.notification_events.markRetrying.mock.callCount()).toEqual(0);
    expect(repos.notification_events.markDead.mock.callCount()).toEqual(0);
  });

  it('should not start the polling loop when notifications are disabled', async () => {
    const log = buildLog();
    const repos = buildRepos({ claimedEvent: null });

    const worker = startNotificationDeliveryWorker({
      config: { notifications: { enabled: false } },
      httpClient: buildHttpClient(),
      log,
      repos,
      workerId: 'worker-disabled',
    });
    await worker.stop();

    expect(worker.workerId).toEqual('worker-disabled');
    expect(log.info.mock.callCount()).toEqual(0);
    expect(repos.notification_events.claimDueEvent.mock.callCount()).toEqual(0);
  });
});

const buildRepos = ({ claimedEvent, markDelivered } = {}) => {
  return {
    notification_events: {
      claimDueEvent: mock.fn(async () => {
        return claimedEvent;
      }),
      markDead: mock.fn(async () => {
        return claimedEvent;
      }),
      markDelivered: mock.fn(
        markDelivered ??
          (async () => {
            return claimedEvent;
          }),
      ),
      markRetrying: mock.fn(async () => {
        return claimedEvent;
      }),
    },
  };
};

const buildHttpClient = ({ body = '', statusCode = 204 } = {}) => {
  return {
    post: mock.fn(async () => {
      return {
        statusCode,
        text: async () => {
          return body;
        },
      };
    }),
  };
};

const buildConfig = (webhookUrl) => {
  return {
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
  };
};

const buildEvent = ({ id = 'evt_test' } = {}) => {
  return {
    id,
    type: 'credential.issued',
    version: 1,
    occurredAt: '2026-06-25T10:15:29.000Z',
    resource: { type: 'credential', id: 'credential-id' },
    data: {},
    links: {},
  };
};

const expectWebhookSignature = ({ headers, rawBody }) => {
  const signatureParts = Object.fromEntries(
    headers['Verii-Signature'].split(',').map((part) => {
      return part.split('=');
    }),
  );
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${signatureParts.t}.${rawBody}`)
    .digest('hex');

  expect(signatureParts.v1).toEqual(expectedSignature);
};

const testLog = {
  debug: () => {
    return undefined;
  },
  error: () => {
    return undefined;
  },
  info: () => {
    return undefined;
  },
  warn: () => {
    return undefined;
  },
};

const buildLog = () => {
  return {
    debug: mock.fn(),
    error: mock.fn(),
    info: mock.fn(),
    warn: mock.fn(),
  };
};
