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

const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const { mockHttpClientModule } = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { decrypt } = require('@verii/crypto');
const { hexFromJwk } = require('@verii/jwt');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');

describe('openid4vc nonce test suite', () => {
  let fastify;

  let tenant;
  let issuerKeyPair;

  let persistTenant;
  let persistKey;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    ({ tenant, issuerKeyPair } = await constructTenant(
      persistTenant,
      persistKey,
    ));
  });

  beforeEach(async () => {
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });

  describe('openid4vc nonce test suite', () => {
    it('should 200 with nonce', async () => {
      const testStartTimestamp = Date.now();

      const response = await fastify.injectJson({
        method: 'POST',
        url: `/r/${tenant._id}/openid4vc/nonce`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.headers['cache-control']).toEqual('no-store');
      expect(response.json).toEqual({
        c_nonce: expect.any(String),
      });
      const decodedNonce = decrypt(
        response.json.c_nonce,
        hexFromJwk(issuerKeyPair.privateKey),
      );
      expect(Number(decodedNonce)).toBeLessThan(Date.now());
      expect(Number(decodedNonce)).toBeGreaterThan(testStartTimestamp);
    });
  });
});
