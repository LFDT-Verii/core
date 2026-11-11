const { createOauthConfig } = require('@verii/auth');
const contractAbi = require('./abi.json');

const createConfig = (packageJson) => {
  const {
    createBlockchainConfig,
    genericConfig,
    networkEnv,
  } = require('@verii/config');
  const { isTest } = genericConfig;
  const env = networkEnv();
  const oauthConfig = createOauthConfig(env, genericConfig);
  const swaggerInfo = {
    info: {
      title: 'VNF Event Processing',
      description: 'VNF Event Processing gateway',
      version: '0.7.3',
    },
    tags: [
      {
        name: 'vnf_event_processing',
        description: 'VNF Network Event Processing',
      },
    ],
    components: {
      securitySchemes: {
        BasicAuth: {
          type: 'http',
          scheme: 'basic',
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
    serviceName: packageJson.name,
  };

  const registrarConfig = {
    ...createBlockchainConfig(),
    contractAbi,
    rootDid: env.get('ROOT_DID').required(!isTest).asString(),
    rootKid: env.get('ROOT_KID').required(!isTest).asString(),
    rootPrivateKey: env.get('ROOT_PRIVATE_KEY').required(!isTest).asString(),
    awsRegion: env.get('AWS_REGION').default('us-east-1').required().asString(),
    awsEndpoint: env.get('AWS_ENDPOINT').default('').asString(),
  };

  const tokenConfig = {
    fineractUrl: env.get('FINERACT_URL').required().asString(),
    oauthAudienceFineractApi: env
      .get('OAUTH_AUDIENCE_FINERACT_API')
      .default('https://fineract.velocitycareerlabs.io')
      .asString(),
    oauthAudienceTokenApi: env
      .get('OAUTH_AUDIENCE_TOKEN_API')
      .default('https://token.velocitycareerlabs.io')
      .asString(),
    oauthScopesFineractApi: env
      .get('OAUTH_SCOPES_FINERACT_API')
      .default('fineract:broker fineract:registrar')
      .asString(),
    issuerRewardAmount: env
      .get('ISSUER_REWARD_AMOUNT')
      .required()
      .asFloatPositive(),
    caoRewardAmount: env.get('CAO_REWARD_AMOUNT').required().asFloatPositive(),
    vnfRewardDispersalAccountId: env
      .get('VNF_REWARD_DISPERSAL_ACCOUNT_ID')
      .required()
      .asString(),
    dynamoDbTableEventBlock: env
      .get('DYNAMO_DB_TABLE_EVENT_BLOCK')
      .required()
      .asString(),
  };

  const healthProbesConfig = {
    basicAuthUsername: env
      .get('BASIC_AUTH_USERNAME')
      .required(!isTest)
      .asString(),
    basicAuthPassword: env
      .get('BASIC_AUTH_PASSWORD')
      .required(!isTest)
      .asString(),
  };

  return {
    ...sharedConfig,
    ...registrarConfig,
    ...tokenConfig,
    ...healthProbesConfig,
  };
};

module.exports = { createConfig };
