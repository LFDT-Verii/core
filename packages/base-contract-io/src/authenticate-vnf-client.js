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
const { initHttpClient } = require('@verii/http-client');
const { isEmpty, isString } = require('lodash/fp');
const once = require('lodash/once');

const TOKEN_EXPIRATION_SAFE_BUFFER_MS = 5000;
const DEFAULT_OAUTH_CREDS_CACHE_KEY = 'default';

const buildTokenCacheKey = (audience, resolverCacheKey) =>
  JSON.stringify([audience, resolverCacheKey]);

const assertNonEmptyString = (value, field) => {
  if (!isString(value) || isEmpty(value)) {
    throw new TypeError(`VNF OAuth creds resolver ${field} must be non-empty`);
  }
};

const pruneExpiredTokens = (tokensCache, now) => {
  for (const [key, token] of tokensCache) {
    if (!(token.expiresAt > now)) {
      tokensCache.delete(key);
    }
  }
};

const initAuthenticateVnfClient = (fastify) => {
  return async (
    {
      audience,
      cacheKey = DEFAULT_OAUTH_CREDS_CACHE_KEY,
      clientId,
      clientSecret,
      loadOAuthCreds = async () => ({ clientId, clientSecret }),
    },
    req,
  ) => {
    assertNonEmptyString(cacheKey, 'cacheKey');

    const tokenCacheKey = buildTokenCacheKey(audience, cacheKey);
    const cachedToken = fastify.vnfAuthTokensCache.get(tokenCacheKey);
    const now = Date.now();

    if (cachedToken?.expiresAt > now) {
      return cachedToken.accessToken;
    }

    pruneExpiredTokens(fastify.vnfAuthTokensCache, now);
    const oauthCreds = await loadOAuthCreds();
    const { clientId: oauthClientId, clientSecret: oauthClientSecret } =
      oauthCreds ?? {};
    assertNonEmptyString(oauthClientId, 'clientId');
    assertNonEmptyString(oauthClientSecret, 'clientSecret');
    const httpClient = initHttpClient(fastify.config)(req);
    const response = await httpClient.post(
      fastify.config.vnfOAuthTokensEndpoint,
      {
        grant_type: 'client_credentials',
        client_id: oauthClientId,
        client_secret: oauthClientSecret,
        audience,
      },
    );
    const authResult = await response.json();
    const token = {
      accessToken: authResult.access_token,
      expiresAt:
        Date.now() +
        authResult.expires_in * 1000 -
        TOKEN_EXPIRATION_SAFE_BUFFER_MS,
    };

    fastify.vnfAuthTokensCache.set(tokenCacheKey, token);

    return token.accessToken;
  };
};

/**
 * @typedef {object} OAuthCreds
 * @property {string} clientId
 * @property {string} clientSecret
 */

/**
 * @typedef {object} OAuthCredsResolution
 * @property {string} cacheKey A stable, non-secret token cache identity
 * @property {() => Promise<OAuthCreds>} loadOAuthCreds Lazy OAuth creds loader
 */

/**
 * @param {*} fastify Fastify instance
 * @returns {() => Promise<OAuthCredsResolution>} the default OAuth creds
 * resolver
 */
const initDefaultVnfClientOAuthCredsResolver = (fastify) => async () => ({
  cacheKey: DEFAULT_OAUTH_CREDS_CACHE_KEY,
  loadOAuthCreds: async () => ({
    clientId: fastify.config.vnfClientId,
    clientSecret: fastify.config.vnfClientSecret,
  }),
});

const initAuthenticateVnfBlockchainClient = (fastify, req) => {
  const authenticateVnfClient = initAuthenticateVnfClient(fastify);
  const resolveVnfClientOAuthCreds = once(() =>
    fastify.resolveVnfClientOAuthCreds(req),
  );
  return async () => {
    const { cacheKey, loadOAuthCreds } =
      (await resolveVnfClientOAuthCreds()) ?? {};

    return authenticateVnfClient(
      {
        audience: fastify.config.blockchainApiAudience,
        cacheKey,
        loadOAuthCreds,
      },
      req,
    );
  };
};

const initAuthenticateVnfClientPlugin = (fastify, options, next) => {
  if (!fastify.hasDecorator('resolveVnfClientOAuthCreds')) {
    if (!fastify.config.vnfClientId) {
      throw new Error('fastify.config.vnfClientId is required');
    }
    if (!fastify.config.vnfClientSecret) {
      throw new Error('fastify.config.vnfClientSecret is required');
    }

    fastify.decorate(
      'resolveVnfClientOAuthCreds',
      initDefaultVnfClientOAuthCredsResolver(fastify),
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
