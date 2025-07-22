/*
 * Copyright 2025 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const { validationPlugin } = require('@verii/validation');
const {
  corsPlugin,
  requestPlugin,
} = require('@verii/fastify-plugins');
const { sendEmailPlugin } = require('@verii/aws-clients');
const {
  authenticateVnfClientPlugin,
  rpcProviderPlugin,
} = require('@verii/base-contract-io');
const { oauthPlugin } = require('@verii/auth');
const credentialTypesRepoPlugin = require('@verii/endpoints-credential-types-registrar/src/entities/credential-types/repos/repo');
const {
  organizationRegistrarEndpoints,
} = require('./organizations-registrar-endpoints');

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
      .register(authenticateVnfClientPlugin);
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
    .register(requestPlugin, {
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
    .register(requestPlugin, {
      name: 'betterUptimeFetch',
      options: {
        ...server.config,
        requestTimeout: server.config.requestTimeoutBetterUptimeFetch,
        bearerToken: server.config.monitoringApiToken,
        prefixUrl: server.config.monitoringApiBaseUrl,
      },
    })
    .register(requestPlugin, {
      name: 'serviceVersionFetch',
      options: {
        ...server.config,
        requestTimeout: server.config.requestTimeoutBetterUptimeFetch,
      },
    })
    .register(credentialTypesRepoPlugin)
    .register(organizationRegistrarEndpoints);
};

module.exports = { initServer };
