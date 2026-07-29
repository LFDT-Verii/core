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
const { from } = require('env-var');
const fp = require('fastify-plugin');

const defaultCaoSecurityConfigPlugin = fp(async (fastify) => {
  const env = from(process.env);
  // Provider config plugins intentionally extend the existing Fastify config.
  // eslint-disable-next-line better-mutation/no-mutating-functions
  Object.assign(fastify.config, {
    operatorApiToken:
      fastify.config.operatorApiToken ??
      env.get('OPERATOR_API_TOKEN').required().asString(),
    defaultCaoDid:
      fastify.config.defaultCaoDid ??
      env.get('DEFAULT_CAO_DID').required().asString(),
    vnfClientId:
      fastify.config.vnfClientId ??
      env.get('VNF_OAUTH_CLIENT_ID').required().asString(),
    vnfClientSecret:
      fastify.config.vnfClientSecret ??
      env.get('VNF_OAUTH_CLIENT_SECRET').required().asString(),
  });
});

const defaultOperatorAuthPlugin = fp(async (fastify) => {
  if (!fastify.config.isTest) {
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
      caoDid: fastify.config.defaultCaoDid,
      subject: 'legacy-operator-token',
      subjectType: 'client',
      authenticationMethod: 'static_bearer',
    };
  });
});

const defaultCaoSecurityProvider = {
  configPlugin: defaultCaoSecurityConfigPlugin,
  operatorAuthPlugin: defaultOperatorAuthPlugin,
  documentation: {},
  // A default blockchainClientCredentialsPlugin is unnecessary because
  // base-contract-io's contract calling code reads the configured client
  // credentials directly.
};

const resolveCaoSecurityProvider = (caoSecurityProvider) =>
  caoSecurityProvider ?? defaultCaoSecurityProvider;

module.exports = {
  defaultCaoSecurityProvider,
  resolveCaoSecurityProvider,
};
