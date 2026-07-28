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

const buildTokenCacheKey = (audience, resolverCacheKey) =>
  JSON.stringify([audience, resolverCacheKey]);

const pruneExpiredTokens = (tokensCache) => {
  const now = new Date();
  for (const [key, token] of tokensCache) {
    if (!(token.expiresAt > now)) {
      tokensCache.delete(key);
    }
  }
};

const initAuthenticateVnfClient = (fastify) => {
  return async ({ audience, cacheKey, loadCredentials }, req) => {
    if (typeof cacheKey !== 'string' || cacheKey.length === 0) {
      throw new TypeError('VNF credential resolver cacheKey must be non-empty');
    }
    if (typeof loadCredentials !== 'function') {
      throw new TypeError(
        'VNF credential resolver loadCredentials must be a function',
      );
    }

    pruneExpiredTokens(fastify.vnfAuthTokensCache);
    const tokenCacheKey = buildTokenCacheKey(audience, cacheKey);
    const cachedToken = fastify.vnfAuthTokensCache.get(tokenCacheKey);

    if (cachedToken) {
      return cachedToken.accessToken;
    }

    const { clientId, clientSecret } = await loadCredentials();
    const httpClient = initHttpClient(fastify.config)(req);
    const response = await httpClient.post(
      fastify.config.vnfOAuthTokensEndpoint,
      {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        audience,
      },
    );
    const authResult = await response.json();
    const token = {
      accessToken: authResult.access_token,
      expiresAt: addSeconds(
        authResult.expires_in - TOKEN_EXPIRATION_SAFE_BUFFER,
        new Date(),
      ),
    };

    fastify.vnfAuthTokensCache.set(tokenCacheKey, token);

    return token.accessToken;
  };
};

const initDefaultVnfClientCredentialsResolver = (fastify) => async () => ({
  cacheKey: `config:${fastify.config.vnfClientId}`,
  loadCredentials: async () => ({
    clientId: fastify.config.vnfClientId,
    clientSecret: fastify.config.vnfClientSecret,
  }),
});

const initAuthenticateVnfBlockchainClient = (fastify, req) => {
  const authenticateVnfClient = initAuthenticateVnfClient(fastify);
  return async () => {
    const resolution = await fastify.resolveVnfClientCredentials(req);

    return authenticateVnfClient(
      {
        audience: fastify.config.blockchainApiAudience,
        ...resolution,
      },
      req,
    );
  };
};

const initAuthenticateVnfClientPlugin = (fastify, options, next) => {
  if (!fastify.hasDecorator('resolveVnfClientCredentials')) {
    if (!fastify.config.vnfClientId) {
      throw new Error('fastify.config.vnfClientId is required');
    }
    if (!fastify.config.vnfClientSecret) {
      throw new Error('fastify.config.vnfClientSecret is required');
    }

    fastify.decorate(
      'resolveVnfClientCredentials',
      initDefaultVnfClientCredentialsResolver(fastify),
    );
  }

  fastify
    .decorate('vnfAuthTokensCache', new Map())
    .decorateRequest('vnfBlockchainAuthenticate', null)
    .addHook('preValidation', async (req) => {
      req.vnfBlockchainAuthenticate = initAuthenticateVnfBlockchainClient(
        fastify,
        req,
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
