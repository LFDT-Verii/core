const env = require('env-var');
const { createOauthConfig } = require('@verii/auth');

const createConfig = (packageJson) => {
  const { genericConfig } = require('@verii/config');
  const { isTest } = genericConfig;

  const oauthConfig = createOauthConfig(env, genericConfig);
  const swaggerInfo = {
    info: {
      title: 'VNF Services Openapi',
      description:
        'Combined set of APIs for the organization registrar, phone & email verifier and the push notification gateway',
      version: '0.7.3',
    },
    tags: [
      { name: 'registrar_iam', description: 'VNF Registrar Users & Groups' },
      {
        name: 'registrar_organizations',
        description: 'VNF Registrar Organizations',
      },
    ],
    components: {
      securitySchemes: {
        'Registrar Token': {
          type: 'http',
          description:
            'Use a token given to you by the registrar to authenticate with the service.',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        RegistrarOAuth2: {
          type: 'oauth2',
          description: 'Login to the registrar',
          flows: {
            implicit: {
              ...oauthConfig,
              scopes: {
                'read:organizations':
                  'read-only calls to the registrar regarding organizations',
                'write:organizations':
                  'calls to the registrar regarding organizations',
                'read:users': 'read user information for an organization',
                'write:users':
                  'create and update user information for an organization',
                'admin:users': 'administer users',
                'admin:organizations': 'administer organizations',
                'events:trigger': 'be able to trigger events',
                'admin:credentialTypes': 'administer credential types',
                'write:credentialTypes': 'change credential types',
              },
            },
          },
        },
      },
    },
  };
  const sharedConfig = {
    ...genericConfig,
    swaggerInfo,
    customFastifyOptions: {
      http2: false,
    },
    version: packageJson.version,
    allowedCorsOrigins: env.get('ALLOWED_CORS_ORIGINS').default('').asArray(),
    sentryDsn: env.get('SENTRY_DSN').required(!isTest).asString(),
    enableProfiling: env.get('ENABLE_PROFILING').default('false').asBool(),
    enableSentryDebug: env.get('ENABLE_SENTRY_DEBUG').default('false').asBool(),
  };

  const registrarConfig = {
    rootDid: env.get('ROOT_DID').required(!isTest).asString(),
    rootAddress: env.get('ROOT_ADDRESS').required(!isTest).asString(),
    rootKid: env.get('ROOT_KID').required(!isTest).asString(),
    rootPrivateKey: env.get('ROOT_PRIVATE_KEY').required(!isTest).asString(),
    awsRegion: env.get('AWS_REGION').default('us-east-1').required().asString(),
    awsEndpoint: env.get('AWS_ENDPOINT').default('').asString(),
    auth0Domain: env.get('OAUTH0_DOMAIN').required(!isTest).asString(),
    auth0ManagementApiAudience: env
      .get('AUTH0_MANAGEMENT_API_AUDIENCE')
      .required()
      .asString(),
    auth0ClientId: env.get('OAUTH0_CLIENT_ID').required(!isTest).asString(),
    auth0ClientSecret: env
      .get('OAUTH0_CLIENT_SECRET')
      .required(!isTest)
      .asString(),
    auth0SuperuserRoleId: env
      .get('OAUTH0_SUPERUSER_ROLE_ID')
      .required(!isTest)
      .asString(),
    auth0ClientAdminRoleId: env
      .get('OAUTH0_CLIENT_ADMIN_ROLE_ID')
      .required(!isTest)
      .asString(),
    auth0ClientFinanceAdminRoleId: env
      .get('OAUTH0_CLIENT_FINANCE_ADMIN_ROLE_ID')
      .required(!isTest)
      .asString(),
    auth0ClientSystemUserRoleId: env
      .get('OAUTH0_CLIENT_SYSTEM_USER_ROLE_ID')
      .required(!isTest)
      .asString(),
    auth0Connection: env.get('AUTH0_CONNECTION').required(!isTest).asString(),
    registrarApiAudience: env
      .get('REGISTRAR_API_AUDIENCE')
      .default('https://registrar.velocitynetwork.foundation')
      .asString(),
    s3PresignedUrlExpiration: env
      .get('S3_PRESIGNED_URL_EXPIRATION')
      .default(3600)
      .asIntPositive(),
    libS3Bucket: env.get('LIB_S3_BUCKET').required(!isTest).asString(),
    libUrl: env.get('LIB_URL').required(!isTest).asString(),
  };

  return {
    ...sharedConfig,
    ...registrarConfig,
  };
};

module.exports = { createConfig };
