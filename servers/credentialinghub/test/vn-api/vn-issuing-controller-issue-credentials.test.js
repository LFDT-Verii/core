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
const {
  mockHttpClientModule,
  mockHttpClientError,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const mockAddCredentialMetadataEntry = mock.fn();
const mockCreateCredentialMetadataList = mock.fn();
const mockAddRevocationListSigned = mock.fn();
mock.module('@verii/metadata-registration', {
  namedExports: {
    ...require('@verii/metadata-registration'),
    initRevocationRegistry: () => ({
      addRevocationListSigned: mockAddRevocationListSigned,
    }),
    initMetadataRegistry: () => ({
      addCredentialMetadataEntry: mockAddCredentialMetadataEntry,
      createCredentialMetadataList: mockCreateCredentialMetadataList,
    }),
    initVerificationCoupon: () => ({}),
  },
});

const { ObjectId } = require('mongodb');
const {
  entries,
  find,
  first,
  isEqual,
  keyBy,
  omit,
  map,
  set,
} = require('lodash/fp');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { mongoify } = require('@verii/tests-helpers');
const { jwtDecode, jwtSign } = require('@verii/jwt');
const { nanoid } = require('nanoid');
const { generateKeyPair } = require('@verii/crypto');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { VelocityRevocationListType } = require('@verii/vc-checks');
const { DID_FORMAT } = require('@verii/test-regexes');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const { applyOverrides } = require('@verii/common-functions');
const { jwtVcExpectation } = require('../helpers/jwt-vc-expectation');
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
const { NotificationEventTypes } = require('../../src/entities/notifications');

const testUrl = (tenant2) => `/vn-api/r/${tenant2.did}/issue-credentials`;

describe('vn-api > issue credentials', () => {
  let fastify;

  let tenant;
  let preauthIssuerService;
  let holderAccessTokensSecret;
  let depots;
  let exchange;
  let credentials;
  let holderDid;
  let holderKeyPair;

  let persistTenant;
  let persistKey;
  let persistIssuerService;
  let persistDepot;
  let persistExchange;
  let persistCredential;
  const expiredChallengeIssuedAt = Date.UTC(2023, 0, 1, 0, 0, 0, 0) / 1000;

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
    fastify.resetOverrides();
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
    await mongoDb().collection('notification_events').deleteMany({});
    resetMockHttpClient();
    mockAddRevocationListSigned.mock.mockImplementation(() =>
      Promise.resolve(true),
    );
    mockAddCredentialMetadataEntry.mock.mockImplementation(() =>
      Promise.resolve(true),
    );
    mockCreateCredentialMetadataList.mock.mockImplementation(() =>
      Promise.resolve(true),
    );

    holderKeyPair = generateKeyPair({ format: 'jwk' });
    holderDid = getDidUriFromJwk(holderKeyPair.publicKey);

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

    credentials = [
      await persistCredential({
        tenant,
        depot: depots[0],
        typeMetadata: credentialTypeMetadata['EmailV1.0'],
        content: {
          type: ['EmailV1.0'],
          credentialSubject: { email: 'bob.foobar@example.com' },
        },
      }),
      await persistCredential({
        tenant,
        depot: depots[0],
        typeMetadata: credentialTypeMetadata['PhoneV1.0'],
        content: {
          type: ['PhoneV1.0'],
          credentialSubject: { phone: '+15558094151' },
        },
      }),
      await persistCredential({
        tenant,
        depot: depots[1],
        typeMetadata: credentialTypeMetadata['EmailV1.0'],
        content: {
          type: ['EmailV1.0'],
          credentialSubject: { email: 'jane.jar@example.com' },
        },
      }),
    ];
  });

  after(async () => {
    await fastify.close();
  });

  const loadChallenge = (exchangeId, challengeOptions = {}) =>
    buildIssuingChallenge(
      exchangeId,
      holderAccessTokensSecret,
      tenant.hostUrl,
      fastify.config.challengesExpireIn,
      challengeOptions,
    );

  it('should 401 when exchange id missing from token', async () => {
    const noPropResponse = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      headers: {
        authorization: `Bearer ${await testAccessToken(
          tenant.did,
          undefined,
          depots[0]._id,
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        approvedOfferIds: [],
        proof: { proof_type: 'jwt', jwt: '' },
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
        authorization: `Bearer ${await testAccessToken(
          tenant.did,
          '',
          depots[0]._id,
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        approvedOfferIds: [],
        proof: { proof_type: 'jwt', jwt: '' },
      },
    });

    expect(emptyPropResponse.statusCode).toEqual(401);
    expect(emptyPropResponse.json).toEqual({
      error: 'Unauthorized',
      message: 'Unauthorized',
      statusCode: 401,
    });
  });
  it('should 401 when exchange doesnt exist', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      headers: {
        authorization: `Bearer ${await testAccessToken(
          tenant.did,
          new ObjectId(),
          depots[0]._id,
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        approvedOfferIds: [],
        proof: { proof_type: 'jwt', jwt: '' },
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
        authorization: `Bearer ${await testAccessToken(
          tenant.did,
          exchange._id,
          undefined,
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        approvedOfferIds: [],
        proof: { proof_type: 'jwt', jwt: '' },
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
        authorization: `Bearer ${await testAccessToken(
          tenant.did,
          exchange._id,
          '',
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        approvedOfferIds: [],
        proof: { proof_type: 'jwt', jwt: '' },
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
        authorization: `Bearer ${await testAccessToken(
          tenant.did,
          exchange._id,
          new ObjectId(),
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        approvedOfferIds: [],
        proof: { proof_type: 'jwt', jwt: '' },
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
        authorization: `Bearer ${await testAccessToken(
          tenant.did,
          exchange._id,
          depots[1]._id,
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        approvedOfferIds: [],
        proof: { proof_type: 'jwt', jwt: '' },
      },
    });

    expect(response.statusCode).toEqual(401);
    expect(response.json).toEqual({
      error: 'Unauthorized',
      message: 'Unauthorized',
      statusCode: 401,
    });
  });
  it('should 502 if the issuer is not permitted', async () => {
    mockAddCredentialMetadataEntry.mock.mockImplementation(async () => {
      const e = new Error('Permissions: mock error primary lacks permissions');
      e.errorCode = 'career_issuing_not_permitted';
      return Promise.reject(e);
    });

    const response = await fastify.injectJson({
      method: 'POST',
      url: testUrl(tenant),
      headers: {
        authorization: `Bearer ${await testAccessToken(
          tenant.did,
          exchange._id,
          depots[0]._id,
          holderAccessTokensSecret,
        )}`,
      },
      payload: {
        approvedOfferIds: [credentials[0]._id, credentials[1]._id],
        proof: await buildProof(
          holderDid,
          holderKeyPair,
          await loadChallenge(exchange._id),
        ),
      },
    });

    expect(response.statusCode).toEqual(502);
    expect(response.json).toEqual(
      errorResponseMatcher({
        error: 'Bad Gateway',
        errorCode: 'career_issuing_not_permitted',
        message: 'Permissions: mock error primary lacks permissions',
        statusCode: 502,
      }),
    );
  });

  describe('proof of key possession failures', () => {
    it('should 400 if proof is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'proof_required',
          message: 'proof_required',
        }),
      );
    });
    it('should 400 if proof is not a jwt proof_type', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: {
            proof_type: 'other',
            jwt: (
              await buildProof(
                holderDid,
                holderKeyPair,
                await loadChallenge(exchange._id),
              )
            ).jwt,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'request_validation_failed',
          message:
            'body/proof/proof_type must be equal to one of the allowed values',
        }),
      );
    });

    it('should 400 if proof is missing the jwt', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: { proof_type: 'jwt' },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'request_validation_failed',
          message: "body/proof must have required property 'jwt'",
        }),
      );
    });
    it('should 400 if proof kid is missing', async () => {
      mockHttpClientError('get', new Error('error'));

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(
            holderDid,
            holderKeyPair,
            await loadChallenge(exchange._id),
            { useKid: false },
          ),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'proof_kid_required',
          message: 'proof.jwt is missing a kid',
        }),
      );
    });
    it('should 400 if kid not resolvable', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(
            'did:key:123',
            holderKeyPair,
            await loadChallenge(exchange._id),
          ),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'proof_kid_invalid',
          message: 'proof_kid_invalid',
        }),
      );
    });
    it('should 400 if proof not verifiable', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(
            holderDid,
            generateKeyPair({ format: 'jwk' }),
            await loadChallenge(exchange._id),
          ),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'proof_verify_failed',
          message: 'proof_verify_failed',
        }),
      );
    });
    it('should 400 if iss is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(
            holderDid,
            holderKeyPair,
            await loadChallenge(exchange._id),
            { iss: undefined },
          ),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'proof_iss_required',
          message: 'proof_iss_required',
        }),
      );
    });
    it('should 400 if iss is incorrect', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(
            holderDid,
            holderKeyPair,
            await loadChallenge(exchange._id),
            { iss: '12345' },
          ),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'proof_iss_invalid',
          message: 'proof_iss_invalid',
        }),
      );
    });
    it('should 400 if aud is incorrect', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(
            holderDid,
            holderKeyPair,
            await loadChallenge(exchange._id),
            { aud: '12345' },
          ),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'proof_aud_invalid',
          message: 'proof_aud_invalid',
        }),
      );
    });
    it('should 400 if signed challenge is not the correct challenge value', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(holderDid, holderKeyPair, nanoid()),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'proof_challenge_mismatch',
          message: 'proof_challenge_mismatch',
        }),
      );
    });
    it('should 400 if challenge expired', async () => {
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
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange2._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(
            holderDid,
            holderKeyPair,
            await loadChallenge(exchange2._id, {
              iat: expiredChallengeIssuedAt,
              exp:
                expiredChallengeIssuedAt +
                Math.floor(fastify.config.challengesExpireIn / 1000),
            }),
          ),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'proof_challenge_expired',
          message: 'proof_challenge_expired',
        }),
      );
    });
  });

  describe('offer approval use cases', () => {
    it('should not be able to approve previously approved credentials', async () => {
      const approvedCredential = await persistCredential({
        tenant,
        depot: depots[0],
        typeMetadata: credentialTypeMetadata['EmailV1.0'],
        content: {
          type: ['EmailV1.0'],
          credentialSubject: { email: 'bob.foobar@example.com' },
        },
        acceptedAt: new Date(),
      });

      const accessToken = await testAccessToken(
        tenant.did,
        exchange._id,
        depots[0]._id,
        holderAccessTokensSecret,
      );
      const proof = await buildProof(
        holderDid,
        holderKeyPair,
        await loadChallenge(exchange._id),
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          rejectedOfferIds: [],
          approvedOfferIds: [approvedCredential._id],
          proof,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual([]);
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [ExchangeStates.CLAIMING_IN_PROGRESS, ExchangeStates.COMPLETE],
          {
            finalizedCredentialIds: [],
          },
        ),
      );
    });
    it('should return no credentials if there are none approved', async () => {
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
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange2._id,
            depots[2]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [],
          proof: await buildProof(
            holderDid,
            holderKeyPair,
            await loadChallenge(exchange2._id),
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual([]);
      await expect(findOneExchange(exchange2._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange2,
          [ExchangeStates.CLAIMING_IN_PROGRESS, ExchangeStates.COMPLETE],
          {
            finalizedCredentialIds: [],
          },
        ),
      );
    });
    it("should return no credentials if the approved ids don't exist", async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [new ObjectId()],
          proof: await buildProof(
            holderDid,
            holderKeyPair,
            await loadChallenge(exchange._id),
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual([]);
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [ExchangeStates.CLAIMING_IN_PROGRESS, ExchangeStates.COMPLETE],
          {
            finalizedCredentialIds: [],
          },
        ),
      );
    });
    it('should return many credentials if there are some for the requested depot', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(
            holderDid,
            holderKeyPair,
            await loadChallenge(exchange._id),
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
      const vcs = response.json;
      const decodedVcs = map(jwtDecode, vcs);
      expect(decodedVcs).toEqual(
        map(
          ({ payload: { vc, jti } }) =>
            jwtVcExpectation({
              tenant,
              issuerService: preauthIssuerService,
              credentialId: jti,
              subjectId: holderDid,
              credential: find(
                ({ content }) =>
                  isEqual(
                    omit(['id', '@context'], vc.credentialSubject),
                    content.credentialSubject,
                  ),
                credentials,
              ),
              credentialTypeMetadata:
                credentialTypeMetadata[
                  find((type) => type !== 'VerifiableCredential', vc.type)
                ],
            }),
          decodedVcs,
        ),
      );

      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [ExchangeStates.CLAIMING_IN_PROGRESS, ExchangeStates.COMPLETE],
          {
            finalizedCredentialIds: [
              new ObjectId(credentials[1]._id),
              new ObjectId(credentials[0]._id),
            ],
          },
        ),
      );

      await expect(
        findCredentials([credentials[0]._id, credentials[1]._id]),
      ).resolves.toEqual([
        expectedDbCredential(credentials[0], tenant, { jwtVc: vcs[1] }),
        expectedDbCredential(credentials[1], tenant, { jwtVc: vcs[0] }),
      ]);
    });
    it('should enqueue issued credential notification events when notifications are enabled', async () => {
      fastify.overrides.reqConfig = enableNotifications([
        NotificationEventTypes.CREDENTIAL_ISSUED,
      ]);

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(
            holderDid,
            holderKeyPair,
            await loadChallenge(exchange._id),
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
      const events = await mongoDb()
        .collection('notification_events')
        .find({})
        .toArray();
      expect(events).toHaveLength(2);
      expect(events).toEqual(
        expect.arrayContaining([
          expectedCredentialNotificationEvent({
            eventType: NotificationEventTypes.CREDENTIAL_ISSUED,
            credential: credentials[0],
            credentialType: 'EmailV1.0',
            data: {
              credentialDid: expect.stringMatching(DID_FORMAT),
              digestSRI: expect.stringMatching(/^sha384-/),
            },
          }),
          expectedCredentialNotificationEvent({
            eventType: NotificationEventTypes.CREDENTIAL_ISSUED,
            credential: credentials[1],
            credentialType: 'PhoneV1.0',
            data: {
              credentialDid: expect.stringMatching(DID_FORMAT),
              digestSRI: expect.stringMatching(/^sha384-/),
            },
          }),
        ]),
      );
      events.forEach((event) => {
        expect(event.payload.id).toEqual(event._id);
      });
      expect(JSON.stringify(events)).not.toContain('bob.foobar@example.com');
      expect(JSON.stringify(events)).not.toContain('+15558094151');
    });
    it('should return many credentials and not write the jwtVC if autoCleanPII is on', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        autocleanFinalizedOfferPii: true,
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          approvedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(
            holderDid,
            holderKeyPair,
            await loadChallenge(exchange._id),
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
      const vcs = response.json;
      const decodedVcs = map(jwtDecode, vcs);
      expect(decodedVcs).toEqual(
        map(
          ({ payload: { vc, jti } }) =>
            jwtVcExpectation({
              tenant,
              issuerService: preauthIssuerService,
              credentialId: jti,
              subjectId: holderDid,
              credential: find(
                ({ content }) =>
                  isEqual(
                    omit(['id', '@context'], vc.credentialSubject),
                    content.credentialSubject,
                  ),
                credentials,
              ),
              credentialSubjectContext: [
                'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
              ],
              credentialTypeMetadata: credentialTypeMetadata[first(vc.type)],
            }),
          decodedVcs,
        ),
      );

      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [ExchangeStates.CLAIMING_IN_PROGRESS, ExchangeStates.COMPLETE],
          {
            finalizedCredentialIds: [
              new ObjectId(credentials[1]._id),
              new ObjectId(credentials[0]._id),
            ],
          },
        ),
      );

      await expect(
        findCredentials([credentials[0]._id, credentials[1]._id]),
      ).resolves.toEqual([
        expectedDbCredential(credentials[0], tenant, { content: {} }),
        expectedDbCredential(credentials[1], tenant, { content: {} }),
      ]);

      fastify.resetOverrides();
    });
  });

  describe('offer rejection use cases', () => {
    it('should reject selected credentials', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          rejectedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(
            holderDid,
            holderKeyPair,
            await loadChallenge(exchange._id),
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual([]);
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [ExchangeStates.CLAIMING_IN_PROGRESS, ExchangeStates.COMPLETE],
          {
            finalizedCredentialIds: [
              new ObjectId(credentials[1]._id),
              new ObjectId(credentials[0]._id),
            ],
          },
        ),
      );
    });
    it('should enqueue rejected credential notification events when notifications are enabled', async () => {
      fastify.overrides.reqConfig = enableNotifications([
        NotificationEventTypes.CREDENTIAL_REJECTED,
      ]);

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: {
          authorization: `Bearer ${await testAccessToken(
            tenant.did,
            exchange._id,
            depots[0]._id,
            holderAccessTokensSecret,
          )}`,
        },
        payload: {
          rejectedOfferIds: [credentials[0]._id, credentials[1]._id],
          proof: await buildProof(
            holderDid,
            holderKeyPair,
            await loadChallenge(exchange._id),
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
      const events = await mongoDb()
        .collection('notification_events')
        .find({})
        .toArray();
      expect(events).toHaveLength(2);
      expect(events).toEqual(
        expect.arrayContaining([
          expectedCredentialNotificationEvent({
            eventType: NotificationEventTypes.CREDENTIAL_REJECTED,
            credential: credentials[0],
            credentialType: 'EmailV1.0',
            data: {
              rejectedAt: expect.any(String),
            },
          }),
          expectedCredentialNotificationEvent({
            eventType: NotificationEventTypes.CREDENTIAL_REJECTED,
            credential: credentials[1],
            credentialType: 'PhoneV1.0',
            data: {
              rejectedAt: expect.any(String),
            },
          }),
        ]),
      );
      expect(JSON.stringify(events)).not.toContain('bob.foobar@example.com');
      expect(JSON.stringify(events)).not.toContain('+15558094151');
    });
    it('should not be able to approve rejected credentials', async () => {
      const accessToken = await testAccessToken(
        tenant.did,
        exchange._id,
        depots[0]._id,
        holderAccessTokensSecret,
      );
      const proof = await buildProof(
        holderDid,
        holderKeyPair,
        await loadChallenge(exchange._id),
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          rejectedOfferIds: [credentials[0]._id],
          approvedOfferIds: [credentials[0]._id],
          proof,
        },
      });

      // expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual([]);
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [ExchangeStates.CLAIMING_IN_PROGRESS, ExchangeStates.COMPLETE],
          {
            finalizedCredentialIds: [new ObjectId(credentials[0]._id)],
          },
        ),
      );
    });
  });

  const findOneExchange = async (value) =>
    mongoDb()
      .collection('exchanges')
      .findOne({ _id: new ObjectId(value) });

  const findCredentials = async (ids) =>
    mongoDb()
      .collection('credentials')
      .find({ _id: { $in: map((id) => new ObjectId(id), ids) } })
      .toArray();

  const expectedCredentialNotificationEvent = ({
    eventType,
    credential,
    credentialType,
    data,
  }) =>
    expect.objectContaining({
      _id: expect.stringMatching(/^evt_/),
      type: eventType,
      version: 1,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: expect.any(Date),
      lockedBy: null,
      lockedUntil: null,
      lastError: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      deliveredAt: null,
      deadAt: null,
      retentionExpiresAt: null,
      payload: expect.objectContaining({
        id: expect.stringMatching(/^evt_/),
        type: eventType,
        version: 1,
        occurredAt: expect.any(String),
        tenantId: tenant._id,
        tenantDid: tenant.did,
        serviceId: preauthIssuerService._id,
        depotId: depots[0]._id,
        exchangeId: exchange._id,
        resource: {
          type: 'credential',
          id: credential._id,
        },
        data: expect.objectContaining({
          credentialTypes: [credentialType],
          ...data,
        }),
      }),
    });
});

const testAccessToken = (tenantDid, exchangeId, depotId, secret) => {
  const payload = {};
  if (exchangeId != null) {
    payload.scope = [`exchange:${exchangeId.toString()}`];
  }
  const options = {
    alg: 'HS384',
    issuer: tenantDid,
    nbf: new Date(),
    expiresIn: '60m',
  };
  if (depotId != null) {
    options.subject = `depot:${depotId.toString()}`;
  }

  return jwtSign(payload, secret, options);
};

const buildIssuingChallenge = (
  exchangeId,
  secret,
  hostUrl,
  challengesExpireInMs,
  challengeOptions = {},
) => {
  const issuedAt = challengeOptions.iat ?? Math.floor(Date.now() / 1000);

  return jwtSign({ exchangeId: exchangeId.toString() }, secret, {
    alg: 'HS256',
    audience: hostUrl,
    exp:
      challengeOptions.exp ??
      issuedAt + Math.floor(challengesExpireInMs / 1000),
    iat: issuedAt,
    issuer: hostUrl,
    jti: challengeOptions.jti ?? nanoid(),
  });
};

const expectedDbCredential = (credential, tenant, overrides) =>
  applyOverrides(
    mongoify({
      ...credential,
      did: expect.stringMatching(DID_FORMAT),
      tenantId: tenant._id,
      acceptedAt: expect.any(Date),
      credentialSubjectId: expect.stringMatching(DID_FORMAT),
      credentialStatus: expectedCredentialStatus(overrides),
      digestSRI: expect.stringMatching(/sha384-[a-zA-Z0-9+/]+/),
      updatedAt: expect.any(Date),
    }),
    overrides,
  );

const expectedCredentialStatus = (overrides = {}) => {
  if (overrides.jwtVc != null) {
    return jwtDecode(overrides.jwtVc).payload.vc.credentialStatus;
  }
  return {
    id: expect.stringMatching(
      '^ethereum:0x[0-9a-fA-F]+/getRevokedStatus\\?address=0x[0-9a-zA-F]+&listId=\\d+&index=\\d+$',
    ),
    type: VelocityRevocationListType,
  };
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
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
  });

  for (const [key, value] of entries(overrides)) {
    expectation = set(key, value, expectation);
  }

  return expectation;
};

const buildProof = async (
  didJwk,
  keyPair,
  challenge,
  { useKid = true, ...payloadOverrides } = {},
) => {
  const options = {
    jwk: keyPair.publicKey,
    alg: keyPair.publicKey.crv === 'P-256' ? 'ES256' : 'ES256K',
  };
  if (useKid) {
    options.kid = `${didJwk}#0`;
  }
  const jwt = await jwtSign(
    applyOverrides(
      {
        aud: 'https://localhost.test',
        nonce: challenge,
        iss: didJwk,
      },
      payloadOverrides,
    ),
    keyPair.privateKey,
    options,
  );
  return {
    proof_type: 'jwt',
    jwt,
  };
};

const credentialTypeMetadata = keyBy('credentialType', [
  {
    credentialType: 'EmailV1.0',
    layer1: true,
    schemaUrl:
      'https://velocitynetwork.foundation/schemas/email-v1.0.schema.json',
    jsonldContext: [
      'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
    ],
  },
  {
    credentialType: 'PhoneV1.0',
    layer1: true,
    schemaUrl:
      'https://velocitynetwork.foundation/schemas/phone-v1.0.schema.json',
    jsonldContext: [
      'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
    ],
  },
  {
    credentialType: 'EmploymentCurrentV1.1',
    layer1: true,
    schemaUrl:
      'https://velocitynetwork.foundation/schemas/employment-v1.1.schema.json',
    jsonldContext: [
      'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
    ],
  },
  {
    credentialType: 'EmploymentCurrentV1.0',
    layer1: true,
    schemaUrl:
      'https://velocitynetwork.foundation/schemas/employment-v1.0.schema.json',
    jsonldContext: [
      'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.0.json',
    ],
  },
  {
    credentialType: 'PastEmploymentPosition',
    layer1: true,
    schemaUrl: 'http://oracle.localhost.test/schemas/PastEmploymentPosition',
    jsonldContext: [
      'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
    ],
  },
  {
    credentialType: 'EducationDegree',
    layer1: true,
    schemaUrl:
      'http://oracle.localhost.test/schemas/education-degree-v1.1.json',
    jsonldContext: [
      'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
    ],
  },
  {
    credentialType: '1EdtechCLR2.0',
    layer1: false,
    schemaUrl: 'https://imsglobal.org/schemas/clr-v2.0-schema.json',
    jsonldContext: ['https://imsglobal.org/schemas/clr-context.json'],
  },
]);

const enableNotifications = (eventTypes) => (config) => ({
  ...config,
  notifications: {
    ...config.notifications,
    enabled: true,
    webhook: {
      ...config.notifications.webhook,
      url: 'https://operator.localhost.test/events',
      eventTypes,
      secret: 'test-secret',
    },
  },
});
