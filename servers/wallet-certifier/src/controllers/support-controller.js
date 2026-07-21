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

const runProjection = (run, notifications) => ({
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

module.exports = async (fastify, context) => {
  fastify.get(
    '/support/runs/:runId',
    {
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['runId'],
          properties: { runId: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const [run, notifications] = await Promise.all([
        context.db
          .collection('certificationRuns')
          .findOne({ runId: request.params.runId }),
        context.db
          .collection('notificationJobs')
          .find({ runId: request.params.runId }, { sort: { role: 1 } })
          .toArray(),
      ]);
      if (!run) {
        return reply.status(404).send({
          error: 'run_not_found',
          message: 'Certification run not found.',
        });
      }
      return runProjection(run, notifications);
    },
  );
};
