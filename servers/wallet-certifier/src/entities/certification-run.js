/**
 * @typedef {'ISSUING'|'VERIFICATION'} CertificationCapability
 */

/**
 * @typedef {'CREATED'|'ISSUING'|'PREPARING_DISCLOSURE'|'DISCLOSING'|
 * 'FINALIZING'|'PASSED'|'FAILED'|'REJECTED'|'TIMED_OUT'|'ERROR'} CertificationRunState
 */

/**
 * @typedef {object} CertificationFailure
 * @property {string} code
 * @property {string} message
 */

/**
 * @typedef {object} CertificationRun
 * @property {string} runId
 * @property {CertificationCapability} capability
 * @property {CertificationRunState} state
 * @property {string} walletId
 * @property {string} walletName
 * @property {string} [walletOrganizationId]
 * @property {string} [walletOrganizationName]
 * @property {string} interactionCapabilityHash
 * @property {Date} capabilityExpiresAt
 * @property {string} [depotId]
 * @property {string} [setupCredentialId]
 * @property {string} [presentationId]
 * @property {string} [exchangeId]
 * @property {'ISSUING'|'DISCLOSING'} [interactionPhase]
 * @property {string} [setupCredentialFingerprint]
 * @property {Date} [actionDeadline]
 * @property {Date} [absoluteDeadline]
 * @property {Date} [nextCheckAt]
 * @property {Date|null} [leaseUntil]
 * @property {CertificationFailure} [failure]
 * @property {Record<string, unknown>} [resultSummary]
 * @property {string} [applicantResultCapabilityHash]
 * @property {string} [supportResultCapabilityHash]
 * @property {Date} [resultCapabilityExpiresAt]
 * @property {number} [reconcileFailures]
 * @property {string} [lastReconcileErrorCode]
 * @property {number} revision
 * @property {Array<{state: CertificationRunState, at: Date}>} journal
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {Date} [completedAt]
 * @property {Date} purgeAt
 */

const certificationRunEntity = Object.freeze({
  entityName: 'certificationRun',
});

module.exports = { certificationRunEntity };
