const { genericConfig } = require('@verii/config');
const env = require('env-var');
const packageJson = require('../../package.json');

const { isTest } = genericConfig;

const swaggerConfig = {
  swaggerInfo: {
    info: {
      title: 'Mock Vendor Openapi',
      description:
        'APIs for triggering the mock vendor. (eg. creating offers async, etc)',
      version: '0.7.3',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
};
module.exports = {
  ...genericConfig,
  version: packageJson.version,
  adminUserName: env.get('ADMIN_USER_NAME').required(!isTest).asString(),
  agentUrl: env.get('AGENT_URL').required().asString(),
  secret: env.get('SECRET').required(!isTest).asString(),
  bearerToken: env.get('BEARER_TOKEN').asString(),
  ...swaggerConfig,
  customFastifyOptions: {
    http2: false,
  },
  sentryDsn: env.get('SENTRY_DSN').required(!isTest).asString(),
  enableProfiling: env.get('ENABLE_PROFILING').default('false').asBool(),
  enableSentryDebug: env.get('ENABLE_SENTRY_DEBUG').default('false').asBool(),
  omitOfferId: env.get('OMIT_OFFER_ID').default('false').asBool(),
  noOffers200: env.get('NO_OFFERS_200').default('true').asBool(),
  vnfHeaderSignatureVerificationKey: env
    .get('VNF_HEADER_SIGNATURE_VERIFICATION_KEY')
    .required()
    .asString(),
  generateOffersDelaySec: env
    .get('GENERATE_OFFERS_DELAY_SEC')
    .default(0)
    .asInt(),
};
