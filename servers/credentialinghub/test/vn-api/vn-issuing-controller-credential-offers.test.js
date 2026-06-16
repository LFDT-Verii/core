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

const { ObjectId } = require('mongodb');
const { entries, map, set } = require('lodash/fp');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { mongoify } = require('@verii/tests-helpers');
const { jwtSign, jwtVerify } = require('@verii/jwt');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initCredentialFactory } = require('../../src/entities/credentials');
const {
  initExchangeFactory,
  ExchangeStates,
} = require('../../src/entities/exchanges');
const { initDepotFactory } = require('../../src/entities/depots');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');

const testUrl = (tenant2) => `/vn-api/r/${tenant2.did}/credential-offers`;

describe('vn-api > credential offers', () => {
  let fastify;

  let tenant;
  let preauthIssuerService;
  let holderAccessTokensSecret;
  let depots;
  let exchange;

  let persistTenant;
  let persistKey;
  let persistIssuerService;
  let persistDepot;
  let persistExchange;
  let persistCredential;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistExchange } = initExchangeFactory(fastify));
    ({ persistCredential } = initCredentialFactory(fastify));

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
  });

  beforeEach(async () => {
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
    depots = [
      await persistDepot({
        tenant,
        service: preauthIssuerService,
      }),
      await persistDepot({
        tenant,
        service: preauthIssuerService,
      }),
      await persistDepot({
        tenant,
        service: preauthIssuerService,
      }),
    ];
    exchange = await persistExchange({
      tenant,
      service: preauthIssuerService,
      depotId: new ObjectId(depots[0]._id),
      events: [
        {
          state: ExchangeStates.AUTHENTICATION_SUCCESS,
          timestamp: new Date(),
        },
      ],
    });
  });

  after(async () => {
    await fastify.close();
  });

  it('should should return 401 when token missing', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      payload: {
        offerHashes: [],
      },
    });

    expect(response.statusCode).toEqual(401);
    expect(response.json).toEqual({
      code: 'FST_BEARER_AUTH_MISSING_AUTHORIZATION_HEADER',
      error: 'Unauthorized',
      message: 'missing authorization header',
      statusCode: 401,
    });
  });
  it('should should return 401 when token expired', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      headers: {
        authorization: `Bearer ${await buildTestAccessToken(
          tenant.did,
          exchange._id,
          depots[0]._id,
          holderAccessTokensSecret,
          true,
        )}`,
      },
      payload: {
        offerHashes: [],
      },
    });

    expect(response.statusCode).toEqual(401);
    expect(response.json).toEqual({
      error: 'Unauthorized',
      message: 'unauthorized',
      statusCode: 401,
    });
  });
  it('should 401 when exchange id missing from token', async () => {
    const noPropResponse = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      headers: {
        authorization: `Bearer ${await buildTestAccessToken(
          tenant.did,
          undefined,
          depots[0]._id,
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        offerHashes: [],
      },
    });

    expect(noPropResponse.statusCode).toEqual(401);
    expect(noPropResponse.json).toEqual({
      error: 'Unauthorized',
      message: 'Unauthorized',
      statusCode: 401,
    });

    const emptyPropResponse = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      headers: {
        authorization: `Bearer ${await buildTestAccessToken(
          tenant.did,
          '',
          depots[0]._id,
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        offerHashes: [],
      },
    });

    expect(emptyPropResponse.statusCode).toEqual(401);
    expect(emptyPropResponse.json).toEqual({
      error: 'Unauthorized',
      message: 'Unauthorized',
      statusCode: 401,
    });
  });
  it('should 401 when exchange id in token doesnt exist', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      headers: {
        authorization: `Bearer ${await buildTestAccessToken(
          tenant.did,
          new ObjectId(),
          depots[0]._id,
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        offerHashes: [],
      },
    });

    expect(response.statusCode).toEqual(401);
    expect(response.json).toEqual({
      error: 'Unauthorized',
      message: 'Unauthorized',
      statusCode: 401,
    });
  });
  it('should 401 when depot id is missing from token', async () => {
    const noPropResponse = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      headers: {
        authorization: `Bearer ${await buildTestAccessToken(
          tenant.did,
          exchange._id,
          undefined,
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        offerHashes: [],
      },
    });

    expect(noPropResponse.statusCode).toEqual(401);
    expect(noPropResponse.json).toEqual({
      error: 'Unauthorized',
      message: 'Unauthorized',
      statusCode: 401,
    });

    const emptyPropResponse = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      headers: {
        authorization: `Bearer ${await buildTestAccessToken(
          tenant.did,
          exchange._id,
          '',
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        offerHashes: [],
      },
    });

    expect(emptyPropResponse.statusCode).toEqual(401);
    expect(emptyPropResponse.json).toEqual({
      error: 'Unauthorized',
      message: 'Unauthorized',
      statusCode: 401,
    });
  });
  it('should 401 when depot in token doesnt exist', async () => {
    const emptyPropResponse = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      headers: {
        authorization: `Bearer ${await buildTestAccessToken(
          tenant.did,
          exchange._id,
          new ObjectId(),
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        offerHashes: [],
      },
    });

    expect(emptyPropResponse.statusCode).toEqual(401);
    expect(emptyPropResponse.json).toEqual({
      error: 'Unauthorized',
      message: 'Unauthorized',
      statusCode: 401,
    });
  });
  it("should 401 when exchange's depot is different from token's scope", async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      headers: {
        authorization: `Bearer ${await buildTestAccessToken(
          tenant.did,
          exchange._id,
          depots[1]._id,
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        offerHashes: [],
      },
    });

    expect(response.statusCode).toEqual(401);
    expect(response.json).toEqual({
      error: 'Unauthorized',
      message: 'Unauthorized',
      statusCode: 401,
    });
  });
  it('should 400 if the exchange is complete', async () => {
    const exchange2 = await persistExchange({
      tenant,
      service: preauthIssuerService,
      depotId: new ObjectId(depots[0]._id),
      events: [
        {
          state: ExchangeStates.AUTHENTICATION_SUCCESS,
          timestamp: new Date(),
        },
        {
          state: ExchangeStates.COMPLETE,
          timestamp: new Date(),
        },
      ],
    });

    const response = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      headers: {
        authorization: `Bearer ${await buildTestAccessToken(
          tenant.did,
          exchange2._id,
          depots[0]._id,
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        offerHashes: [],
      },
    });

    expect(response.statusCode).toEqual(401);
    expect(response.json).toEqual({
      error: 'Unauthorized',
      message: 'Unauthorized',
      statusCode: 401,
    });
  });

  describe('credential offers', () => {
    let credentials;

    beforeEach(async () => {
      credentials = [
        await persistCredential({
          tenant,
          depot: depots[0],
          content: {
            type: ['EmailV1.0'],
            credentialSubject: { email: 'bob.foobar@example.com' },
          },
        }),
        await persistCredential({
          tenant,
          depot: depots[0],
          content: {
            type: ['PhoneV1.0'],
            credentialSubject: { email: '+15558094151' },
          },
        }),
        await persistCredential({
          tenant,
          depot: depots[1],
          content: {
            type: ['EmailV1.0'],
            credentialSubject: { email: 'jane.jar@example.com' },
          },
        }),
        await persistCredential({
          tenant,
          depot: depots[1],
          content: {
            type: ['EmailV1.0'],
            credentialSubject: { email: 'jane.jar@example.com' },
          },
        }),
      ];
    });

    it('should return no offers if there are none', async () => {
      const exchange2 = await persistExchange({
        tenant,
        service: preauthIssuerService,
        depotId: new ObjectId(depots[2]._id),
        events: [
          {
            state: ExchangeStates.AUTHENTICATION_SUCCESS,
            timestamp: new Date(),
          },
        ],
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await buildTestAccessToken(
            tenant.did,
            exchange2._id,
            depots[2]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          offerHashes: [],
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        challenge: expect.any(String),
        offers: [],
      });
      await expect(findOneExchange(exchange2._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange2,
          [ExchangeStates.OFFERS_REQUESTED, ExchangeStates.OFFERS_SENT],
          {
            depotId: new ObjectId(depots[2]._id),
            credentialIds: [],
          },
        ),
      );
    });
    it('should return many offers if there are some for the requested depot', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await buildTestAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          offerHashes: [],
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        challenge: expect.any(String),
        offers: map(
          (credential) => expectedOffer(tenant, credential),
          [credentials[1], credentials[0]],
        ),
      });
      await expectSignedChallenge(
        response.json.challenge,
        exchange._id,
        tenant.hostUrl,
        holderAccessTokensSecret,
        fastify.config.challengesExpireIn,
      );
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [ExchangeStates.OFFERS_REQUESTED, ExchangeStates.OFFERS_SENT],
          {
            depotId: new ObjectId(depots[0]._id),
            credentialIds: [
              new ObjectId(credentials[1]._id),
              new ObjectId(credentials[0]._id),
            ],
          },
        ),
      );
    });
    it('should return only claimable offers for the requested depot', async () => {
      await persistCredential({
        tenant,
        depot: depots[0],
        content: {
          type: ['EmailV1.0'],
          credentialSubject: { email: 'foo@example.com' },
        },
        rejectedAt: new Date(),
      });
      await persistCredential({
        tenant,
        depot: depots[0],
        content: {
          type: ['EmailV1.0'],
          credentialSubject: { email: 'bar@example.com' },
        },
        acceptedAt: new Date(),
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await buildTestAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          offerHashes: [],
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        challenge: expect.any(String),
        offers: map(
          (credential) => expectedOffer(tenant, credential),
          [credentials[1], credentials[0]],
        ),
      });
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [ExchangeStates.OFFERS_REQUESTED, ExchangeStates.OFFERS_SENT],
          {
            depotId: new ObjectId(depots[0]._id),
            credentialIds: [
              new ObjectId(credentials[1]._id),
              new ObjectId(credentials[0]._id),
            ],
          },
        ),
      );
    });
    it('should return only PhoneV1.0 offers from the depot', async () => {
      const exchange2 = await persistExchange({
        tenant,
        service: preauthIssuerService,
        depotId: new ObjectId(depots[0]._id),
        events: [
          {
            state: ExchangeStates.AUTHENTICATION_SUCCESS,
            timestamp: new Date(),
          },
        ],
        credentialTypes: ['PhoneV1.0'],
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await buildTestAccessToken(
            tenant.did,
            exchange2._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {},
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        challenge: expect.any(String),
        offers: map(
          (credential) => expectedOffer(tenant, credential),
          [credentials[1]],
        ),
      });
      await expect(findOneExchange(exchange2._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange2,
          [ExchangeStates.OFFERS_REQUESTED, ExchangeStates.OFFERS_SENT],
          {
            depotId: new ObjectId(depots[0]._id),
            credentialIds: [new ObjectId(credentials[1]._id)],
          },
        ),
      );
    });
    it('should return only offers not containing the contentHash', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await buildTestAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          offerHashes: [credentials[0].contentHash],
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        challenge: expect.any(String),
        offers: map(
          (credential) => expectedOffer(tenant, credential),
          [credentials[1]],
        ),
      });
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [ExchangeStates.OFFERS_REQUESTED, ExchangeStates.OFFERS_SENT],
          {
            depotId: new ObjectId(depots[0]._id),
            credentialIds: [new ObjectId(credentials[1]._id)],
          },
        ),
      );
    });
    it('should return only unique offers', async () => {
      const exchange2 = await persistExchange({
        tenant,
        service: preauthIssuerService,
        depotId: new ObjectId(depots[1]._id),
        events: [
          {
            state: ExchangeStates.AUTHENTICATION_SUCCESS,
            timestamp: new Date(),
          },
        ],
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await buildTestAccessToken(
            tenant.did,
            exchange2._id,
            depots[1]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {},
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        challenge: expect.any(String),
        offers: [expectedOffer(tenant, credentials[3])],
      });
      await expect(findOneExchange(exchange2._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange2,
          [ExchangeStates.OFFERS_REQUESTED, ExchangeStates.OFFERS_SENT],
          {
            depotId: new ObjectId(depots[1]._id),
            credentialIds: [
              new ObjectId(credentials[3]._id),
              new ObjectId(credentials[2]._id),
            ],
          },
        ),
      );
    });
    it('should still retrieve offers if error event exists', async () => {
      const exchange2 = await persistExchange({
        tenant,
        service: preauthIssuerService,
        depotId: new ObjectId(depots[0]._id),
        events: [
          {
            state: ExchangeStates.AUTHENTICATION_SUCCESS,
            timestamp: new Date(),
          },
          {
            state: ExchangeStates.UNEXPECTED_ERROR,
            timestamp: new Date(),
          },
        ],
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await buildTestAccessToken(
            tenant.did,
            exchange2._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          offerHashes: [],
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        challenge: expect.any(String),
        offers: map(
          (credential) => expectedOffer(tenant, credential),
          [credentials[1], credentials[0]],
        ),
      });
      await expect(findOneExchange(exchange2._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange2,
          [ExchangeStates.OFFERS_REQUESTED, ExchangeStates.OFFERS_SENT],
          {
            depotId: new ObjectId(depots[0]._id),
            credentialIds: [
              new ObjectId(credentials[1]._id),
              new ObjectId(credentials[0]._id),
            ],
          },
        ),
      );
    });
  });

  const findOneExchange = async (value) =>
    mongoDb()
      .collection('exchanges')
      .findOne({ _id: new ObjectId(value) });
});

