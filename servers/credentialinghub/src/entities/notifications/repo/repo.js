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

const { mongoDb, repoFactory } = require('@spencejs/spence-mongo-repos');
const {
  notificationEventsRepoExtension,
} = require('./notification-events-repo-extension');

module.exports = (app, options, next = () => {}) => {
  app.ready(async () => {
    const collection = mongoDb().collection('notification_events');
    await collection.createIndex(
      { status: 1, nextAttemptAt: 1, lockedUntil: 1, createdAt: 1 },
      { name: 'notification_events_due_idx' },
    );
    await collection.createIndex(
      { type: 1, createdAt: -1 },
      { name: 'notification_events_type_created_idx' },
    );
    await collection.createIndex(
      { status: 1, updatedAt: -1 },
      { name: 'notification_events_status_updated_idx' },
    );
    await collection.createIndex(
      { retentionExpiresAt: 1 },
      {
        name: 'notification_events_retention_ttl_idx',
        expireAfterSeconds: 0,
      },
    );
  });
  next();
  return repoFactory(
    {
      name: 'notification_events',
      entityName: 'notificationEvent',
      defaultProjection: {
        _id: 1,
        type: 1,
        version: 1,
        payload: 1,
        status: 1,
        attempts: 1,
        nextAttemptAt: 1,
        lockedBy: 1,
        lockedUntil: 1,
        lastError: 1,
        createdAt: 1,
        updatedAt: 1,
        deliveredAt: 1,
        deadAt: 1,
        retentionExpiresAt: 1,
      },
      extensions: [notificationEventsRepoExtension],
    },
    app,
  );
};
