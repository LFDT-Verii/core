const { loadSupportRun } = require('../services/support-run');

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
      const run = await loadSupportRun(request.params.runId, context.db);
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
