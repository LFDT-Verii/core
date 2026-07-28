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
const { after, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const initHttpClient = mock.fn();
mock.module('@verii/http-client', { namedExports: { initHttpClient } });

const {
  initAuthenticateVnfClient,
  initAuthenticateVnfClientPlugin,
} = require('../src/authenticate-vnf-client');

const TOKEN_ENDPOINT = 'https://auth.velocitynetwork.test/oauth/token';
const BLOCKCHAIN_AUDIENCE = 'https://velocitynetwork.node';

const createFastify = (config = {}) => {
  const hooks = new Map();
  const fastify = {
    config: {
      vnfClientId: 'config-client',
      vnfClientSecret: 'config-secret',
      vnfOAuthTokensEndpoint: TOKEN_ENDPOINT,
      blockchainApiAudience: BLOCKCHAIN_AUDIENCE,
      ...config,
    },
    decorate(name, value) {
      this[name] = value;
      return this;
    },
    hasDecorator(name) {
      return Object.hasOwn(this, name);
    },
    decorateRequest() {
      return this;
    },
    addHook(name, hook) {
      hooks.set(name, hook);
      return this;
    },
    runPreValidation: async (request) => {
      await hooks.get('preValidation')(request);
    },
  };

  return fastify;
};

const registerPlugin = async (fastify) =>
  new Promise((resolve, reject) => {
    try {
      initAuthenticateVnfClientPlugin(fastify, {}, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });

const invokeRequestAuthentication = async (fastify, request = {}) => {
  await fastify.runPreValidation(request);
  return request.vnfBlockchainAuthenticate();
};

describe('VNF Identity Provider Authentication', () => {
  const tokenResponses = [];
  const post = mock.fn(async () => ({
    json: async () => tokenResponses.shift(),
  }));
  let fastify;
  let authenticateVnfClient;

  beforeEach(() => {
    initHttpClient.mock.resetCalls();
    post.mock.resetCalls();
    tokenResponses.length = 0;
    initHttpClient.mock.mockImplementation(() => () => ({ post }));
    fastify = createFastify();
    fastify.vnfAuthTokensCache = new Map();
    authenticateVnfClient = initAuthenticateVnfClient(fastify);
  });

  after(() => {
    mock.reset();
  });

  describe('VNF authenticate', () => {
    it('loads credentials lazily and posts the client credentials grant', async () => {
      tokenResponses.push({ access_token: 'TOKEN', expires_in: 60 });
      const loadCredentials = mock.fn(async () => ({
        clientId: 'cao-a-client',
        clientSecret: 'cao-a-secret',
      }));

      const result = await authenticateVnfClient(
        {
          audience: BLOCKCHAIN_AUDIENCE,
          cacheKey: 'did:velocity:cao-a:3',
          loadCredentials,
        },
        {},
      );

      expect(result).toEqual('TOKEN');
      expect(loadCredentials.mock.callCount()).toEqual(1);
      expect(post.mock.calls[0].arguments).toEqual([
        TOKEN_ENDPOINT,
        {
          grant_type: 'client_credentials',
          client_id: 'cao-a-client',
          client_secret: 'cao-a-secret',
          audience: BLOCKCHAIN_AUDIENCE,
        },
      ]);
    });

    it('reuses a token for the same audience and resolver cache key', async () => {
      tokenResponses.push({ access_token: 'TOKEN', expires_in: 60 });
      const loadCredentials = mock.fn(async () => ({
        clientId: 'cao-a-client',
        clientSecret: 'cao-a-secret',
      }));
      const authentication = {
        audience: BLOCKCHAIN_AUDIENCE,
        cacheKey: 'did:velocity:cao-a:3',
        loadCredentials,
      };

      const firstToken = await authenticateVnfClient(authentication, {});
      const secondToken = await authenticateVnfClient(authentication, {});

      expect([firstToken, secondToken]).toEqual(['TOKEN', 'TOKEN']);
      expect(loadCredentials.mock.callCount()).toEqual(1);
      expect(post.mock.callCount()).toEqual(1);
    });

    it('requests separate tokens for two resolver cache keys', async () => {
      tokenResponses.push(
        { access_token: 'CAO_A_TOKEN', expires_in: 60 },
        { access_token: 'CAO_B_TOKEN', expires_in: 60 },
      );
      const loadCaoACredentials = mock.fn(async () => ({
        clientId: 'cao-a-client',
        clientSecret: 'cao-a-secret',
      }));
      const loadCaoBCredentials = mock.fn(async () => ({
        clientId: 'cao-b-client',
        clientSecret: 'cao-b-secret',
      }));

      const caoAToken = await authenticateVnfClient(
        {
          audience: BLOCKCHAIN_AUDIENCE,
          cacheKey: 'did:velocity:cao-a:3',
          loadCredentials: loadCaoACredentials,
        },
        {},
      );
      const caoBToken = await authenticateVnfClient(
        {
          audience: BLOCKCHAIN_AUDIENCE,
          cacheKey: 'did:velocity:cao-b:7',
          loadCredentials: loadCaoBCredentials,
        },
        {},
      );

      expect([caoAToken, caoBToken]).toEqual(['CAO_A_TOKEN', 'CAO_B_TOKEN']);
      expect(post.mock.callCount()).toEqual(2);
    });

    it('reloads credentials and requests a token after expiry', async () => {
      tokenResponses.push(
        { access_token: 'EXPIRED_TOKEN', expires_in: 0 },
        { access_token: 'FRESH_TOKEN', expires_in: 60 },
      );
      const loadCredentials = mock.fn(async () => ({
        clientId: 'cao-a-client',
        clientSecret: 'cao-a-secret',
      }));
      const authentication = {
        audience: BLOCKCHAIN_AUDIENCE,
        cacheKey: 'did:velocity:cao-a:3',
        loadCredentials,
      };

      await authenticateVnfClient(authentication, {});
      const result = await authenticateVnfClient(authentication, {});

      expect(result).toEqual('FRESH_TOKEN');
      expect(loadCredentials.mock.callCount()).toEqual(2);
      expect(post.mock.callCount()).toEqual(2);
    });

    it('prunes expired entries while preserving live cached tokens', async () => {
      tokenResponses.push({ access_token: 'NEW_TOKEN', expires_in: 60 });
      fastify.vnfAuthTokensCache.set('legacy-unreachable-entry', {
        accessToken: 'EXPIRED_TOKEN',
        expiresAt: new Date(0),
      });
      fastify.vnfAuthTokensCache.set('live-entry', {
        accessToken: 'LIVE_TOKEN',
        expiresAt: new Date(Date.now() + 60000),
      });

      await authenticateVnfClient(
        {
          audience: BLOCKCHAIN_AUDIENCE,
          cacheKey: 'did:velocity:cao-a:3',
          loadCredentials: async () => ({
            clientId: 'cao-a-client',
            clientSecret: 'cao-a-secret',
          }),
        },
        {},
      );

      expect(fastify.vnfAuthTokensCache.has('legacy-unreachable-entry')).toBe(
        false,
      );
      expect(fastify.vnfAuthTokensCache.has('live-entry')).toBe(true);
      expect(fastify.vnfAuthTokensCache.size).toEqual(2);
    });

    it('rejects an empty resolver cache key before loading credentials', async () => {
      const loadCredentials = mock.fn(async () => ({
        clientId: 'cao-a-client',
        clientSecret: 'cao-a-secret',
      }));

      await expect(
        authenticateVnfClient(
          {
            audience: BLOCKCHAIN_AUDIENCE,
            cacheKey: '',
            loadCredentials,
          },
          {},
        ),
      ).rejects.toThrow('cacheKey');
      expect(loadCredentials.mock.callCount()).toEqual(0);
      expect(post.mock.callCount()).toEqual(0);
    });

    it('rejects a non-function credential loader before requesting a token', async () => {
      await expect(
        authenticateVnfClient(
          {
            audience: BLOCKCHAIN_AUDIENCE,
            cacheKey: 'did:velocity:cao-a:3',
            loadCredentials: null,
          },
          {},
        ),
      ).rejects.toThrow('loadCredentials');
      expect(post.mock.callCount()).toEqual(0);
    });
  });

  describe('VNF authentication plugin', () => {
    it('uses config credentials through the default resolver', async () => {
      tokenResponses.push({ access_token: 'CONFIG_TOKEN', expires_in: 60 });
      fastify = createFastify({
        vnfClientId: 'configured-client',
        vnfClientSecret: 'configured-secret',
      });

      await registerPlugin(fastify);
      const resolution = await fastify.resolveVnfClientCredentials({});
      const result = await invokeRequestAuthentication(fastify);

      expect(resolution.cacheKey).toEqual('config:configured-client');
      await expect(resolution.loadCredentials()).resolves.toEqual({
        clientId: 'configured-client',
        clientSecret: 'configured-secret',
      });
      expect(result).toEqual('CONFIG_TOKEN');
      expect(post.mock.calls[0].arguments[1]).toEqual({
        grant_type: 'client_credentials',
        client_id: 'configured-client',
        client_secret: 'configured-secret',
        audience: BLOCKCHAIN_AUDIENCE,
      });
    });

    it('resolves metadata for every request but loads credentials only on a cache miss', async () => {
      tokenResponses.push({ access_token: 'CUSTOM_TOKEN', expires_in: 60 });
      const loadCredentials = mock.fn(async () => ({
        clientId: 'cao-a-client',
        clientSecret: 'cao-a-secret',
      }));
      const resolveVnfClientCredentials = mock.fn(async () => ({
        cacheKey: 'did:velocity:cao-a:3',
        loadCredentials,
      }));
      fastify = createFastify({
        vnfClientId: undefined,
        vnfClientSecret: undefined,
      });
      fastify.resolveVnfClientCredentials = resolveVnfClientCredentials;

      await registerPlugin(fastify);
      const firstToken = await invokeRequestAuthentication(fastify, {
        id: 'request-1',
      });
      const secondToken = await invokeRequestAuthentication(fastify, {
        id: 'request-2',
      });

      expect([firstToken, secondToken]).toEqual([
        'CUSTOM_TOKEN',
        'CUSTOM_TOKEN',
      ]);
      expect(resolveVnfClientCredentials.mock.callCount()).toEqual(2);
      expect(loadCredentials.mock.callCount()).toEqual(1);
      expect(post.mock.callCount()).toEqual(1);
    });

    it('preserves a pre-existing custom credential resolver', async () => {
      tokenResponses.push({ access_token: 'CUSTOM_TOKEN', expires_in: 60 });
      const customResolver = async () => ({
        cacheKey: 'did:velocity:cao-a:3',
        loadCredentials: async () => ({
          clientId: 'custom-client',
          clientSecret: 'custom-secret',
        }),
      });
      fastify = createFastify({
        vnfClientId: undefined,
        vnfClientSecret: undefined,
      });
      fastify.resolveVnfClientCredentials = customResolver;

      await registerPlugin(fastify);
      const result = await invokeRequestAuthentication(fastify);

      expect(result).toEqual('CUSTOM_TOKEN');
      expect(fastify.resolveVnfClientCredentials).toBe(customResolver);
      expect(post.mock.calls[0].arguments[1]).toEqual({
        grant_type: 'client_credentials',
        client_id: 'custom-client',
        client_secret: 'custom-secret',
        audience: BLOCKCHAIN_AUDIENCE,
      });
    });

    it('returns a custom resolver rejection without falling back to config', async () => {
      const customError = new Error('custom resolver failed');
      const config = {
        vnfOAuthTokensEndpoint: TOKEN_ENDPOINT,
        blockchainApiAudience: BLOCKCHAIN_AUDIENCE,
      };
      Object.defineProperties(config, {
        vnfClientId: {
          enumerable: true,
          get: () => {
            throw new Error('default client ID was accessed');
          },
        },
        vnfClientSecret: {
          enumerable: true,
          get: () => {
            throw new Error('default client secret was accessed');
          },
        },
      });
      fastify = createFastify();
      fastify.config = config;
      fastify.resolveVnfClientCredentials = async () => {
        throw customError;
      };

      await registerPlugin(fastify);

      await expect(invokeRequestAuthentication(fastify)).rejects.toBe(
        customError,
      );
      expect(post.mock.callCount()).toEqual(0);
    });

    it('fails plugin startup when the default client ID is missing', async () => {
      fastify = createFastify({ vnfClientId: undefined });

      await expect(registerPlugin(fastify)).rejects.toThrow('vnfClientId');
    });

    it('fails plugin startup when the default client secret is missing', async () => {
      fastify = createFastify({ vnfClientSecret: undefined });

      await expect(registerPlugin(fastify)).rejects.toThrow('vnfClientSecret');
    });
  });
});
