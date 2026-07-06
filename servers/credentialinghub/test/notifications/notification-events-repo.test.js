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

const { describe, it } = require('node:test');
const { expect } = require('expect');
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

  it('should mark delivered, retrying, and dead events', async () => {
    const calls = [];
    const now = new Date('2026-06-25T10:15:30.000Z');
    const retentionExpiresAt = new Date('2026-07-25T10:15:30.000Z');
    const notificationEventsRepo = notificationEventsRepoExtension({
      defaultColumnsSelection: { _id: 1 },
      extensions: [],
      collection: () => ({
        findOneAndUpdate: async (...args) => {
          calls.push(args);
          return { value: { _id: args[0]._id } };
        },
      }),
    });

    await notificationEventsRepo.markDelivered({
      eventId: 'evt_delivered',
      now,
      retentionExpiresAt,
    });
    await notificationEventsRepo.markRetrying({
      eventId: 'evt_retrying',
      lastError: { message: 'temporary outage', statusCode: 500 },
      nextAttemptAt: new Date('2026-06-25T10:16:30.000Z'),
      now,
    });
    await notificationEventsRepo.markDead({
      eventId: 'evt_dead',
      lastError: { message: 'bad request', statusCode: 400 },
      now,
      retentionExpiresAt,
    });

    expect(calls).toEqual([
      [
        { _id: 'evt_delivered' },
        {
          $set: {
            status: NotificationEventStatuses.DELIVERED,
            deliveredAt: now,
            retentionExpiresAt,
            updatedAt: now,
          },
          $unset: {
            lockedBy: '',
            lockedUntil: '',
            lastError: '',
          },
        },
        {
          returnDocument: 'after',
          includeResultMetadata: true,
          projection: { _id: 1 },
        },
      ],
      [
        { _id: 'evt_retrying' },
        {
          $set: {
            status: NotificationEventStatuses.RETRYING,
            lastError: { message: 'temporary outage', statusCode: 500 },
            nextAttemptAt: new Date('2026-06-25T10:16:30.000Z'),
            updatedAt: now,
          },
          $unset: {
            lockedBy: '',
            lockedUntil: '',
          },
        },
        {
          returnDocument: 'after',
          includeResultMetadata: true,
          projection: { _id: 1 },
        },
      ],
      [
        { _id: 'evt_dead' },
        {
          $set: {
            status: NotificationEventStatuses.DEAD,
            deadAt: now,
            lastError: { message: 'bad request', statusCode: 400 },
            retentionExpiresAt,
            updatedAt: now,
          },
          $unset: {
            lockedBy: '',
            lockedUntil: '',
          },
        },
        {
          returnDocument: 'after',
          includeResultMetadata: true,
          projection: { _id: 1 },
        },
      ],
    ]);
  });
});
