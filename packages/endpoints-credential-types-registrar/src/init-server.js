/*
 * Copyright 2025 Velocity Team
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

const { pick } = require('lodash/fp');
const { validationPlugin } = require('@verii/validation');
const { oauthPlugin } = require('@verii/auth');
const { httpClientPlugin } = require('@verii/fastify-plugins');
const {
  credentialTypesRegistrarEndpoints,
} = require('./credential-types-registrar-endpoints');

const initServer = (server) => {
  if (!server.config.isTest) {
    server.register(oauthPlugin, {
      domain: server.config.auth0Domain,
      audience: [
        server.config.registrarApiAudience,
        server.config.oauthAudienceTokenApi,
      ],
    });
  }

  return server
    .register(validationPlugin, {
      ajv: server.config.validationPluginAjvOptions,
    })
    .addHook('preValidation', async (req) => {
      req.getDocValidator = server.getDocValidator;
    })
    .register(httpClientPlugin, {
      name: 'fetch',
      options: pick(
        ['nodeEnv', 'requestTimeout', 'traceIdHeader', 'useExistingGlobalAgent'],
        server.config
      ),
    })
    .register(credentialTypesRegistrarEndpoints);
};

module.exports = { initServer };
