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
mock.module('@verii/metadata-registration', { namedExports: {} });
mock.module('@verii/common-fetchers', { namedExports: {} });

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const {
  jwtVerify,
  generateCredentialJwt,
  generateDocJwt,
} = require('@verii/jwt');
const { generateKeyPair } = require('@verii/crypto');
const { nanoid } = require('nanoid/non-secure');
const { getDidUriFromJwk, toDidUrl } = require('@verii/did-doc');
const { errorResponseMatcher, mongoify } = require('@verii/tests-helpers');
const { entries, set } = require('lodash/fp');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const createTestFastify = require('../helpers/create-test-fastify');
const {
  initExchangeFactory,
  ExchangeStates,
  ExchangeErrors,
} = require('../../src/entities/exchanges');
const { initDepotFactory } = require('../../src/entities/depots');
const { constructTenant } = require('../helpers/construct-tenant');

const testUrl = (tenant2) => `/vn-api/r/${tenant2.did}/authenticate`;

describe('vn-api > authenticate', () => {
  let fastify;

  let tenant;
  let holderDid;
  let holderKeyPair;
  let holderAccessTokensSecret;
  let preauthIssuerService;
  let preauthCode;

  let persistTenant;
  let persistKey;
  let persistIssuerService;
  let persistDepot;
  let persistExchange;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistExchange } = initExchangeFactory(fastify));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('issuerServices').deleteMany({});

    ({ tenant, holderAccessTokensSecret } = await constructTenant(
      persistTenant,
      persistKey,
    ));

    preauthIssuerService = await persistIssuerService({
      tenant,
      authMethods: ['preauth'],
    });

    holderKeyPair = generateKeyPair({ format: 'jwk' });
    holderDid = getDidUriFromJwk(holderKeyPair.publicKey);
  });

  beforeEach(async () => {
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    preauthCode = nanoid();
  });

  after(async () => {
    await fastify.close();
  });

  it('should 400 when exchange id missing', async () => {
    const depot = await persistDepot({
      tenant,
      service: preauthIssuerService,
      preauthCode,
    });
    const response = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      payload: {
        jwt_vp: await generatePreauthCodeAuthJwt(
          depot,
          preauthCode,
          holderDid,
          holderKeyPair,
        ),
      },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        errorCode: 'request_validation_failed',
        message: "body must have required property 'exchange_id'",
        statusCode: 400,
      }),
    );
  });

  it('should 400 when exchange is not found', async () => {
    const depot = await persistDepot({
      tenant,
      service: preauthIssuerService,
      preauthCode,
    });
    const response = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      payload: {
        exchange_id: new ObjectId().toString(),
        jwt_vp: await generatePreauthCodeAuthJwt(
          depot,
          preauthCode,
          holderDid,
          holderKeyPair,
        ),
      },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        message: 'Referenced exchange not found',
        statusCode: 400,
      }),
    );
  });

  it('should 400 when service cannot be found', async () => {
    const depot = await persistDepot({
      tenant,
      service: preauthIssuerService,
    });
    const exchange = await persistExchange({
      tenant,
      service: { _id: new ObjectId() },
    });
    const response = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      payload: {
        exchange_id: exchange._id,
        jwt_vp: await generatePreauthCodeAuthJwt(
          depot,
          nanoid(),
          holderDid,
          holderKeyPair,
        ),
      },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        errorCode: 'referenced_service_not_found',
        message: 'referenced_service_not_found',
        statusCode: 400,
      }),
    );
  });

  it('should 400 when service is deactivated', async () => {
    const deactivatedService = await persistIssuerService({
      tenant,
      authMethods: ['preauth'],
      deactivationDate: new Date(),
    });
    const depot = await persistDepot({
      tenant,
      service: preauthIssuerService,
      preauthCode: nanoid(),
    });
    const exchange = await persistExchange({
      tenant,
      service: deactivatedService,
    });

    const response = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      payload: {
        exchange_id: exchange._id,
        jwt_vp: await generatePreauthCodeAuthJwt(
          depot,
          preauthCode,
          holderDid,
          holderKeyPair,
        ),
      },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        errorCode: 'referenced_service_not_found',
        message: 'referenced_service_not_found',
        statusCode: 400,
      }),
    );
  });

  describe('preauthCode rulesEngine authentication', () => {
    let depot;
    let exchange;
    beforeEach(async () => {
      preauthCode = nanoid();
      depot = await persistDepot({
        tenant,
        service: preauthIssuerService,
        preauthCode,
      });
      exchange = await persistExchange({
        tenant,
        service: preauthIssuerService,
      });
    });

    it('should 401 if preauthCode is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        payload: {
          exchange_id: exchange._id,
          jwt_vp: await generatePreauthCodeAuthJwt(
            depot,
            null,
            holderDid,
            holderKeyPair,
          ),
        },
      });

      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'unauthorized',
          message: 'unauthorized',
          statusCode: 401,
        }),
      );
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [
            ExchangeStates.AUTHENTICATION_REQUEST,
            ExchangeStates.AUTHENTICATION_FAILURE,
          ],
          { err: 'unauthorized' },
        ),
      );
    });
    it("should 401 if preauthCode doesn't match any depot", async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        payload: {
          exchange_id: exchange._id,
          jwt_vp: await generatePreauthCodeAuthJwt(
            depot,
            nanoid(),
            holderDid,
            holderKeyPair,
          ),
        },
      });

      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'unauthorized',
          message: 'unauthorized',
          statusCode: 401,
        }),
      );
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [
            ExchangeStates.AUTHENTICATION_REQUEST,
            ExchangeStates.AUTHENTICATION_FAILURE,
          ],
          { err: 'unauthorized' },
        ),
      );
    });
    it('should 200 if preauthCode matches a depot', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        payload: {
          exchange_id: exchange._id,
          jwt_vp: await generatePreauthCodeAuthJwt(
            depot,
            preauthCode,
            holderDid,
            holderKeyPair,
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: 'issuer',
        },
      });
      expect(
        await jwtVerify(response.json.token, holderAccessTokensSecret, {
          alg: 'HS384',
        }),
      ).toEqual({
        header: {
          alg: 'HS384',
          typ: 'JWT',
        },
        payload: {
          exp: expect.any(Number),
          iat: expect.any(Number),
          iss: tenant.did,
          nbf: expect.any(Number),
          sub: `depot:${depot._id}`,
          scope: [`exchange:${exchange._id}`],
        },
      });
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [
            ExchangeStates.AUTHENTICATION_REQUEST,
            ExchangeStates.AUTHENTICATION_SUCCESS,
          ],
          {
            depotId: new ObjectId(depot._id),
          },
        ),
      );
    });
  });

  describe('vp authentication', () => {
    let emailVcKeyPair;
    let emailVcJwt;
    let vpIssuerService;
    let exchange;
    beforeEach(async () => {
      emailVcKeyPair = generateKeyPair({ format: 'jwk' });
      vpIssuerService = await persistIssuerService({
        tenant,
        verifiablePresentationAuthRules: [
          {
            path: '$.credentialSubject.email',
            rule: 'equal',
          },
        ],
      });
      await persistDepot({
        tenant,
        service: vpIssuerService,
        authValues: ['adam@example.com'],
      });
      exchange = await persistExchange({
        tenant,
        service: vpIssuerService,
      });
      const emailVcId = 'did:velocity:v2:abc:1:1';
      emailVcJwt = await generateCredentialJwt(
        {
          vc: {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            id: emailVcId,
            issuer: tenant.did,
            issuanceDate: new Date().toISOString(),
            type: ['EmailV1.0', 'VerifiableCredential'],
            credentialSubject: {
              email: 'adam.smith@example.com',
            },
          },
          jti: emailVcId,
          sub: holderDid,
        },
        emailVcKeyPair.privateKey,
        toDidUrl(emailVcId, '#key-1'),
      );
    });

    it('should error if using vp auth', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        payload: {
          exchange_id: exchange._id,
          jwt_vp: await generateVpAuthJwt(
            [emailVcJwt],
            holderDid,
            holderKeyPair,
          ),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: ExchangeErrors.AUTHENTICATION_METHOD_UNSUPPORTED,
          message: ExchangeErrors.AUTHENTICATION_METHOD_UNSUPPORTED,
          statusCode: 400,
        }),
      );
    });
  });

  const findOneExchange = async (value) =>
    mongoDb()
      .collection('exchanges')
      .findOne({ _id: new ObjectId(value) });
});

