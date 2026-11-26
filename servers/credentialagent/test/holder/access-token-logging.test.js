/**
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
 */

const { Writable } = require('node:stream');
const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');

const fp = require('fastify-plugin');
const { loggerProvider } = require('@verii/logger');
const { generateKeyPair } = require('@verii/crypto');
const { createServer } = require('@verii/server-provider');
const { loadTestEnv, buildMongoConnection } = require('@verii/tests-helpers');
loadTestEnv();

const {
  initTenantFactory,
  initOfferExchangeFactory,
  initUserFactory,
  initKeysFactory,
} = require('../../src/entities');
const { holderConfig } = require('../../src/config/holder-config');
const { initHolderServer } = require('../../src/init-holder-server');
const {
  generateTestAccessToken,
} = require('./helpers/generate-test-access-token');

const mongoConnection = buildMongoConnection('test-credential-agent');

const buildUrl = (tenant, exchange) =>
  `/api/holder/v0.6/org/${tenant.did}/get-exchange-progress?exchange_id=${exchange._id}`;

const stubVelocityIdp = fp(
  async (server) => {
    server.decorateRequest('vnfBlockchainAuthenticate', () => 'TOKEN');
  },
  { name: 'velocityIdp' },
);

describe('Access token request logging', () => {
  const entries = [];
  let fastify;
  let tenant;
  let exchange;
  let keyPair;
  let key;
  let knownUserId;

  before(async () => {
    const config = { ...holderConfig, mongoConnection, logSeverity: 'debug' };
    const destination = new Writable({
      write: (chunk, encoding, callback) => {
        entries.push(JSON.parse(chunk.toString()));
        callback();
      },
    });
    const log = loggerProvider({ ...config, destination });
    fastify = initHolderServer(
      createServer(config, log).register(stubVelocityIdp),
    );
    await fastify.ready();

    tenant = await initTenantFactory(fastify).persistTenant();
    exchange = await initOfferExchangeFactory(fastify).persistOfferExchange({
      tenant,
    });
    const user = await initUserFactory(fastify).persistVendorUserIdMapping({
      tenant,
    });
    knownUserId = user._id;
    keyPair = generateKeyPair({ format: 'jwk' });
    key = await initKeysFactory(fastify).persistKey({ keyPair, tenant });
  });

  after(async () => {
    await fastify.close();
  });

  const cases = [
    ['a known user', 200, 'response body', () => knownUserId],
    [
      'an unknown user',
      401,
      'User in sub claim not found',
      () => 'unknown-user-id',
    ],
  ];

  cases.forEach(([name, status, message, subject]) => {
    it(`logs the token subject as userId for ${name}`, async () => {
      const userId = subject();
      const token = await generateTestAccessToken(
        exchange._id.toString(),
        tenant.did,
        userId,
        null,
        null,
        '30d',
        null,
        keyPair.privateKey,
        key.kidFragment,
      );
      entries.length = 0;

      const response = await fastify.inject({
        method: 'GET',
        url: buildUrl(tenant, exchange),
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toEqual(status);
      const entry = entries.find(({ msg }) => msg === message);
      expect(entry).toMatchObject({ userId: userId.toString() });
      expect(entry).not.toHaveProperty('accessToken');
      expect(entry).not.toHaveProperty('user');
    });
  });
});
