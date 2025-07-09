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

const initRequest = require('@verii/request');
const { capitalize } = require('lodash/fp');
const fp = require('fastify-plugin');

const requestPlugin = async (fastify, { name, options }) => {
  const fastifyDecoration = `base${capitalize(name)}`;
  const requestDecoration = name;
  fastify
    .decorate(fastifyDecoration, initRequest(options))
    .decorateRequest(requestDecoration, null)
    .addHook('preValidation', async (req) => {
      req[requestDecoration] = fastify[fastifyDecoration](req);
    });
};

module.exports = { requestPlugin: fp(requestPlugin) };
