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

const hasFunctionDecorator = (fastify, name) =>
  fastify.hasDecorator(name) && typeof fastify[name] === 'function';

const validateBlockchainClientCredentials = (blockchainClientCredentials) => {
  if (!isPlainObject(blockchainClientCredentials)) {
    throw new TypeError(
      'caoSecurityProvider.blockchainClientCredentials must be an object',
    );
  }
  if (typeof blockchainClientCredentials.plugin !== 'function') {
    throw new TypeError(
      'caoSecurityProvider.blockchainClientCredentials.plugin must be a function',
    );
  }
};

const installBlockchainClientCredentialsPlugin = fp(
  async (fastify, { blockchainClientCredentials }) => {
    validateBlockchainClientCredentials(blockchainClientCredentials);

    if (fastify.hasDecorator('resolveBlockchainClientCredentials')) {
      throw new TypeError(
        'CAO security provider blockchainClientCredentials plugin must own resolveBlockchainClientCredentials',
      );
    }

    await fastify.register(blockchainClientCredentials.plugin);

    if (!hasFunctionDecorator(fastify, 'resolveBlockchainClientCredentials')) {
      throw new TypeError(
        'CAO security provider blockchainClientCredentials plugin must decorate resolveBlockchainClientCredentials',
      );
    }

    const { resolveBlockchainClientCredentials } = fastify;
    fastify.decorate(
      'resolveVnfClientOAuthCreds',
      async function resolveVnfClientOAuthCreds(request) {
        const { cacheKey, loadCredentials } =
          (await resolveBlockchainClientCredentials.call(this, request)) ?? {};
        return {
          cacheKey,
          loadOAuthCreds: loadCredentials,
        };
      },
    );
  },
  { name: 'credentialingHubBlockchainClientCredentials' },
);

const registerBlockchainClientCredentials = (
  server,
  blockchainClientCredentials,
) =>
  server.register(installBlockchainClientCredentialsPlugin, {
    blockchainClientCredentials,
  });

module.exports = { registerBlockchainClientCredentials };
