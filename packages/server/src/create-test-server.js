/* istanbul ignore file */
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
const { isEmpty } = require('lodash/fp');
const fp = require('fastify-plugin');
const newError = require('http-errors');
const { clone } = require('lodash/fp');
const {
  createCommonLog,
  commonCreateServer,
} = require('./common-create-server');

const createTestServer = (config) => {
  const log = createCommonLog(config);
  const server = commonCreateServer(config, log);

  server
    // config
    .decorate('overrides', clone(defaultOverrides))
    .decorate('resetOverrides', () => {
      server.overrides = clone(defaultOverrides);
    })
    .addHook('onRequest', async (req) => {
      req.config = server.overrides.reqConfig(server.config);
    })
    // test auth. Note each server uses different auth plugins
    .register(testAuthPlugin)
    .register(testOAuthPlugin)
    .register(testVnfAuthenticationPlugin);

  // eslint-disable-next-line better-mutation/no-mutation
  server.injectJson = async ({ method, url, userId, payload, headers }) => {
    const request = {
      method,
      url,
      payload,
      headers: {
        Accept: 'application/json',
        'x-user-id': userId || '',
        ...headers,
      },
    };

    if (payload != null) {
      request['content-type'] = 'application/json';
    }

    const response = await server.inject(request);
    if (
      isEmpty(response.body) ||
      !response.headers['content-type'].startsWith('application/json')
    ) {
      return { ...response, json: {} };
    }

    return { ...response, json: response.json() };
  };

  return server;
};

const defaultOverrides = { reqConfig: (x) => x };

const testAuthPlugin = fp((fastify, options, next) => {
  fastify.decorate('verifyAdmin', async (req) => {
    if (req.headers['x-override-auth-unauthorized'] != null) {
      throw newError.Unauthorized('Unauthorized');
    }
    const groupId = req.headers['x-override-auth-user-group-id'];

    req.user = {
      ...(groupId
        ? { groupId: req.headers['x-override-auth-user-group-id'] }
        : {}),
      user: 'velocity.admin@example.com',
    };
  });
  next();
});

const testOAuthPlugin = fp((fastify, options, next) => {
  fastify.decorate('verifyAccessToken', () => async (req) => {
    if (req.headers['x-override-oauth-unauthorized'] != null) {
      throw newError.Unauthorized('Unauthorized');
    } else if (req.headers['x-override-oauth-user'] != null) {
      // eslint-disable-next-line better-mutation/no-mutation
      req.user = JSON.parse(req.headers['x-override-oauth-user']);
    } else {
      // eslint-disable-next-line better-mutation/no-mutation
      req.user = req.config.defaultOAuthUser;
    }
  });
  next();
});

const testVnfAuthenticationPlugin = fp(
  (fastify, options, next) => {
    fastify
      .decorateRequest('vnfBlockchainAuthenticate', null)
      .addHook('preValidation', async (req) => {
        req.vnfBlockchainAuthenticate = () => 'TOKEN';
      });
    next();
  },
  { name: 'velocityIdp' }
);

module.exports = { createTestServer };
