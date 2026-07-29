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

const fp = require('fastify-plugin');
const { isPlainObject } = require('lodash/fp');
const { registerOperatorAuth } = require('../operator-auth');
const {
  registerBlockchainClientCredentials,
} = require('../blockchain-client-credentials');

const validateCaoSecurityProvider = (caoSecurityProvider) => {
  if (!isPlainObject(caoSecurityProvider)) {
    throw new TypeError('caoSecurityProvider must be an object');
  }
  if (!isPlainObject(caoSecurityProvider.operatorAuth)) {
    throw new TypeError('caoSecurityProvider.operatorAuth must be an object');
  }
  if (!isPlainObject(caoSecurityProvider.blockchainClientCredentials)) {
    throw new TypeError(
      'caoSecurityProvider.blockchainClientCredentials must be an object',
    );
  }
};

const installCaoSecurityProvider = fp(
  async (fastify, { caoSecurityProvider }) => {
    if (caoSecurityProvider == null) {
      await registerOperatorAuth(fastify);
      return;
    }

    validateCaoSecurityProvider(caoSecurityProvider);
    await registerOperatorAuth(fastify, caoSecurityProvider.operatorAuth);
    await registerBlockchainClientCredentials(
      fastify,
      caoSecurityProvider.blockchainClientCredentials,
    );
  },
  { name: 'credentialingHubCaoSecurityProvider' },
);

const registerCaoSecurityProvider = (server, caoSecurityProvider) =>
  server.register(installCaoSecurityProvider, { caoSecurityProvider });

module.exports = { registerCaoSecurityProvider };
