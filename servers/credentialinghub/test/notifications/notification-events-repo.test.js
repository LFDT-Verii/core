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

const { afterEach, beforeEach, describe, it } = require('node:test');
const { bindRepo, mongoDb } = require('@spencejs/spence-mongo-repos');
const { expect } = require('expect');
const createTestFastify = require('../helpers/create-test-fastify');
const {
  NotificationEventStatuses,
} = require('../../src/entities/notifications');
const {
  notificationEventsRepoExtension,
} = require('../../src/entities/notifications/repo/notification-events-repo-extension');

describe('notification events repo extension', () => {
  it('should insert notification event documents', async () => {
    let insertedDocs;
    const notificationEventsRepo = notificationEventsRepoExtension({
      extensions: [],
      collection: () => ({
        insertMany: async (docs) => {
          insertedDocs = docs;
        },
      }),
    });

    await expect(
      notificationEventsRepo.insertEvents([
        {
          id: 'evt_test',
          type: 'credential.issued',
          version: 1,
          occurredAt: '2026-06-25T10:15:30.000Z',
          resource: {
            type: 'credential',
            id: 'credential-id',
          },
          data: {},
          links: {},
        },
      ]),
    ).resolves.toEqual([
      expect.objectContaining({
        _id: 'evt_test',
        type: 'credential.issued',
        version: 1,
        status: NotificationEventStatuses.PENDING,
        attempts: 0,
        nextAttemptAt: expect.any(Date),
        lockedBy: null,
        lockedUntil: null,
        lastError: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        deliveredAt: null,
        deadAt: null,
        retentionExpiresAt: null,
      }),
    ]);
    expect(insertedDocs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: 'evt_test',
          payload: expect.objectContaining({
            id: 'evt_test',
          }),
        }),
      ]),
    );
  });

  it('should skip empty event inserts', async () => {
    let insertManyCalled = false;
    const notificationEventsRepo = notificationEventsRepoExtension({
      extensions: [],
      collection: () => ({
        insertMany: async () => {
          insertManyCalled = true;
        },
      }),
    });

    await expect(notificationEventsRepo.insertEvents([])).resolves.toEqual([]);
    expect(insertManyCalled).toEqual(false);
  });

  it('should claim due events with an expiring lease query', async () => {
    const calls = [];
    const now = new Date('2026-06-25T10:15:30.000Z');
    const lockedUntil = new Date('2026-06-25T10:16:00.000Z');
    const claimedEvent = {
      _id: 'evt_test',
      status: NotificationEventStatuses.DELIVERING,
      lockedBy: 'worker-1',
      lockedUntil,
      attempts: 2,
    };
    const notificationEventsRepo = notificationEventsRepoExtension({
      defaultColumnsSelection: { _id: 1 },
      extensions: [],
      collection: () => ({
        findOneAndUpdate: async (...args) => {
          calls.push(args);
          return { value: claimedEvent };
        },
      }),
    });

    await expect(
      notificationEventsRepo.claimDueEvent({
        now,
        workerId: 'worker-1',
        lockDurationMs: 30000,
      }),
    ).resolves.toEqual(claimedEvent);

    expect(calls).toEqual([
      [
        {
          status: {
            $in: [
              NotificationEventStatuses.PENDING,
              NotificationEventStatuses.RETRYING,
              NotificationEventStatuses.DELIVERING,
            ],
          },
          nextAttemptAt: { $lte: now },
          $or: [
            { lockedUntil: { $exists: false } },
            { lockedUntil: null },
            { lockedUntil: { $lt: now } },
          ],
        },
        {
          $set: {
            status: NotificationEventStatuses.DELIVERING,
            lockedBy: 'worker-1',
            lockedUntil,
            updatedAt: now,
          },
          $inc: { attempts: 1 },
        },
        {
          sort: { createdAt: 1 },
          returnDocument: 'after',
          includeResultMetadata: true,
          projection: { _id: 1 },
        },
      ],
    ]);
  });

  it('should reject invalid lock durations before claiming due events', async () => {
    let findOneAndUpdateCalled = false;
    const notificationEventsRepo = notificationEventsRepoExtension({
      defaultColumnsSelection: { _id: 1 },
      extensions: [],
      collection: () => ({
        findOneAndUpdate: async () => {
          findOneAndUpdateCalled = true;
          return { value: null };
        },
      }),
    });

    await expect(
      notificationEventsRepo.claimDueEvent({
        now: new Date('2026-06-25T10:15:30.000Z'),
        workerId: 'worker-1',
        lockDurationMs: Number.NaN,
      }),
    ).rejects.toThrow('Notification event lock duration must be positive');

    expect(findOneAndUpdateCalled).toEqual(false);
  });

  describe('mongo state transitions', () => {
    let fastify;
    let repos;

    beforeEach(async () => {
      fastify = createTestFastify();
      await fastify.ready();
      repos = bindRepo(fastify);
      await mongoDb().collection('notification_events').deleteMany({});
    });

    afterEach(async () => {
      if (fastify != null) {
        await fastify.close();
        fastify = undefined;
      }
    });

    it('should return the updated document when marking a locked event delivered', async () => {
      const event = buildEvent({ id: 'evt_mark_delivered' });
      const now = new Date();
      const retentionExpiresAt = new Date(now.getTime() + 30000);
      await repos.notification_events.insertEvents([event]);
      await expect(
        repos.notification_events.claimDueEvent({
          now,
          workerId: 'worker-1',
          lockDurationMs: 30000,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          _id: event.id,
          lockedBy: 'worker-1',
        }),
      );

      await expect(
        repos.notification_events.markDelivered({
          eventId: event.id,
          lockedBy: 'worker-1',
          now,
          retentionExpiresAt,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          _id: event.id,
          status: NotificationEventStatuses.DELIVERED,
        }),
      );
    });

    it('should not mark an event delivered when the lock owner changed', async () => {
      const event = buildEvent({ id: 'evt_stale_delivered' });
      const now = new Date();
      await repos.notification_events.insertEvents([event]);
      await expect(
        repos.notification_events.claimDueEvent({
          now,
          workerId: 'worker-1',
          lockDurationMs: 30000,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          _id: event.id,
          lockedBy: 'worker-1',
        }),
      );
      await mongoDb()
        .collection('notification_events')
        .updateOne(
          { _id: event.id },
          {
            $set: {
              lockedBy: 'worker-2',
              status: NotificationEventStatuses.DELIVERING,
            },
          },
        );

      await expect(
        repos.notification_events.markDelivered({
          eventId: event.id,
          lockedBy: 'worker-1',
          now,
          retentionExpiresAt: new Date(now.getTime() + 30000),
        }),
      ).resolves.toEqual(null);
      await expect(loadEvent(event.id)).resolves.toEqual(
        expect.objectContaining({
          lockedBy: 'worker-2',
          status: NotificationEventStatuses.DELIVERING,
        }),
      );
    });
  });
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
