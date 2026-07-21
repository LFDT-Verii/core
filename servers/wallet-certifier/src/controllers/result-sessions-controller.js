const {
  loadResultRun,
  resolveResultRole,
} = require('../services/result-capabilities');

const sessionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['runId', 'token'],
  properties: {
    runId: { type: 'string', minLength: 1, maxLength: 100 },
    token: { type: 'string', minLength: 20, maxLength: 200 },
  },
};

const cookieDetails = (run, role, token, config, now) => {
  const applicant = role === 'APPLICANT';
  return {
    name: `${applicant ? 'wc_result' : 'wc_support'}_${run.runId}`,
    value: token,
    options: {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      path: applicant
        ? `/api/runs/${run.runId}`
        : `/api/support/runs/${run.runId}`,
      maxAge: Math.max(
        0,
        Math.floor(
          (run.resultCapabilityExpiresAt.getTime() - new Date(now).getTime()) /
            1000,
        ),
      ),
    },
  };
};

module.exports = async (fastify, context) => {
  fastify.post(
    '/result-sessions',
    { schema: { body: sessionSchema } },
    async (request, reply) => {
      const run = await loadResultRun(request.body.runId, context);
      const role = resolveResultRole(run, request.body.token, context);
      const cookie = cookieDetails(
        run,
        role,
        request.body.token,
        context.config,
        context.now(),
      );
      reply.setCookie(cookie.name, cookie.value, cookie.options);
      return reply.status(204).send();
    },
  );
};
