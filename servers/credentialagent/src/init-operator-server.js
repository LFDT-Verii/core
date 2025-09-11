/**
 * Copyright 2023 Velocity Team
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

const AutoLoad = require('@fastify/autoload');
const fastifyRoutes = require('@fastify/routes');
const path = require('path');
const { pick, omit } = require('lodash/fp');
const {
  vnfProtocolVersionPlugin,
  httpClientPlugin,
} = require('@verii/fastify-plugins');
const {
  authenticateVnfClientPlugin,
  rpcProviderPlugin,
} = require('@verii/base-contract-io');
const { adminJwtAuthPlugin } = require('@verii/auth');
const { validationPlugin } = require('@verii/validation');
const Static = require('@fastify/static');
const { autoloadRepos, validateCaoPlugin } = require('./plugins');
const {
  autoloadOperatorApiControllers,
  autoloadRootApiController,
  autoloadSaasoperatorApiControllers,
} = require('./controllers');

const initOperatorServer = (fastify) => {
  if (!fastify.config.isTest) {
    fastify.register(adminJwtAuthPlugin).register(authenticateVnfClientPlugin);
  }
  return fastify
    .register(rpcProviderPlugin)
    .register(vnfProtocolVersionPlugin)
    .register(validationPlugin, {
      ajv: fastify.config.validationPluginAjvOptions,
    })
    .register(fastifyRoutes)
    .register(autoloadRepos, { path: `${__dirname}/entities` })
    .register(autoloadOperatorApiControllers)
    .register(autoloadRootApiController)
    .register(autoloadSaasoperatorApiControllers)
    .register(AutoLoad, {
      dir: path.join(__dirname, 'controllers', 'operator'),
      ignorePattern: /^.*index(\.ts|\.js|\.cjs|\.mjs)$/,
      indexPattern: /^.*controller(\.ts|\.js|\.cjs|\.mjs)$/,
      autoHooks: true,
      cascadeHooks: true,
    })
    .register(httpClientPlugin, {
      name: 'vendorFetch',
      options: {
        ...omit(['bearerToken'], fastify.config),
        prefixUrl: fastify.config.vendorUrl,
        cache: fastify.cache,
        isTest: fastify.config.isTest,
      },
    })
    .register(httpClientPlugin, {
      name: 'registrarFetch',
      options: {
        ...pick(['nodeEnv', 'requestTimeout', 'traceIdHeader'], fastify.config),
        prefixUrl: fastify.config.oracleUrl,
        cache: fastify.cache,
        isTest: fastify.config.isTest,
      },
    })
    .register(httpClientPlugin, {
      name: 'universalResolverFetch',
      options: {
        ...pick(['nodeEnv', 'requestTimeout', 'traceIdHeader'], fastify.config),
        prefixUrl: fastify.config.universalResolverUrl,
        cache: fastify.cache,
        isTest: fastify.config.isTest,
      },
    })
    .register(httpClientPlugin, {
      name: 'fetch',
      options: {
        ...pick(['nodeEnv', 'requestTimeout', 'traceIdHeader'], fastify.config),
        cache: fastify.cache,
        isTest: fastify.config.isTest,
      },
    })
    .register(httpClientPlugin, {
      name: 'libFetch',
      options: {
        ...pick(['nodeEnv', 'requestTimeout', 'traceIdHeader'], fastify.config),
        prefixUrl: fastify.config.libUrl,
        cache: fastify.cache,
        isTest: fastify.config.isTest,
      },
    })
    .register(Static, {
      root: path.join(__dirname, 'assets/public'),
      prefix: '/public',
      wildcard: false,
    })
    .register(validateCaoPlugin);
};

module.exports = { initOperatorServer };
