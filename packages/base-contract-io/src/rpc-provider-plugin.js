/*
 * Copyright 2024 Velocity Team
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

const fp = require('fastify-plugin');
const { initProvider } = require('./contract');

const setProvider = (fastify, req) => {
  // eslint-disable-next-line better-mutation/no-mutation
  req.rpcProvider = initProvider(
    fastify.config.rpcUrl,
    req.vnfBlockchainAuthenticate,
    fastify.config.chainId
  );
};

const rpcProviderPlugin = async (fastify) => {
  fastify.decorateRequest('rpcProvider', null);
  fastify.addHook('preValidation', async (req) => {
    setProvider(fastify, req);
  });
};

module.exports = {
  setProvider,
  rpcProviderPlugin: fp(rpcProviderPlugin, {
    fastify: '>=2.0.0',
    name: 'velocityRpcProvider',
    dependencies: ['velocityIdp'],
  }),
};
