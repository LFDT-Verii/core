/*
 * Copyright 2026 Velocity Team
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
 */

const fp = require('fastify-plugin');
const { isPlainObject } = require('lodash/fp');
const { defaultOperatorAuthPlugin } = require('./default-operator-auth-plugin');

const hasFunctionDecorator = (fastify, name) =>
  fastify.hasDecorator(name) && typeof fastify[name] === 'function';

const validateOperatorAuth = (operatorAuth) => {
  if (!isPlainObject(operatorAuth)) {
    throw new TypeError('caoSecurityProvider.operatorAuth must be an object');
  }
  if (typeof operatorAuth.plugin !== 'function') {
    throw new TypeError(
      'caoSecurityProvider.operatorAuth.plugin must be a function',
    );
  }
  if (!isPlainObject(operatorAuth.documentation)) {
    throw new TypeError(
      'caoSecurityProvider.operatorAuth.documentation must be an object',
    );
  }
};

const installOperatorAuthPlugin = fp(
  async (fastify, { operatorAuth }) => {
    const resolvedOperatorAuth =
      operatorAuth == null
        ? {
            plugin: defaultOperatorAuthPlugin,
            documentation: {},
          }
        : operatorAuth;
    validateOperatorAuth(resolvedOperatorAuth);

    fastify.decorateRequest('operatorPrincipal', null);

    await fastify.register(resolvedOperatorAuth.plugin);

    if (!hasFunctionDecorator(fastify, 'authenticateOperator')) {
      throw new TypeError(
        'CAO security provider operatorAuth plugin must decorate authenticateOperator',
      );
    }
  },
  { name: 'credentialingHubOperatorAuth' },
);

const registerOperatorAuth = (server, operatorAuth) =>
  server.register(installOperatorAuthPlugin, { operatorAuth });

module.exports = { registerOperatorAuth };
