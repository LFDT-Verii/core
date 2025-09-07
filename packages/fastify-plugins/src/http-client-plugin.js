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

const { initHttpClient } = require('@verii/http-client');
const fp = require('fastify-plugin');

const httpClientPlugin = async (fastify, { name, options }) => {
  const fastifyDecoration = `base${name[0].toUpperCase()}${name.slice(1)}`;
  const requestDecoration = name;
  const { prefixUrl } = options;
  fastify
    .decorate(
      fastifyDecoration,
      () => initHttpClient({ ...options, cache: fastify.cache }),
      ['cache']
    )
    .decorateRequest(requestDecoration, null)
    .addHook('preValidation', async (req) => {
      req[requestDecoration] = prefixUrl
        ? fastify[fastifyDecoration]()(prefixUrl, req)
        : fastify[fastifyDecoration]()(req);
    });
};

module.exports = { httpClientPlugin: fp(httpClientPlugin) };