const buildTestAccessToken = (
  tenantDid,
  exchangeId,
  depotId,
  secret,
  expired,
) => {
  const payload = {};
  if (exchangeId != null) {
    payload.scope = [`exchange:${exchangeId.toString()}`];
  }
  const options = {
    alg: 'HS384',
    issuer: tenantDid,
    nbf: new Date(),
  };
  if (expired) {
    options.expiresIn = '-30m';
  } else {
    options.expiresIn = '30m';
  }
  if (depotId != null) {
    options.subject = `depot:${depotId.toString()}`;
  }

  return jwtSign(payload, secret, options);
};

const expectSignedChallenge = async (
  challenge,
  exchangeId,
  hostUrl,
  challengeSecret,
  challengesExpireInMs,
) => {
  const { header, payload } = await jwtVerify(challenge, challengeSecret, {
    audience: hostUrl,
    issuer: hostUrl,
  });

  expect(challenge.split('.')).toHaveLength(3);
  expect(header).toEqual(
    expect.objectContaining({
      alg: 'HS256',
      typ: 'JWT',
    }),
  );
  expect(payload).toEqual(
    expect.objectContaining({
      exchangeId: exchangeId.toString(),
      iss: hostUrl,
      aud: hostUrl,
      iat: expect.any(Number),
      exp: expect.any(Number),
    }),
  );
  expect(payload.exp).toBeGreaterThan(payload.iat);
  expect(
    Math.abs(
      payload.exp - payload.iat - Math.floor(challengesExpireInMs / 1000),
    ),
  ).toBeLessThanOrEqual(1);
};

const expectedOffer = (tenant, credential) => ({
  ...credential.content,
  id: credential._id,
  hash: credential.contentHash,
  issuer: {
    id: tenant.did,
  },
});

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
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
  });

  for (const [key, value] of entries(overrides)) {
    expectation = set(key, value, expectation);
  }

  return expectation;
};
