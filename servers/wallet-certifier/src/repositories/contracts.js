/** @typedef {import('../entities/certification-run').CertificationRun} CertificationRun */
/** @typedef {import('../entities/certification-run').CertificationRunState} CertificationRunState */
/** @typedef {import('../entities/run-evidence').RunEvidence} RunEvidence */
/** @typedef {import('../entities/run-evidence').CredentialEvidence} CredentialEvidence */
/** @typedef {import('../entities/run-evidence').WalletInteraction} WalletInteraction */
/** @typedef {import('../entities/notification-job').NotificationJob} NotificationJob */

/**
 * @typedef {object} SetHubResourcesCommand
 * @property {string} runId
 * @property {Record<string, unknown>} fields
 * @property {Date} updatedAt
 */

/**
 * @typedef {object} StartInteractionCommand
 * @property {string} runId
 * @property {CertificationRunState} [expectedState]
 * @property {CertificationRunState} state
 * @property {'ISSUING'|'DISCLOSING'} interactionPhase
 * @property {Date} actionDeadline
 * @property {Date} absoluteDeadline
 * @property {Date} nextCheckAt
 * @property {Date} updatedAt
 */

/**
 * @typedef {object} AcquireRunLeaseCommand
 * @property {string} runId
 * @property {CertificationRunState} state
 * @property {Date} now
 * @property {Date} leaseUntil
 */

/**
 * @typedef {object} ScheduleRunCommand
 * @property {string} runId
 * @property {CertificationRunState} expectedState
 * @property {CertificationRunState} state
 * @property {Date} nextCheckAt
 * @property {Date} updatedAt
 */

/**
 * @typedef {object} RecordReconcileFailureCommand
 * @property {string} runId
 * @property {CertificationRunState} expectedState
 * @property {Date} nextCheckAt
 * @property {Date} updatedAt
 */

/**
 * @typedef {object} PrepareDisclosureCommand
 * @property {string} runId
 * @property {CertificationRunState} expectedState
 * @property {string} setupCredentialFingerprint
 * @property {Date} updatedAt
 */

/**
 * @typedef {object} CompleteRunCommand
 * @property {string} runId
 * @property {CertificationRunState} expectedState
 * @property {CertificationRunState} state
 * @property {Record<string, unknown>} fields
 * @property {Date} completedAt
 */

/**
 * @typedef {object} FindDueRunsQuery
 * @property {Date} now
 * @property {CertificationRunState[]} terminalStates
 * @property {number} limit
 */

/**
 * @typedef {object} CertificationRunsRepository
 * @property {(run: CertificationRun) => Promise<CertificationRun>} create
 * @property {(runId: string) => Promise<boolean>} removeByRunId
 * @property {(runId: string) => Promise<CertificationRun|undefined>} findByRunId
 * @property {(command: SetHubResourcesCommand) => Promise<CertificationRun|undefined>} setHubResources
 * @property {(command: StartInteractionCommand) => Promise<CertificationRun|undefined>} startInteraction
 * @property {(command: AcquireRunLeaseCommand) => Promise<CertificationRun|undefined>} acquireLease
 * @property {(command: ScheduleRunCommand) => Promise<CertificationRun|undefined>} schedule
 * @property {(command: RecordReconcileFailureCommand) => Promise<CertificationRun|undefined>} recordReconcileFailure
 * @property {(command: PrepareDisclosureCommand) => Promise<CertificationRun|undefined>} prepareDisclosure
 * @property {(command: CompleteRunCommand) => Promise<CertificationRun|undefined>} complete
 * @property {(query: FindDueRunsQuery) => Promise<CertificationRun[]>} findDue
 */

/**
 * @typedef {object} SaveInteractionCommand
 * @property {string} runId
 * @property {'issue'|'disclosure'} phase
 * @property {WalletInteraction} interaction
 * @property {Date} updatedAt
 */

/**
 * @typedef {object} SaveIssuedCredentialCommand
 * @property {string} runId
 * @property {CredentialEvidence} credential
 * @property {Date} updatedAt
 */

/**
 * @typedef {object} SaveTerminalEvidenceCommand
 * @property {string} runId
 * @property {Record<string, unknown>} fields
 * @property {Date} updatedAt
 */

/**
 * @typedef {object} RunEvidenceRepository
 * @property {(evidence: RunEvidence) => Promise<RunEvidence>} create
 * @property {(runId: string) => Promise<RunEvidence|undefined>} findByRunId
 * @property {(command: SaveInteractionCommand) => Promise<RunEvidence|undefined>} saveInteraction
 * @property {(command: SaveIssuedCredentialCommand) => Promise<RunEvidence|undefined>} saveIssuedCredential
 * @property {(command: SaveTerminalEvidenceCommand) => Promise<RunEvidence|undefined>} saveTerminalEvidence
 */

/**
 * @typedef {object} AcquireNotificationJobCommand
 * @property {Date} now
 * @property {Date} leaseUntil
 */

/**
 * @typedef {object} MarkNotificationSentCommand
 * @property {string} jobId
 * @property {string} [providerMessageId]
 * @property {Date} sentAt
 * @property {Date} updatedAt
 */

/**
 * @typedef {object} MarkNotificationRetryCommand
 * @property {string} jobId
 * @property {string} lastErrorCode
 * @property {Date} nextAttemptAt
 * @property {Date} updatedAt
 */

/**
 * @typedef {object} NotificationJobsRepository
 * @property {(jobs: NotificationJob[]) => Promise<void>} enqueueOnce
 * @property {(command: AcquireNotificationJobCommand) => Promise<NotificationJob|undefined>} acquireNext
 * @property {(command: MarkNotificationSentCommand) => Promise<void>} markSent
 * @property {(command: MarkNotificationRetryCommand) => Promise<void>} markRetry
 * @property {(runId: string) => Promise<Partial<NotificationJob>[]>} findDiagnosticsByRunId
 */

/**
 * @typedef {object} Repositories
 * @property {CertificationRunsRepository} certificationRuns
 * @property {RunEvidenceRepository} runEvidence
 * @property {NotificationJobsRepository} notificationJobs
 * @property {() => Promise<void>} ping
 */

module.exports = {};
