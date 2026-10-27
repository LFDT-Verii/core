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

const { AnchoringJobStatuses } = require('../domain');

const DUPLICATE_KEY_ERROR_CODE = 11000;

const anchoringJobsRepoExtension = (parent) => ({
  // The job's _id is the exchange id, which the wallet sends as the
  // notification_id, so a repeated notification can't enqueue a second job.
  enqueue: async ({
    exchangeId,
    credentialId,
    tenantId,
    credentialMetadata,
    now = new Date(),
  }) => {
    try {
      await parent.collection().insertOne({
        _id: exchangeId,
        credentialId,
        tenantId,
        credentialMetadata,
        status: AnchoringJobStatuses.PENDING,
        attempts: 0,
        nextAttemptAt: now,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      return true;
    } catch (error) {
      if (error.code === DUPLICATE_KEY_ERROR_CODE) {
        return false;
      }
      throw error;
    }
  },
  claimDueJob: async ({
    now = new Date(),
    workerId,
    lockDurationMs,
    projection = parent.defaultColumnsSelection,
  }) => {
    const result = await parent.collection().findOneAndUpdate(
      {
        status: {
          $in: [
            AnchoringJobStatuses.PENDING,
            AnchoringJobStatuses.RETRYING,
            AnchoringJobStatuses.ANCHORING,
          ],
        },
        nextAttemptAt: { $lte: now },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }],
      },
      {
        $set: {
          status: AnchoringJobStatuses.ANCHORING,
          lockedBy: workerId,
          lockedUntil: new Date(now.getTime() + lockDurationMs),
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
  markAnchored: ({ jobId, lockedBy, now = new Date() }) =>
    markJobState(
      parent,
      { jobId, lockedBy },
      {
        $set: {
          status: AnchoringJobStatuses.ANCHORED,
          anchoredAt: now,
          updatedAt: now,
        },
        $unset: { lockedBy: '', lockedUntil: '', lastError: '' },
      },
    ),
  markRetrying: ({
    jobId,
    lockedBy,
    lastError,
    nextAttemptAt,
    now = new Date(),
  }) =>
    markJobState(
      parent,
      { jobId, lockedBy },
      {
        $set: {
          status: AnchoringJobStatuses.RETRYING,
          lastError,
          nextAttemptAt,
          updatedAt: now,
        },
        $unset: { lockedBy: '', lockedUntil: '' },
      },
    ),
  markDead: ({ jobId, lockedBy, lastError, now = new Date() }) =>
    markJobState(
      parent,
      { jobId, lockedBy },
      {
        $set: {
          status: AnchoringJobStatuses.DEAD,
          lastError,
          deadAt: now,
          updatedAt: now,
        },
        $unset: { lockedBy: '', lockedUntil: '' },
      },
    ),
  extensions: parent.extensions.concat(['anchoringJobsRepoExtension']),
});

// Only the worker holding the job's lock can change its state
const markJobState = async (parent, { jobId, lockedBy }, update) => {
  const result = await parent
    .collection()
    .findOneAndUpdate(
      { _id: jobId, lockedBy, status: AnchoringJobStatuses.ANCHORING },
      update,
      { returnDocument: 'after', includeResultMetadata: true },
    );

  return result.value;
};

module.exports = { anchoringJobsRepoExtension };