const generatePreauthCodeAuthJwt = (depot, preauthCode, holderDid, keyPair) => {
  const didJwk = getDidUriFromJwk(keyPair.publicKey);
  const options = {
    issuer: didJwk,
    jti: nanoid(),
    kid: `${didJwk}#0`,
  };
  const payload = {
    id: nanoid(),
    issuer: holderDid,
    vp: {
      presentation_submission: {
        id: nanoid(),
        definition_id: nanoid(),
      },
    },
  };
  if (preauthCode != null) {
    payload.vp.vendorOriginContext = `depot:${depot._id}:${preauthCode}`;
  }
  return generateDocJwt(payload, keyPair.privateKey, options);
};

const generateVpAuthJwt = (vcJwts, holderDid, keyPair) => {
  const didJwk = getDidUriFromJwk(keyPair.publicKey);
  const options = {
    issuer: didJwk,
    jti: nanoid(),
    kid: `${didJwk}#0`,
  };
  const payload = {
    id: nanoid(),
    issuer: holderDid,
    vp: {
      presentation_submission: {
        id: nanoid(),
        definition_id: nanoid(),
      },
    },
  };
  if (vcJwts != null) {
    payload.vp.verifiableCredential = vcJwts;
    payload.vp.presentation_submission.descriptor_map = [
      { format: 'jwt_vc', path: '$.verifiableCredential[0]' },
    ];
  }
  return generateDocJwt(payload, keyPair.privateKey, options);
};

const expectedDbExchange = (tenant, exchange, newEvents, overrides) => {
  const exchangeEvents = newEvents ?? [
    ExchangeStates.NEW,
    ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
  ];
  let expectation = mongoify({
    ...exchange,
    events: exchange.events.concat(
      exchangeEvents.map((state) => ({ state, timestamp: expect.any(Date) })),
    ),
    tenantId: new ObjectId(tenant._id),
    disclosureConsentedAt: expect.any(Date),
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
  });

  for (const [key, value] of entries(overrides)) {
    expectation = set(key, value, expectation);
  }

  return expectation;
};
