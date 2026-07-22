/**
 * @typedef {object} WalletInteraction
 * @property {string} state
 * @property {string} redirectUrl
 * @property {string} qrValue
 * @property {string} actionDeadline
 * @property {string} absoluteDeadline
 */

/**
 * @typedef {object} CredentialEvidence
 * @property {string} issuedAt
 * @property {Record<string, unknown>} [json]
 * @property {string} jwt
 */

/**
 * @typedef {object} RunEvidence
 * @property {string} runId
 * @property {string} applicantName
 * @property {string} applicantEmail
 * @property {WalletInteraction} [issueInteraction]
 * @property {WalletInteraction} [disclosureInteraction]
 * @property {CredentialEvidence} [issuedCredential]
 * @property {Record<string, unknown>} [presentationResult]
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {Date} purgeAt
 */

const runEvidenceEntity = Object.freeze({
  entityName: 'runEvidence',
});

module.exports = { runEvidenceEntity };
