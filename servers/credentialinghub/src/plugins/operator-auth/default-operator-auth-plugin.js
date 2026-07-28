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

const fastifyBearerAuth = require('@fastify/bearer-auth');
const fp = require('fastify-plugin');

const assertNonEmpty = (value, name) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
};

const defaultOperatorAuthPlugin = fp(async (fastify) => {
  if (!fastify.config.isTest) {
    assertNonEmpty(fastify.config.operatorApiToken, 'OPERATOR_API_TOKEN');
    await fastify.register(fastifyBearerAuth, {
      keys: new Set([fastify.config.operatorApiToken]),
      addHook: false,
    });
  }

  fastify.decorate('authenticateOperator', async (request, reply) => {
    if (!fastify.config.isTest) {
      await new Promise((resolve, reject) => {
        fastify.verifyBearerAuth(request, reply, (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
    request.operatorPrincipal = {
      caoDid: fastify.config.defaultCaoDid ?? null,
      subject: 'legacy-operator-token',
      subjectType: 'client',
      authenticationMethod: 'static_bearer',
    };
  });
});

module.exports = { defaultOperatorAuthPlugin };
