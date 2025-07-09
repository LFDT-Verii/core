const env = require('env-var');
const { createOauthConfig } = require('@verii/auth');
const contractAbi = require('./abi.json');

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
    mongoSecret: env.get('MONGO_SECRET').required(!isTest).asString(),
    allowedCorsOrigins: env.get('ALLOWED_CORS_ORIGINS').default('').asArray(),
    sentryDsn: env.get('SENTRY_DSN').required(!isTest).asString(),
    enableProfiling: env.get('ENABLE_PROFILING').default('false').asBool(),
    enableSentryDebug: env.get('ENABLE_SENTRY_DEBUG').default('false').asBool(),
  };

  const registrarConfig = {
    contractAbi,
    rpcUrl: env
      .get('RPC_NODE_URL')
      .default('http://34.244.131.79:8547')
      .asString(),
    chainId: env.get('CHAIN_ID').default(2020).asInt(),
    rootDid: env.get('ROOT_DID').required(!isTest).asString(),
    rootAddress: env.get('ROOT_ADDRESS').required(!isTest).asString(),
    rootKid: env.get('ROOT_KID').required(!isTest).asString(),
    rootPrivateKey: env.get('ROOT_PRIVATE_KEY').required(!isTest).asString(),
    awsRegion: env.get('AWS_REGION').default('us-east-1').required().asString(),
    awsEndpoint: env.get('AWS_ENDPOINT').default('').asString(),
    accountRulesContractAddress: env
      .get('ACCOUNT_RULES_CONTRACT_ADDRESS')
      .default('')
      .asString(),
    couponContractAddress: env
      .get('COUPON_CONTRACT_ADDRESS')
      .required()
      .asString(),
    permissionsContractAddress: env
      .get('PERMISSIONS_CONTRACT_ADDRESS')
      .required()
      .asString(),
    metadataRegistryContractAddress: env
      .get('METADATA_REGISTRY_CONTRACT_ADDRESS')
      .required()
      .asString(),
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
    registrarAppUiUrl: env.get('REGISTRAR_APP_UI_URL').required().asString(),
    registrarSupportEmail: env
      .get('REGISTRAR_SUPPORT_EMAIL')
      .required()
      .asString(),
    noReplyEmail: env
      .get('NO_REPLY_EMAIL')
      .default('no-reply@velocitynetwork.foundation')
      .asString(),
    registrarApiAudience: env
      .get('REGISTRAR_API_AUDIENCE')
      .default('https://registrar.velocitynetwork.foundation')
      .asString(),
    vnfClientId: env.get('VNF_OAUTH_CLIENT_ID').required(!isTest).asString(),
    vnfClientSecret: env
      .get('VNF_OAUTH_CLIENT_SECRET')
      .required(!isTest)
      .asString(),
    vnfOAuthTokensEndpoint: oauthConfig.refreshUrl,
    registrarInvitationTtl: env
      .get('REGISTRAR_INVITATION_TTL')
      .default(2419200)
      .asIntPositive(),
    registrarResendInvitationTtl: env
      .get('REGISTRAR_INVITATION_TTL')
      .default(259200)
      .asIntPositive(),
    inviteUrl: env.get('INVITE_URL').required(!isTest).asString(),
    mediaUrl: env.get('MEDIA_URL').required(!isTest).asString(),
    mediaS3Bucket: env.get('MEDIA_S3_BUCKET').required(!isTest).asString(),
    s3PresignedUrlExpiration: env
      .get('S3_PRESIGNED_URL_EXPIRATION')
      .default(3600)
      .asIntPositive(),
    mediaPutAccessKey: env
      .get('MEDIA_PUT_ACCESS_KEY')
      .required(!isTest)
      .asString(),
    mediaPutAccessKeyId: env
      .get('MEDIA_PUT_ACCESS_KEY_ID')
      .required(!isTest)
      .asString(),
    vnfHeaderSignatureSigningKey: env
      .get('VNF_HEADER_SIGNATURE_SIGNING_KEY')
      .required()
      .asString(),
    organizationCreationEmailCcList: env
      .get('ORGANIZATION_CREATION_EMAIL_CC_LIST')
      .required()
      .asArray(','),
    libS3Bucket: env.get('LIB_S3_BUCKET').required(!isTest).asString(),
    libUrl: env.get('LIB_URL').required(!isTest).asString(),
    custodiedDidWebHost: env.get('CUSTODIED_DID_WEB_HOST').asString(),
    kmsPluginModule: env
      .get('KMS_PLUGIN_MODULE')
      .default('@verii/db-kms')
      .asString(),
    serviceConsentVersion: env
      .get('SERVICE_CONSENT_VERSION')
      .default('1')
      .asIntPositive(),
    kmsPlugin: env.get('KMS_PLUGIN').default('dbKmsPlugin').asString(),
  };

  const monitoringEnvConfig = {
    monitoringApiBaseUrl: env
      .get('MONITORING_API_BASE_URL')
      .required()
      .asString(),
    monitoringApiToken: env.get('MONITORING_API_TOKEN').required().asString(),
    servicesStatusPageId: env
      .get('MONITORING_SERVICES_PAGE_ID')
      .required()
      .asString(),
    nodesStatusPageId: env
      .get('MONITORING_NODE_OPERATORS_PAGE_ID')
      .required()
      .asString(),
    requestTimeoutBetterUptimeFetch: env
      .get('REQUEST_TIMEOUT_BETTER_UPTIME_FETCH')
      .default('8000')
      .asInt(),
  };

  const tokenConfig = {
    fineractUrl: env.get('FINERACT_URL').required().asString(),
    tokenWalletBaseUrl: env.get('TOKEN_WALLET_BASE_URL').required().asString(),
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
  };

  const signatoryConfig = {
    signatoryVnfEmail: env
      .get('SIGNATORY_VNF_EMAIL')
      .required()
      .asEmailString(),
    signatoryLinkResend: env
      .get('SIGNATORY_LINK_RESEND')
      .default('1440')
      .asIntPositive(),
    signatoryLinkExpiration: env
      .get('SIGNATORY_LINK_EXPIRATION')
      .default('1440')
      .asIntPositive(),
    signatoryConsentVersion: env
      .get('SIGNATORY_CONSENT_VERSION')
      .default('1')
      .asIntPositive(),
    signatoryMaxReminderCount: env
      .get('SIGNATORY_MAX_REMINDER_COUNT')
      .default('10')
      .asIntPositive(),
  };

  return {
    ...sharedConfig,
    ...registrarConfig,
    ...monitoringEnvConfig,
    ...tokenConfig,
    ...signatoryConfig,
  };
};

module.exports = { createConfig };
