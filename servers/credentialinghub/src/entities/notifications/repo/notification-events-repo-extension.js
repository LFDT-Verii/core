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

const { map } = require('lodash/fp');
const { NotificationEventStatuses } = require('../domain');

const notificationEventsRepoExtension = (parent) => ({
  insertEvents: async (events) => {
    if (events.length === 0) {
      return [];
    }

    const docs = map(buildNotificationEventDocument, events);
    await parent.collection().insertMany(docs);
    return docs;
  },
  claimDueEvent: async ({
    now = new Date(),
    workerId,
    lockDurationMs,
    projection = parent.defaultColumnsSelection,
  }) => {
    const lockedUntil = new Date(now.getTime() + lockDurationMs);
    const result = await parent.collection().findOneAndUpdate(
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
          lockedBy: workerId,
          lockedUntil,
          updatedAt: now,
        },
        $inc: { attempts: 1 },
      },
      {
        sort: { createdAt: 1 },
        returnDocument: 'after',
        includeResultMetadata: true,
        projection,
      },
    );

    return result.value;
  },
  markDelivered: ({
    eventId,
    now = new Date(),
    retentionExpiresAt,
    projection = parent.defaultColumnsSelection,
  }) => {
    return findOneAndUpdateEvent(
      parent,
      { _id: eventId },
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
      projection,
    );
  },
  markRetrying: ({
    eventId,
    lastError,
    nextAttemptAt,
    now = new Date(),
    projection = parent.defaultColumnsSelection,
  }) => {
    return findOneAndUpdateEvent(
      parent,
      { _id: eventId },
      {
        $set: {
          status: NotificationEventStatuses.RETRYING,
          lastError,
          nextAttemptAt,
          updatedAt: now,
        },
        $unset: {
          lockedBy: '',
          lockedUntil: '',
        },
      },
      projection,
    );
  },
  markDead: ({
    eventId,
    lastError,
    now = new Date(),
    retentionExpiresAt,
    projection = parent.defaultColumnsSelection,
  }) => {
    return findOneAndUpdateEvent(
      parent,
      { _id: eventId },
      {
        $set: {
          status: NotificationEventStatuses.DEAD,
          deadAt: now,
          lastError,
          retentionExpiresAt,
          updatedAt: now,
        },
        $unset: {
          lockedBy: '',
          lockedUntil: '',
        },
      },
      projection,
    );
  },
  extensions: parent.extensions.concat(['notificationEventsRepoExtension']),
});

const findOneAndUpdateEvent = async (parent, filter, update, projection) => {
  const result = await parent.collection().findOneAndUpdate(filter, update, {
    returnDocument: 'after',
    includeResultMetadata: true,
    projection,
  });

  return result.value;
};

const buildNotificationEventDocument = (event) => {
  const now = new Date();

  return {
    _id: event.id,
    type: event.type,
    version: event.version,
    payload: event,
    status: NotificationEventStatuses.PENDING,
    attempts: 0,
    nextAttemptAt: now,
    lockedBy: null,
    lockedUntil: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    deliveredAt: null,
    deadAt: null,
    retentionExpiresAt: null,
  };
};

module.exports = {
  buildNotificationEventDocument,
  notificationEventsRepoExtension,
};
