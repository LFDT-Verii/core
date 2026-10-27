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
  anchoringJobsRepoExtension,
} = require('./anchoring-jobs-repo-extension');

module.exports = (app, options, next = () => {}) => {
  app.ready(async () => {
    await mongoDb()
      .collection('anchoring_jobs')
      .createIndex(
        { status: 1, nextAttemptAt: 1, lockedUntil: 1, createdAt: 1 },
        { name: 'anchoring_jobs_due_idx' },
      );
  });
  next();
  return repoFactory(
    {
      name: 'anchoring_jobs',
      entityName: 'anchoringJob',
      defaultProjection: {
        _id: 1,
        credentialId: 1,
        tenantId: 1,
        credentialMetadata: 1,
        status: 1,
        attempts: 1,
        nextAttemptAt: 1,
        lockedBy: 1,
        lockedUntil: 1,
        lastError: 1,
        acceptedAt: 1,
        anchoredAt: 1,
        deadAt: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      extensions: [anchoringJobsRepoExtension],
    },
    app,
  );
};
