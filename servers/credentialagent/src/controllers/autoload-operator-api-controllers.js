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
const path = require('path');

const autoloadOperatorApiControllers = async (fastify) =>
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'operator'),
    scriptPattern: /.*dont-match-scripts.*(\.ts|\.js|\.cjs|\.mjs)$/,
    indexPattern: /^.*controller-v0.8(\.ts|\.js|\.cjs|\.mjs)$/,
    routeParams: true,
    autoHooks: true,
    cascadeHooks: true,
    options: { prefix: '/operator-api/v0.8' },
  });

module.exports = { autoloadOperatorApiControllers };
