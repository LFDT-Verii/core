const { notificationJobsEntity } = require('./entities/notification-jobs');

/** @typedef {import('../../entities/notification-job').NotificationJob} NotificationJob */

/**
 * @param {import('mongodb').Db} db
 * @returns {import('../contracts').NotificationJobsRepository}
 */
const createNotificationJobsRepository = (db) => {
  /** @type {import('mongodb').Collection<NotificationJob>} */
  const collection = db.collection(notificationJobsEntity.collectionName);
  const projection = notificationJobsEntity.defaultProjection;

  return {
    enqueueOnce: async (jobs) => {
      await Promise.all(
        jobs.map((job) =>
          collection.updateOne(
            { jobId: job.jobId },
            { $setOnInsert: job },
            { upsert: true },
          ),
        ),
      );
    },
    acquireNext: ({ now, leaseUntil }) =>
      collection
        .findOneAndUpdate(
          {
            status: { $in: ['PENDING', 'RETRY'] },
            nextAttemptAt: { $lte: now },
            $or: [
              { leaseUntil: { $exists: false } },
              { leaseUntil: null },
              { leaseUntil: { $lte: now } },
            ],
          },
          { $set: { leaseUntil, updatedAt: now } },
          { returnDocument: 'after', projection },
        )
        .then((job) => job ?? undefined),
    markSent: async ({ jobId, providerMessageId, sentAt, updatedAt }) => {
      await collection.updateOne(
        { jobId },
        {
          $set: {
            status: 'SENT',
            providerMessageId,
            sentAt,
            updatedAt,
            leaseUntil: null,
          },
          $inc: { attemptCount: 1 },
        },
      );
    },
    markRetry: async ({ jobId, lastErrorCode, nextAttemptAt, updatedAt }) => {
      await collection.updateOne(
        { jobId },
        {
          $set: {
            status: 'RETRY',
            lastErrorCode,
            nextAttemptAt,
            updatedAt,
            leaseUntil: null,
          },
          $inc: { attemptCount: 1 },
        },
      );
    },
    findDiagnosticsByRunId: (runId) =>
      collection
        .find(
          { runId },
          {
            projection: notificationJobsEntity.projections.diagnostics,
            sort: { role: 1 },
          },
        )
        .toArray(),
  };
};

module.exports = { createNotificationJobsRepository };
