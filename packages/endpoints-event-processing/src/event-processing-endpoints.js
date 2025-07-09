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
const AutoLoad = require('@fastify/autoload');
const fp = require('fastify-plugin');
const path = require('path');

const eventProcessingEndpoints = async (fastify) =>
  fastify
    .register(AutoLoad, {
      dir: path.join(__dirname, 'entities'),
      indexPattern: /.*repo(\.ts|\.js|\.cjs|\.mjs)$/,
      scriptPattern: /.*repo(\.ts|\.js|\.cjs|\.mjs)$/,
    })
    .register(AutoLoad, {
      dir: path.join(__dirname, 'controllers'),
      indexPattern: /^.*controller(\.ts|\.js|\.cjs|\.mjs)$/,
      scriptPattern: /.*controller(\.ts|\.js|\.cjs|\.mjs)$/,
      routeParams: true,
      autoHooks: true,
      cascadeHooks: true,
      options: { prefix: '/api/v0.6' },
    });

module.exports = {
  eventProcessingEndpoints: fp(eventProcessingEndpoints),
};
