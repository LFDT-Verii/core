/*
 * Copyright 2024 Velocity Team
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

const fp = require('fastify-plugin');
const { addSeconds } = require('date-fns/fp');
const { initHttpClient } = require('@verii/http-client');

const TOKEN_EXPIRATION_SAFE_BUFFER = 5;

const isTokenCached = (tokensCache, audience) =>
  tokensCache.get(audience) && tokensCache.get(audience).expiresAt > new Date();

const initAuthenticateVnfClient = (fastify) => {
  return async ({ audience, clientId, clientSecret }, req) => {
    const request = initHttpClient(fastify.config)(req);

    if (!isTokenCached(fastify.vnfAuthTokensCache, audience)) {
      const authResult = await request
        .post(fastify.config.vnfOAuthTokensEndpoint, {
          form: {
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            audience,
          },
        })
        .json();

      // eslint-disable-next-line better-mutation/no-mutation
      fastify.vnfAuthTokensCache.set(audience, {
        accessToken: authResult.access_token,
        expiresAt: addSeconds(
          authResult.expires_in - TOKEN_EXPIRATION_SAFE_BUFFER,
          new Date()
        ),
      });
    }

    return fastify.vnfAuthTokensCache.get(audience).accessToken;
  };
};
const initAuthenticateVnfBlockchainClient = (fastify, req) => {
  const authenticateVnfClient = initAuthenticateVnfClient(fastify);
  return () =>
    authenticateVnfClient(
      {
        audience: fastify.config.blockchainApiAudience,
        clientId: fastify.config.vnfClientId,
        clientSecret: fastify.config.vnfClientSecret,
      },
      req
    );
};

const initAuthenticateVnfClientPlugin = (fastify, options, next) => {
  fastify
    .decorate('vnfAuthTokensCache', new Map())
    .decorateRequest('vnfBlockchainAuthenticate', null)
    .addHook('preValidation', async (req) => {
      req.vnfBlockchainAuthenticate = initAuthenticateVnfBlockchainClient(
        fastify,
        req
      );
    });
  next();
};

module.exports = {
  initAuthenticateVnfClient,
  initAuthenticateVnfBlockchainClient,
  initAuthenticateVnfClientPlugin,
  authenticateVnfClientPlugin: fp(initAuthenticateVnfClientPlugin, {
    fastify: '>=2.0.0',
    name: 'velocityIdp',
  }),
};
