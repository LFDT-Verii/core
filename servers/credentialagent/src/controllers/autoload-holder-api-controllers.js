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

const autoloadHolderApiControllers = async (fastify) =>
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'holder'),
    indexPattern: /^.*controller(\.ts|\.js|\.cjs|\.mjs)$/,
    ignorePattern: /^.*index(\.ts|\.js|\.cjs|\.mjs)$/,
    autoHooks: true,
    cascadeHooks: true,
    options: { prefix: '/api/holder/v0.6/org/:tenantId' },
  });

module.exports = { autoloadHolderApiControllers };
