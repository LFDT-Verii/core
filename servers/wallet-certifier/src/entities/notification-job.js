/**
 * @typedef {object} NotificationJob
 * @property {string} jobId
 * @property {string} runId
 * @property {'APPLICANT'|'SUPPORT'} role
 * @property {string} recipient
 * @property {string} subject
 * @property {string} message
 * @property {'PENDING'|'RETRY'|'SENT'} status
 * @property {number} attemptCount
 * @property {Date} nextAttemptAt
 * @property {Date|null} [leaseUntil]
 * @property {string} [lastErrorCode]
 * @property {string} [providerMessageId]
 * @property {Date} [sentAt]
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {Date} purgeAt
 */

const notificationJobEntity = Object.freeze({
  entityName: 'notificationJob',
});

module.exports = { notificationJobEntity };
