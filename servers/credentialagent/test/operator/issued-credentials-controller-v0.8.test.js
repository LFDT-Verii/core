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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { ObjectId } = require('mongodb');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { omit } = require('lodash/fp');
const { VelocityRevocationListType } = require('@verii/vc-checks');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const {
  initOfferFactory,
  initTenantFactory,
  initOfferExchangeFactory,
} = require('../../src/entities');

const issuedCredentialsUrl = (tenant, suffix = '') =>
  `/operator-api/v0.8/tenants/${tenant._id}/issued-credentials${suffix}`;

describe('issued credentials management', () => {
  let fastify;
  let persistOffer;
  let persistOfferExchange;
  let persistTenant;
  let tenant;
  let exchange;
  let exchangeId;
  let offerCollection;
  const did = 'did:velocity:0xda16fdbde1f8b73d1c981e6988bbca37fcdaa6ae';
  const did2 = 'did:velocity:0xda16fdbde1f8b73d1c981e6988bbca37fcdaa6bc';
  const did3 = 'did:velocity:0xda16fdbde1f8b73d1c981e6988bbca37fcdaa6bd';
  const did4 = 'did:velocity:0xda16fdbde1f8b73d1c981e6988bbca37fcdaa6be';

  let credential;
  let credential2;
  let credentialCredentialStatusNull;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
    ({ persistOffer } = initOfferFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));
  });

  beforeEach(async () => {
    offerCollection = mongoDb().collection('offers');
    await mongoDb().collection('vendorUserIdMappings').deleteMany({});
    await offerCollection.deleteMany({});
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});

    const orgDid = 'did:velocity:0xc257274276a4e539741ca11b590b9447b26a8051';
    tenant = await persistTenant({
      did: orgDid,
      serviceIds: [`${orgDid}#issuer-1`],
    });
    exchange = await persistOfferExchange({ tenant });
    exchangeId = exchange._id;
    // offers shouldnt be included in any of the responses
    await persistOffer({ tenant, exchange });
    credential = await persistOffer({
      tenant,
      exchange,
      did,
      issuer: {
        id: tenant.did,
        name: 'Oracle Corporation',
        image: 'https://oracle.com/image',
      },
      issuanceDate: new Date(),
      credentialSchema: {
        id: 'http://oracle.localhost.test/schemas/PastEmploymentPosition',
        type: 'JsonSchemaValidator2018',
      },
      credentialStatus: {
        id: 'ethereum://0x1234/getRevokeStatus?address=0x412&listId=2&index=1',
        statusListCredential:
          'ethereum://0x1234/getRevokeStatus?address=0x412&listId=2',
        statusListIndex: 1,
        type: VelocityRevocationListType,
      },
    });
    credential2 = await persistOffer({
      tenant,
      exchange,
      did: did2,
      user: { vendorUserId: 'someotheranotheruser@example.com' },
    });
    await persistOffer({
      did: did3,
      user: { vendorUserId: 'someotheranotheruser@example.com' },
    });
    credentialCredentialStatusNull = await persistOffer({
      tenant,
      exchange,
      did: did4,
      issuanceDate: new Date(),
      credentialSchema: {
        id: 'http://oracle.localhost.test/schemas/PastEmploymentPosition',
        type: 'JsonSchemaValidator2018',
      },
    });

    await mongoDb()
      .collection('offers')
      .updateOne(
        { _id: new ObjectId(credentialCredentialStatusNull._id) },
        { $set: { credentialStatus: null } },
      );
  });

  after(async () => {
    await fastify.close();
  });

  describe('should send a list of offers to vendor', () => {
    it('should return a list of matched offers', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: issuedCredentialsUrl(tenant),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuedCredentials: expect.arrayContaining([
          {
            ...omit(['_id', 'isDuplicate'], credential),
            issuer: {
              id: tenant.did,
              name: 'Oracle Corporation',
              image: 'https://oracle.com/image',
            },
            exchangeId,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            id: did,
          },
          {
            ...omit(['_id', 'isDuplicate'], credential2),
            exchangeId,
            id: did2,
          },
        ]),
      });
    });
    it('should return a list of matched offers by offerId', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: issuedCredentialsUrl(
          tenant,
          `?vendorOfferId=${credential.offerId}`,
        ),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuedCredentials: [
          {
            ...omit(['_id', 'isDuplicate'], credential),
            exchangeId,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            id: did,
          },
        ],
      });
    });
    it('should return a list of matched offers by credentialId', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: issuedCredentialsUrl(tenant, `?&credentialId=${did}`),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuedCredentials: [
          {
            ...omit(['_id', 'isDuplicate'], credential),
            exchangeId,
            id: did,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
        ],
      });
    });
    it('should return a list of matched offers by vendorUserId', async () => {
      const newCredential = await persistOffer({
        tenant,
        exchange,
        user: { vendorUserId: 'mock123@example.com' },
        did,
        issued: new Date(),
        credentialSchema: {
          id: 'http://oracle.localhost.test/schemas/PastEmploymentPosition',
          type: 'JsonSchemaValidator2018',
        },
        credentialStatus: {
          id: 'ethereum://0x1234/getRevokeStatus?address=0x412&listId=2&index=1',
          type: VelocityRevocationListType,
        },
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuedCredentialsUrl(
          tenant,
          `?vendorUserId=${newCredential.credentialSubject.vendorUserId}`,
        ),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuedCredentials: [
          {
            ...omit(['_id', 'isDuplicate'], newCredential),
            exchangeId,
            id: did,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
        ],
      });
    });
    it('should return a list of matched offers by vendorUserId and offerId', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: issuedCredentialsUrl(
          tenant,
          `?vendorOfferId=${credential.offerId}&vendorUserId=${credential.credentialSubject.vendorUserId}`,
        ),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuedCredentials: [
          {
            ...omit(['_id', 'isDuplicate'], credential),
            exchangeId,
            id: did,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
        ],
      });
    });
    it('should return a list of matched offers when configured to return "issued" claim', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        vendorCredentialsIncludeIssuedClaim: true,
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuedCredentialsUrl(tenant),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuedCredentials: expect.arrayContaining([
          {
            ...omit(['_id', 'isDuplicate'], credential),
            issuer: {
              id: tenant.did,
              name: 'Oracle Corporation',
              image: 'https://oracle.com/image',
            },
            exchangeId,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            issued: expect.stringMatching(ISO_DATETIME_FORMAT),
            id: did,
          },
          {
            ...omit(['_id', 'isDuplicate'], credential2),
            exchangeId,
            id: did2,
          },
        ]),
      });
    });
    it('should return no offers offers when vendorUserId doesnt match any offers', async () => {
      await persistOffer({
        tenant,
        exchange,
        did,
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: issuedCredentialsUrl(tenant, '?vendorUserId=user@example.com'),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuedCredentials: [],
      });
    });
    it('should return no offers offers when vendorUserId offerId and credentialId doesnt match any offers', async () => {
      const newTenant = await persistTenant({
        did,
        serviceIds: [`${did}#issuer-1`],
      });
      const anotherOffer = await persistOffer({
        newTenant,
        exchange,
        did,
        vendorUserId: 'someotheruser@example.com',
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: issuedCredentialsUrl(
          tenant,
          `?vendorOfferId=${anotherOffer.offerId}`,
        ),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuedCredentials: [],
      });
    });
    it('should not return offer with not presented vendorUserId', async () => {
      const newTenant = await persistTenant({
        did,
        serviceIds: [`${did}#issuer-1`],
      });
      const incorrectOffer = await persistOffer({
        newTenant,
        exchange,
        did,
        _unsetVendorUserId: true,
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: issuedCredentialsUrl(tenant),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json.issuedCredentials).not.toEqual(
        expect.arrayContaining([incorrectOffer]),
      );
    });
    it('should return paginated list', async () => {
      const credential3 = await persistOffer({
        tenant,
        exchange,
        did: did2,
        user: { vendorUserId: 'someotheranotheruser@example.com' },
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: issuedCredentialsUrl(
          tenant,
          `?page.size=1&page.skip=0&vendorUserId=${credential2.credentialSubject.vendorUserId}`,
        ),
      });
      const response1 = await fastify.injectJson({
        method: 'GET',
        url: issuedCredentialsUrl(
          tenant,
          `?page.size=1&page.skip=1&vendorUserId=${credential2.credentialSubject.vendorUserId}`,
        ),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuedCredentials: [
          {
            ...omit(['_id', 'isDuplicate'], credential3),
            exchangeId,
            id: did2,
          },
        ],
      });

      expect(response1.statusCode).toEqual(200);
      expect(response1.json).toEqual({
        issuedCredentials: [
          {
            ...omit(['_id', 'isDuplicate'], credential2),
            exchangeId,
            id: did2,
          },
        ],
      });
    });
  });
});
