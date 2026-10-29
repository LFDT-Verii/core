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
const { ObjectId } = require('mongodb');
const { omit } = require('lodash/fp');
const {
  generateKeyPair,
  KeyAlgorithms,
  KeyPurposes,
} = require('@verii/crypto');
const { jwtDecode, jwtVerify } = require('@verii/jwt');
const { UUID_FORMAT } = require('@verii/test-regexes');

const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');

describe('openid4vc nonce test suite', () => {
  let fastify;

  let tenant;

  let persistTenant;
  let persistKey;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    ({ tenant } = await constructTenant(persistTenant, persistKey));
  });

  beforeEach(async () => {
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });

  describe('openid4vc nonce test suite', () => {
    it('should 200 with a nonce signed with the nonce secret that expires in 5 minutes', async () => {
      const testStartUnix = Math.floor(Date.now() / 1000);

      const response = await requestNonce(tenant._id);

      expect(response.statusCode).toEqual(200);
      expect(response.headers['cache-control']).toEqual('no-store');
      expect(response.json).toEqual({
        c_nonce: expect.any(String),
      });
      const { header, payload } = await verifyNonce(
        response.json.c_nonce,
        tenant._id,
      );
      expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
      expect(payload).toEqual(expectedNoncePayload(tenant._id));
      expect(payload.exp - payload.iat).toEqual(300);
      expect(payload.iat).toBeGreaterThanOrEqual(testStartUnix);
      expect(payload.iat).toBeLessThanOrEqual(Math.ceil(Date.now() / 1000));
    });

    it('should 200 with a different jti on every nonce', async () => {
      const responses = await Promise.all([
        requestNonce(tenant._id),
        requestNonce(tenant._id),
        requestNonce(tenant._id),
      ]);

      const jtis = responses.map(
        ({ json }) => jwtDecode(json.c_nonce).payload.jti,
      );
      expect(new Set(jtis).size).toEqual(3);
    });

    it('should 200 with a nonce for a tenant whose EXCHANGES key is P-256', async () => {
      const p256Tenant = await persistP256ExchangesTenant();

      const response = await requestNonce(p256Tenant._id);

      expect(response.statusCode).toEqual(200);
      expect(response.headers['cache-control']).toEqual('no-store');
      const { payload } = await verifyNonce(
        response.json.c_nonce,
        p256Tenant._id,
      );
      expect(payload).toEqual(expectedNoncePayload(p256Tenant._id));
    });
  });

  const requestNonce = (tenantId) =>
    fastify.injectJson({
      method: 'POST',
      url: `/r/${tenantId}/openid4vc/nonce`,
    });

  const verifyNonce = (cNonce, tenantId) =>
    jwtVerify(cNonce, 'test-openid4vci-nonce-secret', {
      algorithms: ['HS256'],
      audience: credentialIssuerOf(tenantId),
      issuer: credentialIssuerOf(tenantId),
    });

  const expectedNoncePayload = (tenantId) => ({
    aud: credentialIssuerOf(tenantId),
    exp: expect.any(Number),
    iat: expect.any(Number),
    iss: credentialIssuerOf(tenantId),
    jti: expect.stringMatching(UUID_FORMAT),
  });

  const credentialIssuerOf = (tenantId) =>
    `https://localhost.test/r/${tenantId}`;

  const persistP256ExchangesTenant = async () => {
    const { tenant: p256Tenant } = await constructTenant(
      persistTenant,
      persistKey,
    );
    const exchangesKey = await persistKey({
      tenant: p256Tenant,
      key: generateKeyPair({ curve: 'P-256', format: 'jwk' }).privateKey,
      algorithm: KeyAlgorithms.ES256,
      purposes: [KeyPurposes.EXCHANGES],
    });
    await mongoDb()
      .collection('tenants')
      .updateOne(
        { _id: new ObjectId(p256Tenant._id) },
        {
          $set: {
            [`keysByPurpose.${KeyPurposes.EXCHANGES}`]: omit(
              ['encryptedJwk'],
              exchangesKey,
            ),
          },
        },
      );
    return p256Tenant;
  };
});
