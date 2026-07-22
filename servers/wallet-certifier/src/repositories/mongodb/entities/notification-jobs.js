const { notificationJobEntity } = require('../../../entities/notification-job');

const notificationJobsEntity = Object.freeze({
  ...notificationJobEntity,
  collectionName: 'notificationJobs',
  defaultProjection: Object.freeze({ _id: 0 }),
  projections: Object.freeze({
    diagnostics: Object.freeze({
      _id: 0,
      role: 1,
      status: 1,
      attemptCount: 1,
      lastErrorCode: 1,
      providerMessageId: 1,
      sentAt: 1,
      updatedAt: 1,
    }),
  }),
  indexes: Object.freeze([
    { key: { jobId: 1 }, name: 'jobId_unique', unique: true },
    {
      key: { status: 1, nextAttemptAt: 1, leaseUntil: 1 },
      name: 'notification_jobs_due',
    },
    {
      key: { purgeAt: 1 },
      name: 'notification_jobs_ttl',
      expireAfterSeconds: 0,
    },
  ]),
});

module.exports = { notificationJobsEntity };
