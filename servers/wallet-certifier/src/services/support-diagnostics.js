const notificationProjection = ({
  role,
  status,
  attemptCount,
  lastErrorCode,
  providerMessageId,
  sentAt,
  updatedAt,
}) => ({
  role,
  status,
  attemptCount,
  lastErrorCode,
  providerMessageId,
  sentAt,
  updatedAt,
});

const projectSupportDiagnostics = (run, notifications) => ({
  audience: 'SUPPORT',
  runId: run.runId,
  environmentName: run.environmentName,
  capability: run.capability,
  state: run.state,
  walletId: run.walletId,
  walletName: run.walletName,
  walletOrganizationId: run.walletOrganizationId,
  walletOrganizationName: run.walletOrganizationName,
  depotId: run.depotId,
  setupCredentialId: run.setupCredentialId,
  presentationId: run.presentationId,
  exchangeId: run.exchangeId,
  resultSummary: run.resultSummary,
  failure: run.failure,
  revision: run.revision,
  reconcileFailures: run.reconcileFailures,
  lastReconcileErrorCode: run.lastReconcileErrorCode,
  journal: run.journal,
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
  completedAt: run.completedAt,
  notifications: notifications.map(notificationProjection),
});

const loadSupportDiagnostics = async (runId, repositories, existingRun) => {
  const [run, notifications] = await Promise.all([
    existingRun ?? repositories.certificationRuns.findByRunId(runId),
    repositories.notificationJobs.findDiagnosticsByRunId(runId),
  ]);
  return run ? projectSupportDiagnostics(run, notifications) : undefined;
};

module.exports = { loadSupportDiagnostics, projectSupportDiagnostics };
