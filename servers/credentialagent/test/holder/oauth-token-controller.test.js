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

// eslint-disable-next-line import/order
const buildFastify = require('./helpers/credentialagent-holder-build-fastify');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { getUnixTime, addDays } = require('date-fns/fp');
const { jwtVerify } = require('@verii/jwt');
const { ObjectId } = require('mongodb');
const {
  mongoify,
  errorResponseMatcher,
} = require('@verii/tests-helpers');
const {
  generateKeyPair,
  hashAndEncodeHex,
} = require('@verii/crypto');
const {
  initDisclosureFactory,
  initTenantFactory,
  initKeysFactory,
  initFeedFactory,
  VendorEndpoint,
} = require('../../src/entities');

describe('Holder Oauth Token Test Suite', () => {
  let fastify;
  let persistDisclosure;
  let persistFeed;
  let persistTenant;
  let tenant;
  let disclosure;
  let persistKey;
  let keyPair;

  beforeAll(async () => {
    fastify = buildFastify({
      storeIssuerAsString: false,
    });
    await fastify.ready();
    ({ persistDisclosure } = initDisclosureFactory(fastify));
    ({ persistFeed } = initFeedFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeysFactory(fastify));
    keyPair = generateKeyPair({ format: 'jwk' });
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    fastify.resetOverrides();

    await mongoDb().collection('disclosures').deleteMany({});
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('vendorUserIdMappings').deleteMany({});
    await mongoDb().collection('feeds').deleteMany({});

    tenant = await persistTenant({
      serviceIds: ['#foo-service-id-1'],
    });
    disclosure = await persistDisclosure({
      tenant,
      vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
    });
    await persistKey({
      tenant,
      kidFragment: '#ID2',
      keyPair,
    });
  });

  afterAll(async () => {
    await fastify.close();
  });

  const tokenUrl = ({ did }) => `/api/holder/v0.6/org/${did}/oauth/token`;

  describe('/token test suite', () => {
    it("/token should 400 if grant_type:'authorization_code' and authorization_code is missing", async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: tokenUrl(tenant),
        payload: {
          grant_type: 'authorization_code',
          audience: 'foo',
          client_id: 'foo',
        },
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            // eslint-disable-next-line max-len
            "body must have required property 'authorization_code', body must have required property 'refresh_token', body must match exactly one schema in oneOf",
          statusCode: 400,
        })
      );
    });
    it("/token should 400 if grant_type:'refresh_token' and refresh_token is missing", async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: tokenUrl(tenant),
        payload: {
          grant_type: 'authorization_code',
          audience: 'foo',
          client_id: 'foo',
        },
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            // eslint-disable-next-line max-len
            "body must have required property 'authorization_code', body must have required property 'refresh_token', body must match exactly one schema in oneOf",
          statusCode: 400,
        })
      );
    });
    it("/token should 400 if audience does not match tenant's did", async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: tokenUrl(tenant),
        payload: {
          grant_type: 'authorization_code',
          audience: 'foo',
          client_id: 'foo',
          authorization_code: 'foo',
        },
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Bad audience',
          statusCode: 400,
        })
      );
    });
    it('/token should 401 if authorization_code does not match up to a feed', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: tokenUrl(tenant),
        payload: {
          grant_type: 'authorization_code',
          audience: tenant.did,
          client_id: 'foo',
          authorization_code: 'foo',
        },
      });
      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Unauthorized',
          errorCode: 'missing_error_code',
          message: 'Unauthorized',
          statusCode: 401,
        })
      );
    });
    it('/token should 401 if refresh_token does not match up to a feed', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: tokenUrl(tenant),
        payload: {
          grant_type: 'refresh_token',
          audience: tenant.did,
          client_id: 'foo',
          refresh_token: 'foo',
        },
      });
      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Unauthorized',
          errorCode: 'missing_error_code',
          message: 'Unauthorized',
          statusCode: 401,
        })
      );
    });
    it('/token should 401 if client_id does not match up to a feed', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: tokenUrl(tenant),
        payload: {
          grant_type: 'refresh_token',
          audience: tenant.did,
          client_id: 'foo',
          refresh_token: 'foo',
        },
      });
      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Unauthorized',
          errorCode: 'missing_error_code',
          message: 'Unauthorized',
          statusCode: 401,
        })
      );
    });
    it('/token should 200 if authorization_code matches preauthCode of feed', async () => {
      const startOfTestTimestamp = new Date();
      const leastRecentFeed = await persistFeed({
        tenant,
        disclosure,
        preauthCode: 'leastCodeFoo',
        vendorUserId: 'leastIdFoo',
      });
      const mostRecentFeed = await persistFeed({
        tenant,
        disclosure,
        preauthCode: 'codeFoo',
        vendorUserId: 'idFoo',
      });
      expect(mostRecentFeed.clientId).toBeUndefined();
      const response = await fastify.injectJson({
        method: 'POST',
        url: tokenUrl(tenant),
        payload: {
          grant_type: 'authorization_code',
          audience: tenant.did,
          client_id: 'clientFoo',
          authorization_code: 'codeFoo',
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
        token_type: 'Bearer',
      });

      const dbUserOfFeed = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({
          vendorUserId: 'idFoo',
        });

      const { header, payload } = await jwtVerify(
        response.json.access_token,
        keyPair.publicKey,
        {
          issuer: tenant.did,
          audience: tenant.did,
          subject: `${dbUserOfFeed._id}`,
          maxTokenAge: '1 minute',
          requiredClaims: ['nbf', 'exp', 'jti'],
        }
      );
      expect(header.kid).toEqual('#ID2');
      expect(payload.nbf).toEqual(payload.iat);
      const currentTime = new Date();
      expect(payload.exp).toBeLessThanOrEqual(
        getUnixTime(addDays(7, currentTime))
      );
      expect(payload.exp).toBeGreaterThanOrEqual(
        getUnixTime(addDays(7, startOfTestTimestamp))
      );
      expect(payload.jti).toHaveLength(21);

      const dbMostRecentFeed = await mongoDb()
        .collection('feeds')
        .findOne({
          _id: new ObjectId(mostRecentFeed._id),
        });
      expect(dbMostRecentFeed).toEqual(
        mongoify({
          _id: mostRecentFeed._id,
          preauthCode: 'codeFoo',
          vendorUserId: 'idFoo',
          clientId: 'clientFoo',
          refreshToken: hashAndEncodeHex(response.json.refresh_token),
          tenantId: tenant._id,
          disclosureId: disclosure._id,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const dbLeastRecentFeed = await mongoDb()
        .collection('feeds')
        .findOne({
          _id: new ObjectId(leastRecentFeed._id),
        });
      expect(dbLeastRecentFeed).toEqual(
        mongoify({
          _id: leastRecentFeed._id,
          preauthCode: 'leastCodeFoo',
          vendorUserId: 'leastIdFoo',
          tenantId: tenant._id,
          disclosureId: disclosure._id,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });
    it('/token should 200 if refresh_token and client_id match up to a feed', async () => {
      const startOfTestTimestamp = new Date();
      const leastRecentFeed = await persistFeed({
        tenant,
        disclosure,
        preauthCode: 'leastCodeFoo',
        refreshToken: 'refreshTokenFoo',
        vendorUserId: 'leastIdFoo',
        clientId: 'clientFoo',
      });
      const mostRecentFeed = await persistFeed({
        tenant,
        disclosure,
        preauthCode: 'codeFoo',
        refreshToken: 'refreshTokenFoo',
        vendorUserId: 'idFoo',
        clientId: 'clientFoo',
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: tokenUrl(tenant),
        payload: {
          grant_type: 'refresh_token',
          audience: tenant.did,
          client_id: 'clientFoo',
          refresh_token: 'refreshTokenFoo',
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
        token_type: 'Bearer',
      });
      const dbUserOfFeed = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({
          vendorUserId: 'idFoo',
        });

      const { header, payload } = await jwtVerify(
        response.json.access_token,
        keyPair.publicKey,
        {
          kid: '#ID2',
          issuer: tenant.did,
          audience: tenant.did,
          subject: `${dbUserOfFeed._id}`,
          maxTokenAge: '1 minute',
          requiredClaims: ['nbf', 'exp', 'jti'],
        }
      );
      expect(header.kid).toEqual('#ID2');
      expect(payload.nbf).toEqual(payload.iat);
      const currentTime = new Date();
      expect(payload.exp).toBeLessThanOrEqual(
        getUnixTime(addDays(7, currentTime))
      );
      expect(payload.exp).toBeGreaterThanOrEqual(
        getUnixTime(addDays(7, startOfTestTimestamp))
      );
      expect(payload.jti).toHaveLength(21);

      const dbMostRecentFeed = await mongoDb()
        .collection('feeds')
        .findOne({
          _id: new ObjectId(mostRecentFeed._id),
        });
      expect(dbMostRecentFeed).toEqual(
        mongoify({
          _id: mostRecentFeed._id,
          preauthCode: 'codeFoo',
          vendorUserId: 'idFoo',
          clientId: 'clientFoo',
          refreshToken: hashAndEncodeHex(response.json.refresh_token),
          tenantId: tenant._id,
          disclosureId: disclosure._id,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const dbLeastRecentFeed = await mongoDb()
        .collection('feeds')
        .findOne({
          _id: new ObjectId(leastRecentFeed._id),
        });
      expect(dbLeastRecentFeed).toEqual(
        mongoify({
          _id: leastRecentFeed._id,
          preauthCode: 'leastCodeFoo',
          vendorUserId: 'leastIdFoo',
          clientId: 'clientFoo',
          refreshToken: hashAndEncodeHex('refreshTokenFoo'),
          tenantId: tenant._id,
          disclosureId: disclosure._id,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });
  });
});
