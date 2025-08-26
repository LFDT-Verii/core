const { pick } = require('lodash/fp');
const { validationPlugin } = require('@verii/validation');
const { corsPlugin, httpClientPlugin } = require('@verii/fastify-plugins');
const { sendEmailPlugin } = require('@verii/aws-clients');
const {
  authenticateVnfClientPlugin,
  rpcProviderPlugin,
} = require('@verii/base-contract-io');
const basicAuth = require('@fastify/basic-auth');
const { oauthPlugin, initBasicAuthValidate } = require('@verii/auth');
const {
  credentialTypesRegistrarEndpoints,
} = require('@verii/endpoints-credential-types-registrar');
const {
  organizationRegistrarEndpoints,
} = require('@verii/endpoints-organizations-registrar');
const {
  eventProcessingEndpoints,
} = require('@verii/endpoints-event-processing');

const initServer = (server) => {
  if (!server.config.isTest) {
    server
      .register(oauthPlugin, {
        domain: server.config.auth0Domain,
        audience: [
          server.config.registrarApiAudience,
          server.config.oauthAudienceTokenApi,
        ],
      })
      .register(authenticateVnfClientPlugin)
      .register(basicAuth, {
        validate: initBasicAuthValidate(
          server.config.basicAuthUsername,
          server.config.basicAuthPassword
        ),
      });
  }

  return server
    .register(rpcProviderPlugin)
    .register(corsPlugin, {
      wildcardRoutes: ['/api/v0.6/organizations/search-profiles'],
    })
    .register(sendEmailPlugin)
    .register(validationPlugin, {
      ajv: server.config.validationPluginAjvOptions,
    })
    .addHook('preValidation', async (req) => {
      req.getDocValidator = server.getDocValidator;
    })
    .register(httpClientPlugin, {
      name: 'fetch',
      options: pick(
        [
          'nodeEnv',
          'requestTimeout',
          'traceIdHeader',
          'useExistingGlobalAgent',
        ],
        server.config
      ),
    })
    .register(httpClientPlugin, {
      name: 'fineractFetch',
      options: {
        ...server.config,
        clientId: server.config.auth0ClientId,
        clientSecret: server.config.auth0ClientSecret,
        tokensEndpoint: server.config.vnfOAuthTokensEndpoint,
        audience: server.config.oauthAudienceFineractApi,
        scopes: server.config.oauthScopesFineractApi,
        prefixUrl: server.config.fineractUrl,
        customHeaders: {
          'fineract-platform-tenantid': 'default',
        },
      },
    })
    .register(httpClientPlugin, {
      name: 'secureMessagesFetch',
      options: {
        ...pick(
          ['nodeEnv', 'traceIdHeader', 'useExistingGlobalAgent'],
          server.config
        ),
        requestTimeout: 20000,
      },
    })
    .register(httpClientPlugin, {
      name: 'betterUptimeFetch',
      options: {
        ...server.config,
        requestTimeout: server.config.requestTimeoutBetterUptimeFetch,
        bearerToken: server.config.monitoringApiToken,
        prefixUrl: server.config.monitoringApiBaseUrl,
      },
    })
    .register(httpClientPlugin, {
      name: 'serviceVersionFetch',
      options: {
        ...server.config,
        requestTimeout: server.config.requestTimeoutBetterUptimeFetch,
      },
    })
    .register(credentialTypesRegistrarEndpoints)
    .register(organizationRegistrarEndpoints)
    .register(eventProcessingEndpoints);
};

module.exports = { initServer };
