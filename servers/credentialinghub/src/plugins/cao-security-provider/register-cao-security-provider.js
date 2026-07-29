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
const {
  defaultCaoSecurityProvider,
} = require('./default-cao-security-provider');

const installCaoSecurityProvider = fp(
  async (fastify, { caoSecurityProvider }) => {
    fastify.decorateRequest('operatorPrincipal', null);
    if (caoSecurityProvider.configPlugin != null) {
      await fastify.register(caoSecurityProvider.configPlugin);
    }
    await fastify.register(caoSecurityProvider.operatorAuthPlugin);

    if (caoSecurityProvider === defaultCaoSecurityProvider) {
      return;
    }

    const { blockchainClientCredentialsPlugin } = caoSecurityProvider;
    await fastify.register(blockchainClientCredentialsPlugin);
    const resolveBlockchainClientCredentials = fastify.getDecorator(
      'resolveBlockchainClientCredentials',
    );
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
  { name: 'credentialingHubCaoSecurityProvider' },
);

const registerCaoSecurityProvider = (server, caoSecurityProvider) =>
  server.register(installCaoSecurityProvider, { caoSecurityProvider });

module.exports = { registerCaoSecurityProvider };
