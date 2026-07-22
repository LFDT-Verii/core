const { loadSupportDiagnostics } = require('../services/support-diagnostics');

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
      const run = await loadSupportDiagnostics(
        request.params.runId,
        context.repositories,
      );
      if (!run) {
        return reply.status(404).send({
          error: 'run_not_found',
          message: 'Certification run not found.',
        });
      }
      return run;
    },
  );
};
