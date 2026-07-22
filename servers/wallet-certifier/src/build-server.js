const Fastify = require('fastify');
const helmet = require('@fastify/helmet');
const cookie = require('@fastify/cookie');
const rateLimit = require('@fastify/rate-limit');
const configController = require('./controllers/config-controller');
const walletsController = require('./controllers/wallets-controller');
const runsController = require('./controllers/runs-controller');
const resultSessionsController = require('./controllers/result-sessions-controller');
const supportController = require('./controllers/support-controller');
const { createRegistrarClient } = require('./adapters/registrar-client');
const { createHubClient } = require('./adapters/hub-client');
const { createEmailSender } = require('./adapters/email-sender');

const { LogController } = Fastify;

const buildServer = async ({
  config,
  repositories,
  registrarClient = createRegistrarClient({ baseUrl: config.registrarUrl }),
  hubClient = createHubClient({
    baseUrl: config.hubUrl,
    operatorToken: config.hubOperatorToken,
    tenantId: config.tenantId,
  }),
  now = () => new Date(),
  tokenFactory,
  sendEmail = createEmailSender({
    awsRegion: config.awsRegion,
    awsEndpoint: config.awsEndpoint,
  }),
  loggerStream,
}) => {
  const server = Fastify({
    bodyLimit: config.bodyLimit,
    logController: new LogController({ disableRequestLogging: true }),
    logger: {
      level: config.logSeverity,
      ...(loggerStream ? { stream: loggerStream } : {}),
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
      ],
    },
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: false,
      },
    },
  });

  server.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        error: 'request_validation_failed',
        message: 'Request validation failed.',
      });
    }
    if (error.code === 'REGISTRAR_UNAVAILABLE') {
      return reply.status(502).send({
        error: 'wallet_search_unavailable',
        message: 'Wallet search is temporarily unavailable.',
      });
    }
    if (error.publicCode) {
      return reply.status(error.statusCode).send({
        error: error.publicCode,
        message: error.message,
      });
    }
    if (error.code === 'HUB_UNAVAILABLE') {
      return reply.status(502).send({
        error: 'credentialing_hub_unavailable',
        message: 'Credentialing Hub is temporarily unavailable.',
      });
    }
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Try again shortly.',
      });
    }
    request.log.error({ errorCode: 'internal_error' }, 'Request failed');
    return reply.status(500).send({
      error: 'internal_error',
      message: 'The request could not be completed.',
    });
  });

  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  });
  await server.register(cookie);
  await server.register(configController, {
    prefix: '/api',
    config,
    repositories,
  });
  await server.register(walletsController, {
    prefix: '/api',
    registrarClient,
  });
  await server.register(async (runServer) => {
    await runServer.register(rateLimit, { global: false });
    await runServer.register(runsController, {
      prefix: '/api',
      config,
      repositories,
      registrarClient,
      hubClient,
      now,
      tokenFactory,
      sendEmail,
    });
  });
  await server.register(resultSessionsController, {
    prefix: '/api',
    config,
    repositories,
    now,
  });
  await server.register(supportController, {
    prefix: '/api',
    repositories,
  });

  return server;
};

module.exports = { buildServer };
