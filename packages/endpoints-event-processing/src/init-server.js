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
const {
  authenticateVnfClientPlugin,
  rpcProviderPlugin,
} = require('@verii/base-contract-io');
const basicAuth = require('@fastify/basic-auth');
const {
  oauthPlugin,
  initBasicAuthValidate,
} = require('@verii/auth');
const { requestPlugin } = require('@verii/fastify-plugins');
const { eventProcessingEndpoints } = require('./event-processing-endpoints');

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
    .register(eventProcessingEndpoints);
};

module.exports = { initServer };
