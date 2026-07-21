const { createRun } = require('../services/create-run');
const { reconcileRun } = require('../services/reconcile-run');
const { loadAuthorizedRun, startRun } = require('../services/start-run');
const { RunStates } = require('../domain/states');

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

const baseRunResponse = (run) => ({
  runId: run.runId,
  capability: run.capability,
  state: run.state,
  actionDeadline: run.actionDeadline?.toISOString(),
  absoluteDeadline: run.absoluteDeadline?.toISOString(),
});

const loadEvidence = (run, context) =>
  context.db.collection('runEvidence').findOne({ runId: run.runId });

const isVerificationResult = (run) =>
  run.capability === 'VERIFICATION' &&
  [RunStates.PASSED, RunStates.FAILED].includes(run.state);

const presentRun = async (run, context) => {
  const response = baseRunResponse(run);
  if (run.state === RunStates.PREPARING_DISCLOSURE) {
    const evidence = await loadEvidence(run, context);
    return { ...response, setupCredential: evidence.issuedCredential };
  }
  if (isVerificationResult(run)) {
    const evidence = await loadEvidence(run, context);
    return {
      ...response,
      result: {
        ...evidence.presentationResult,
        completedAt: run.completedAt.toISOString(),
      },
    };
  }
  if (run.state === RunStates.PASSED) {
    const evidence = await loadEvidence(run, context);
    return {
      ...response,
      result: {
        passed: true,
        completedAt: run.completedAt.toISOString(),
        credential: evidence.issuedCredential,
      },
    };
  }
  return run.failure ? { ...response, failure: run.failure } : response;
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

  fastify.get(
    '/runs/:runId',
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
    async (request) => {
      const token = bearerToken(request.headers.authorization);
      const authorized = await loadAuthorizedRun(
        request.params.runId,
        token,
        context,
      );
      const run = await reconcileRun(authorized, context);
      return presentRun(run, context);
    },
  );
};
