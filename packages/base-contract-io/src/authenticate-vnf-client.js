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
const once = require('lodash/once');

const TOKEN_EXPIRATION_SAFE_BUFFER = 5;

const buildTokenCacheKey = (audience, resolverCacheKey) =>
  JSON.stringify([audience, resolverCacheKey]);

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.length > 0;

const assertNonEmptyString = (value, field) => {
  if (!isNonEmptyString(value)) {
    throw new TypeError(`VNF credential resolver ${field} must be non-empty`);
  }
};

const normalizeCredentialSource = ({
  cacheKey,
  loadCredentials,
  clientId,
  clientSecret,
}) => {
  const usesPublishedCredentials =
    loadCredentials == null && (clientId != null || clientSecret != null);

  return usesPublishedCredentials
    ? {
        cacheKey: `client:${clientId}`,
        loadCredentials: async () => ({ clientId, clientSecret }),
      }
    : { cacheKey, loadCredentials };
};

const pruneExpiredTokens = (tokensCache) => {
  const now = new Date();
  for (const [key, token] of tokensCache) {
    if (!(token.expiresAt > now)) {
      tokensCache.delete(key);
    }
  }
};

const initAuthenticateVnfClient = (fastify) => {
  return async ({ audience, ...credentialSource }, req) => {
    const { cacheKey, loadCredentials } =
      normalizeCredentialSource(credentialSource);
    assertNonEmptyString(cacheKey, 'cacheKey');
    if (typeof loadCredentials !== 'function') {
      throw new TypeError(
        'VNF credential resolver loadCredentials must be a function',
      );
    }

    const tokenCacheKey = buildTokenCacheKey(audience, cacheKey);
    const cachedToken = fastify.vnfAuthTokensCache.get(tokenCacheKey);

    if (cachedToken?.expiresAt > new Date()) {
      return cachedToken.accessToken;
    }

    pruneExpiredTokens(fastify.vnfAuthTokensCache);
    const resolvedCredentials = await loadCredentials();
    assertNonEmptyString(resolvedCredentials?.clientId, 'clientId');
    assertNonEmptyString(resolvedCredentials?.clientSecret, 'clientSecret');
    const httpClient = initHttpClient(fastify.config)(req);
    const response = await httpClient.post(
      fastify.config.vnfOAuthTokensEndpoint,
      {
        grant_type: 'client_credentials',
        client_id: resolvedCredentials.clientId,
        client_secret: resolvedCredentials.clientSecret,
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
  const resolveVnfClientCredentials = once(() =>
    fastify.resolveVnfClientCredentials(req),
  );
  return async () => {
    const { cacheKey, loadCredentials } =
      (await resolveVnfClientCredentials()) ?? {};

    return authenticateVnfClient(
      {
        audience: fastify.config.blockchainApiAudience,
        cacheKey,
        loadCredentials,
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
