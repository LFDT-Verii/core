const { createRun } = require('../services/create-run');
const { startRun } = require('../services/start-run');

const runInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['walletId', 'applicantName', 'applicantEmail', 'capability'],
  properties: {
    walletId: { type: 'string', minLength: 1, maxLength: 300 },
    applicantName: { type: 'string', minLength: 1, maxLength: 120 },
    applicantEmail: { type: 'string', format: 'email', maxLength: 254 },
    capability: { type: 'string', enum: ['ISSUING', 'VERIFICATION'] },
  },
};

const interactionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'state',
    'redirectUrl',
    'qrValue',
    'actionDeadline',
    'absoluteDeadline',
  ],
  properties: {
    state: { type: 'string' },
    redirectUrl: { type: 'string' },
    qrValue: { type: 'string' },
    actionDeadline: { type: 'string', format: 'date-time' },
    absoluteDeadline: { type: 'string', format: 'date-time' },
  },
};

const bearerToken = (authorization = '') => {
  const [scheme, token] = authorization.split(' ');
  return scheme === 'Bearer' ? token : undefined;
};

module.exports = async (fastify, context) => {
  fastify.post(
    '/runs',
    {
      schema: {
        body: runInputSchema,
        response: {
          201: {
            type: 'object',
            additionalProperties: false,
            required: ['runId', 'interactionToken', 'capabilityExpiresAt'],
            properties: {
              runId: { type: 'string' },
              interactionToken: { type: 'string' },
              capabilityExpiresAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await createRun(request.body, context);
      return reply.status(201).send(result);
    },
  );

  fastify.post(
    '/runs/:runId/start',
    {
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['runId'],
          properties: { runId: { type: 'string', minLength: 1 } },
        },
        response: { 200: interactionSchema },
      },
    },
    async (request) =>
      startRun(
        request.params.runId,
        bearerToken(request.headers.authorization),
        context,
      ),
  );
};
