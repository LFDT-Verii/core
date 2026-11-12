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

// Signing the access token goes through the kms, which signs with jwtSign.
const actualJwt = require('@verii/jwt');

const mockJwtSign = mock.fn(actualJwt.jwtSign);
mock.module('@verii/jwt', {
  namedExports: { ...actualJwt, jwtSign: mockJwtSign },
});

const mockResolveDidDocument = mock.fn();
const mockGetRevokedStatus = mock.fn(() => Promise.resolve(0));
const mockInitRevocationRegistry = mock.fn(() => ({
  getRevokedStatus: mockGetRevokedStatus,
}));

mock.module('@verii/metadata-registration', {
  namedExports: {
    ...require('@verii/metadata-registration'),
    initVerificationCoupon: mock.fn(() => {}),
    initMetadataRegistry: mock.fn(() => ({
      resolveDidDocument: mockResolveDidDocument,
    })),
    initRevocationRegistry: mockInitRevocationRegistry,
  },
});

const {
  mockHttpClientModule,
  resetMockHttpClient,
  restMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { randomUUID } = require('node:crypto');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const {
  jwtDecode,
  jwtVerify,
  generateCredentialJwt,
  generateDocJwt,
} = require('@verii/jwt');
const { generateKeyPair } = require('@verii/crypto');
const { nanoid } = require('nanoid/non-secure');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { errorResponseMatcher, mongoify } = require('@verii/tests-helpers');
const {
  entries,
  filter,
  forEach,
  identity,
  map,
  omit,
  set,
  sortBy,
  startsWith,
  times,
} = require('lodash/fp');
const {
  didVelocityResolution,
  emailIssuerService,
  generateAuthVp,
  generateCredential,
  generateEmailCredential,
  generateEmailIssuer,
  generateHolder,
  generateRawV1EmailCredential,
  generateV2EmailCredential,
  mockEmailIssuerRoutes,
  signAuthVp,
} = require('../helpers/email-credential-auth');
const testPresentationDefinition = require('../helpers/presentation-definition.json');
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
const {
  buildAuthMatchValues,
} = require('@verii/credentialing-hub-operator-api');
const {
  buildAuthRulesFingerprint,
  initDepotFactory,
} = require('../../src/entities/depots');
const { initCredentialFactory } = require('../../src/entities/credentials');
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

    holderKeyPair = generateKeyPair({ format: 'jwk' });
    holderDid = getDidUriFromJwk(holderKeyPair.publicKey);
  });

  beforeEach(async () => {
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
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
            authenticatedJtis: [expect.any(String)],
          },
        ),
      );
    });
    it('should leave the exchange free to authenticate again when signing the token fails', async () => {
      const jwtVp = await generatePreauthCodeAuthJwt(
        depot,
        preauthCode,
        holderDid,
        holderKeyPair,
      );
      const authenticateOnce = () =>
        fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: { exchange_id: exchange._id, jwt_vp: jwtVp },
        });
      mockJwtSign.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('key store timeout')),
      );

      const failedResponse = await authenticateOnce();

      expect(failedResponse.statusCode).toEqual(500);
      expect(failedResponse.json.token).toBeUndefined();
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [
            ExchangeStates.AUTHENTICATION_REQUEST,
            ExchangeStates.UNEXPECTED_ERROR,
          ],
          { err: 'key store timeout' },
        ),
      );

      const retryResponse = await authenticateOnce();

      expect(retryResponse.statusCode).toEqual(200);
      const { payload } = await jwtVerify(
        retryResponse.json.token,
        holderAccessTokensSecret,
        { alg: 'HS384' },
      );
      expect(payload).toEqual(
        expect.objectContaining({
          sub: `depot:${depot._id}`,
          scope: [`exchange:${exchange._id}`],
        }),
      );
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [
            ExchangeStates.AUTHENTICATION_REQUEST,
            ExchangeStates.UNEXPECTED_ERROR,
            ExchangeStates.AUTHENTICATION_REQUEST,
            ExchangeStates.AUTHENTICATION_SUCCESS,
          ],
          {
            depotId: new ObjectId(depot._id),
            err: 'key store timeout',
            authenticatedJtis: [jwtDecode(jwtVp).payload.jti],
          },
        ),
      );
    });
    describe('authenticating the exchange again', () => {
      const authenticateWithVp = (jwtVp) =>
        fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: { exchange_id: exchange._id, jwt_vp: jwtVp },
        });

      const expectRefused = async (response, authenticatedJtis) => {
        expect(response.statusCode).toEqual(401);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'unauthorized',
            message: 'unauthorized',
            statusCode: 401,
          }),
        );
        expect(response.json.token).toBeUndefined();
        await expect(findOneExchange(exchange._id)).resolves.toEqual(
          expectedDbExchange(
            tenant,
            exchange,
            [
              ExchangeStates.AUTHENTICATION_REQUEST,
              ExchangeStates.AUTHENTICATION_SUCCESS,
              ExchangeStates.AUTHENTICATION_FAILURE,
            ],
            {
              depotId: new ObjectId(depot._id),
              err: 'unauthorized',
              ...(authenticatedJtis == null ? {} : { authenticatedJtis }),
            },
          ),
        );
      };

      it('should 401 the same preauth VP presented again', async () => {
        const jwtVp = await generatePreauthCodeAuthJwt(
          depot,
          preauthCode,
          holderDid,
          holderKeyPair,
        );

        const firstResponse = await authenticateWithVp(jwtVp);
        const secondResponse = await authenticateWithVp(jwtVp);

        expect(firstResponse.statusCode).toEqual(200);
        await expectRefused(secondResponse, [jwtDecode(jwtVp).payload.jti]);
      });

      it('should let a preauth VP without a jti authenticate only an exchange that has not authenticated', async () => {
        const generateVpWithoutJti = () =>
          generatePreauthCodeAuthJwt(
            depot,
            preauthCode,
            holderDid,
            holderKeyPair,
            { withJti: false },
          );
        const firstJwtVp = await generateVpWithoutJti();
        expect(jwtDecode(firstJwtVp).payload.jti).toBeUndefined();

        const firstResponse = await authenticateWithVp(firstJwtVp);
        const secondResponse = await authenticateWithVp(
          await generateVpWithoutJti(),
        );

        expect(firstResponse.statusCode).toEqual(200);
        await expectRefused(secondResponse);
      });
    });
  });

  describe('verifiable presentation authentication', () => {
    let emailIssuer;
    let holder;
    let vpIssuerService;
    let exchange;

    before(async () => {
      emailIssuer = await generateEmailIssuer();
    });

    beforeEach(async () => {
      resetMockHttpClient();
      restMockHttpClient();
      mockEmailIssuerRoutes(emailIssuer);
      mockResolveDidDocument.mock.resetCalls();
      mockResolveDidDocument.mock.mockImplementation(() =>
        Promise.reject(new Error('unexpected did:velocity resolution')),
      );
      mockGetRevokedStatus.mock.resetCalls();
      mockGetRevokedStatus.mock.mockImplementation(() => Promise.resolve(0));
      holder = generateHolder();
      vpIssuerService = await persistIssuerService({
        tenant,
        ...emailIssuerService(),
      });
      exchange = await persistExchange({ tenant, service: vpIssuerService });
    });

    // A depot as depots/create stores it, under the service's auth rules as
    // they are now.
    const persistVpDepot = async (authValues, service = vpIssuerService) =>
      persistDepot({
        tenant,
        service,
        authValues,
        authMatchValues: buildAuthMatchValues(authValues),
        authRulesFingerprint: buildAuthRulesFingerprint(
          await mongoDb()
            .collection('issuerServices')
            .findOne({ _id: new ObjectId(service._id) }),
        ),
      });

    const mockDidResolution = (credentials) =>
      mockResolveDidDocument.mock.mockImplementation(() =>
        Promise.resolve(didVelocityResolution(credentials)),
      );

    const emailCredentials = (emails, overrides) =>
      Promise.all(
        map(
          (email) =>
            generateEmailCredential({
              issuer: emailIssuer,
              holderDid: holder.did,
              email,
              overrides,
            }),
          emails,
        ),
      );

    const authenticateWith = async (jwtVp, exchangeToAuthenticate = exchange) =>
      fastify.injectJson({
        method: 'POST',
        url: testUrl(tenant),
        payload: { exchange_id: exchangeToAuthenticate._id, jwt_vp: jwtVp },
      });

    // Presents the credentials in a VP and resolves their did:velocity keys.
    const present = async (credentials, vpOverrides) => {
      mockDidResolution(filter(isDidVelocityCredential, credentials));
      return authenticateWith(
        await generateAuthVp({
          exchange,
          holder,
          jwtVcs: map('jwt', credentials),
          overrides: vpOverrides,
        }),
      );
    };

    const presentEmails = async (emails, credentialOverrides) =>
      present(await emailCredentials(emails, credentialOverrides));

    const expectAuthenticated = async (response, depot) => {
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
      const { payload } = await jwtVerify(
        response.json.token,
        holderAccessTokensSecret,
        { alg: 'HS384' },
      );
      expect(payload).toEqual(
        expect.objectContaining({
          iss: tenant.did,
          sub: `depot:${depot._id}`,
          scope: [`exchange:${exchange._id}`],
        }),
      );
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
            authenticatedJtis: [expect.any(String)],
          },
        ),
      );
    };

    const expectNotAuthenticated = async (
      response,
      { statusCode = 401, errorCode, message = errorCode },
    ) => {
      expect(response.statusCode).toEqual(statusCode);
      expect(response.json).toEqual(
        errorResponseMatcher({ errorCode, message, statusCode }),
      );
      await expect(findOneExchange(exchange._id)).resolves.toEqual(
        expectedDbExchange(
          tenant,
          exchange,
          [
            ExchangeStates.AUTHENTICATION_REQUEST,
            statusCode === 401
              ? ExchangeStates.AUTHENTICATION_FAILURE
              : ExchangeStates.UNEXPECTED_ERROR,
          ],
          { err: message },
        ),
      );
    };

    const expectUserNotFound = (response) =>
      expectNotAuthenticated(response, {
        errorCode: ExchangeErrors.IDENTIFICATION_USER_NOT_FOUND,
      });

    describe('matching depots', () => {
      it('should 200 and bind the depot whose email matches a trusted email credential', async () => {
        const depot = await persistVpDepot(['adam.smith@example.com']);
        const otherDepot = await persistVpDepot(['jane.doe@example.com']);
        const depotCredentials = [
          await persistCredential({
            tenant,
            depot,
            content: {
              type: ['EmailV1.0'],
              credentialSubject: { email: 'adam.smith@example.com' },
            },
          }),
          await persistCredential({
            tenant,
            depot,
            content: {
              type: ['PastEmploymentPosition'],
              credentialSubject: { company: 'did:example:employer' },
            },
          }),
        ];
        await persistCredential({
          tenant,
          depot: otherDepot,
          content: {
            type: ['EmailV1.0'],
            credentialSubject: { email: 'jane.doe@example.com' },
          },
        });

        const response = await presentEmails(['adam.smith@example.com']);

        await expectAuthenticated(response, depot);
        const offersResponse = await fastify.injectJson({
          method: 'POST',
          url: `/vn-api/r/${tenant.did}/credential-offers`,
          headers: { authorization: `Bearer ${response.json.token}` },
          payload: { offerHashes: [] },
        });
        expect(offersResponse.statusCode).toEqual(200);
        expect(sortBy('id', offersResponse.json.offers)).toEqual(
          sortBy(
            'id',
            map(
              (credential) => ({
                ...credential.content,
                id: credential._id,
                hash: credential.contentHash,
                issuer: { id: tenant.did },
              }),
              depotCredentials,
            ),
          ),
        );
      });

      it('should match ignoring case and surrounding spaces in the credential and the depot', async () => {
        const depot = await persistVpDepot([' Adam.Smith@Example.com  ']);

        const response = await presentEmails(['  ADAM.smith@example.COM ']);

        await expectAuthenticated(response, depot);
      });

      it('should 401 when no depot matches the email', async () => {
        await persistVpDepot(['jane.doe@example.com']);

        const response = await presentEmails(['adam.smith@example.com']);

        await expectUserNotFound(response);
      });

      it('should 401 and bind no depot when two depots match the email', async () => {
        await persistVpDepot(['adam.smith@example.com']);
        await persistVpDepot(['Adam.Smith@example.com']);

        const response = await presentEmails(['adam.smith@example.com']);

        await expectUserNotFound(response);
      });

      it('should 401 when the email only contains a depot email', async () => {
        await persistVpDepot(['a@x.com']);

        const response = await presentEmails(['ma@x.com']);

        await expectUserNotFound(response);
      });

      it('should 401 when only another service or another tenant has a depot with the email', async () => {
        const otherService = await persistIssuerService({
          tenant,
          ...emailIssuerService(),
        });
        await persistVpDepot(['adam.smith@example.com'], otherService);
        const { tenant: otherTenant } = await constructTenant(
          persistTenant,
          persistKey,
        );
        const otherTenantService = await persistIssuerService({
          tenant: otherTenant,
          ...emailIssuerService(),
        });
        await persistDepot({
          tenant: otherTenant,
          service: otherTenantService,
          authValues: ['adam.smith@example.com'],
          authMatchValues: ['adam.smith@example.com'],
          authRulesFingerprint: buildAuthRulesFingerprint(otherTenantService),
        });

        const response = await presentEmails(['adam.smith@example.com']);

        await expectUserNotFound(response);
      });

      it('should 401 when the depot was created under a previous auth configuration', async () => {
        await persistDepot({
          tenant,
          service: vpIssuerService,
          authValues: ['adam.smith@example.com'],
          authMatchValues: ['adam.smith@example.com'],
          authRulesFingerprint: buildAuthRulesFingerprint({
            ...vpIssuerService,
            verifiablePresentationAuthRules: [
              {
                path: [['credentialSubject', 'emailAddress']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
              },
            ],
          }),
        });

        const response = await presentEmails(['adam.smith@example.com']);

        await expectUserNotFound(response);
      });

      it("should bind the exchange service's depot when another service has the same email", async () => {
        const otherService = await persistIssuerService({
          tenant,
          ...emailIssuerService(),
        });
        await persistVpDepot(['adam.smith@example.com'], otherService);
        const depot = await persistVpDepot(['adam.smith@example.com']);

        const response = await presentEmails(['adam.smith@example.com']);

        await expectAuthenticated(response, depot);
      });

      it('should 401 when the rule path finds nothing in the credential', async () => {
        await persistIssuerServiceRules([
          {
            path: [['credentialSubject', 'phone']],
            rule: 'pick',
            valueIndex: 0,
            type: 'EmailV1.0',
          },
        ]);
        await persistVpDepot(['adam.smith@example.com']);

        const response = await presentEmails(['adam.smith@example.com']);

        await expectUserNotFound(response);
      });

      it('should use the next rule path when the first finds nothing', async () => {
        await persistIssuerServiceRules([
          {
            path: [
              ['credentialSubject', 'emailAddress'],
              ['credentialSubject', 'email'],
            ],
            rule: 'pick',
            valueIndex: 0,
            type: 'EmailV1.0',
          },
        ]);
        const depot = await persistVpDepot(['adam.smith@example.com']);

        const response = await presentEmails(['adam.smith@example.com']);

        await expectAuthenticated(response, depot);
      });

      it('should match an email held in an array field with a null segment', async () => {
        await persistIssuerServiceRules([
          {
            path: [
              ['credentialSubject', 'email'],
              ['credentialSubject', 'emails', null],
            ],
            rule: 'pick',
            valueIndex: 0,
            type: 'EmailV1.0',
          },
        ]);
        const depot = await persistVpDepot(['adam.smith@example.com']);
        const credential = await generateCredential({
          issuer: emailIssuer,
          holderDid: holder.did,
          credentialSubject: {
            emails: ['adam@other.example.com', 'Adam.Smith@example.com'],
          },
        });

        const response = await present([credential]);

        await expectAuthenticated(response, depot);
      });

      it('should 200 and bind the depot when one of two presented emails matches it', async () => {
        const depot = await persistVpDepot(['adam.smith@example.com']);

        const response = await presentEmails([
          'adam@other.example.com',
          'adam.smith@example.com',
        ]);

        await expectAuthenticated(response, depot);
      });

      it('should 401 and bind neither depot when two presented emails match two depots', async () => {
        await persistVpDepot(['adam.smith@example.com']);
        await persistVpDepot(['adam@other.example.com']);

        const response = await presentEmails([
          'adam@other.example.com',
          'adam.smith@example.com',
        ]);

        await expectUserNotFound(response);
      });

      it('should not match an equal rule when the credentials have two different emails', async () => {
        await persistIssuerServiceRules([
          {
            path: [['credentialSubject', 'email']],
            rule: 'equal',
            valueIndex: 0,
            type: 'EmailV1.0',
          },
        ]);
        await persistVpDepot(['adam.smith@example.com']);

        const response = await presentEmails([
          'adam.smith@example.com',
          'adam@other.example.com',
        ]);

        await expectUserNotFound(response);
      });

      it('should match an equal rule when two credentials have the same email', async () => {
        await persistIssuerServiceRules([
          {
            path: [['credentialSubject', 'email']],
            rule: 'equal',
            valueIndex: 0,
            type: 'EmailV1.0',
          },
        ]);
        const depot = await persistVpDepot(['adam.smith@example.com']);

        const response = await presentEmails([
          'adam.smith@example.com',
          'Adam.Smith@example.com',
        ]);

        await expectAuthenticated(response, depot);
      });

      describe('value types', () => {
        const employeeIdRule = (valueType, path) => ({
          path: path ?? [['credentialSubject', 'employeeId']],
          rule: 'pick',
          valueIndex: 0,
          type: 'EmailV1.0',
          valueType,
        });

        const presentEmployee = async (credentialSubject) =>
          present([
            await generateCredential({
              issuer: emailIssuer,
              holderDid: holder.did,
              credentialSubject,
            }),
          ]);

        it('should match a number rule with the depot that holds the number, not the string', async () => {
          await persistIssuerServiceRules([employeeIdRule('number')]);
          await persistVpDepot(['12345']);
          const depot = await persistVpDepot([12345]);

          const response = await presentEmployee({ employeeId: 12345 });

          await expectAuthenticated(response, depot);
        });

        it('should 401 for a number rule when only a depot with the string has the value', async () => {
          await persistIssuerServiceRules([employeeIdRule('number')]);
          await persistVpDepot(['12345']);

          const response = await presentEmployee({ employeeId: 12345 });

          await expectUserNotFound(response);
        });

        it('should 401 when the credential holds a string for a number rule', async () => {
          await persistIssuerServiceRules([employeeIdRule('number')]);
          await persistVpDepot([12345]);

          const response = await presentEmployee({ employeeId: '12345' });

          await expectUserNotFound(response);
        });

        it('should 401 when the credential holds a number for a string rule', async () => {
          await persistIssuerServiceRules([employeeIdRule('string')]);
          await persistVpDepot(['12345']);

          const response = await presentEmployee({ employeeId: 12345 });

          await expectUserNotFound(response);
        });

        it('should use the next pointer when the first reads a value of another type', async () => {
          await persistIssuerServiceRules([
            employeeIdRule('number', [
              ['credentialSubject', 'employeeId'],
              ['credentialSubject', 'employeeNumber'],
            ]),
          ]);
          const depot = await persistVpDepot([12345]);

          const response = await presentEmployee({
            employeeId: 'E-12345',
            employeeNumber: 12345,
          });

          await expectAuthenticated(response, depot);
        });

        it('should match a value of any type for a rule saved before it had a valueType', async () => {
          await persistIssuerServiceRules([
            omit(['valueType'], employeeIdRule('number')),
          ]);
          const depot = await persistVpDepot([12345]);

          const response = await presentEmployee({ employeeId: 12345 });

          await expectAuthenticated(response, depot);
        });
      });

      describe('email and phone rules', () => {
        let phoneCredential;

        beforeEach(async () => {
          await persistIssuerServiceRules(
            [
              {
                path: [['credentialSubject', 'email']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
              },
              {
                path: [['credentialSubject', 'phone']],
                rule: 'pick',
                valueIndex: 1,
                type: 'PhoneV1.0',
              },
            ],
            {
              'disclosureRequest.types': [
                { type: 'EmailV1.0' },
                { type: 'PhoneV1.0' },
              ],
            },
          );
          phoneCredential = await generateCredential({
            issuer: emailIssuer,
            holderDid: holder.did,
            type: 'PhoneV1.0',
            credentialSubject: { phone: '+15550100' },
          });
        });

        it('should 200 when both the email and the phone match a depot', async () => {
          await persistVpDepot(['adam.smith@example.com', '+15550199']);
          const depot = await persistVpDepot([
            'adam.smith@example.com',
            '+15550100',
          ]);
          const [emailCredential] = await emailCredentials([
            'adam.smith@example.com',
          ]);

          const response = await present([phoneCredential, emailCredential]);

          await expectAuthenticated(response, depot);
        });

        it('should 401 when the phone of the depot with the email does not match', async () => {
          await persistVpDepot(['adam.smith@example.com', '+15550199']);
          await persistVpDepot(['jane.doe@example.com', '+15550100']);
          const [emailCredential] = await emailCredentials([
            'adam.smith@example.com',
          ]);

          const response = await present([emailCredential, phoneCredential]);

          await expectUserNotFound(response);
        });
      });

      it('should 400 presentation_invalid when the credentials give more than 100 candidate tuples', async () => {
        await persistIssuerServiceRules([
          {
            path: [['credentialSubject', 'emails', null]],
            rule: 'pick',
            valueIndex: 0,
            type: 'EmailV1.0',
          },
        ]);
        await persistVpDepot(['user0@example.com']);
        const credential = await generateCredential({
          issuer: emailIssuer,
          holderDid: holder.did,
          credentialSubject: {
            emails: times((i) => `user${i}@example.com`, 101),
          },
        });

        const response = await present([credential]);

        await expectNotAuthenticated(response, {
          statusCode: 400,
          errorCode: 'presentation_invalid',
          message:
            'The presented credentials give more than 100 combinations of auth values',
        });
      });
    });

    describe('authenticating an exchange again', () => {
      let depot;
      let credentials;
      let firstJwtVp;

      beforeEach(async () => {
        depot = await persistVpDepot(['adam.smith@example.com']);
        credentials = await emailCredentials(['adam.smith@example.com']);
        mockDidResolution(credentials);
        firstJwtVp = await generateAuthVp({
          exchange,
          holder,
          jwtVcs: map('jwt', credentials),
        });
      });

      const nowSeconds = () => Math.floor(Date.now() / 1000);

      const authenticateFirst = async () => {
        const response = await authenticateWith(firstJwtVp);
        expect(response.statusCode).toEqual(200);
        return response;
      };

      // A new VP from the same holder, presenting the same credential
      const newJwtVp = (claims) =>
        signAuthVp({
          exchange,
          holder,
          jwtVcs: map('jwt', credentials),
          jti: nanoid(),
          iat: nowSeconds(),
          ...claims,
        });

      const firstJti = () => jwtDecode(firstJwtVp).payload.jti;

      const expectRefused = async (response, events) => {
        expect(response.statusCode).toEqual(401);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'unauthorized',
            message: 'unauthorized',
            statusCode: 401,
          }),
        );
        expect(response.json.token).toBeUndefined();
        await expect(findOneExchange(exchange._id)).resolves.toEqual(
          expectedDbExchange(tenant, exchange, events, {
            depotId: new ObjectId(depot._id),
            err: 'unauthorized',
            authenticatedJtis: [firstJti()],
          }),
        );
      };

      const refusedEarly = [
        ExchangeStates.AUTHENTICATION_REQUEST,
        ExchangeStates.AUTHENTICATION_SUCCESS,
        ExchangeStates.AUTHENTICATION_FAILURE,
      ];

      it('should 401 the same VP presented again, without checking its credentials', async () => {
        await authenticateFirst();
        mockResolveDidDocument.mock.resetCalls();

        const response = await authenticateWith(firstJwtVp);

        await expectRefused(response, refusedEarly);
        expect(mockResolveDidDocument.mock.callCount()).toEqual(0);
      });

      it('should 200 a new VP from the same holder for the same depot, with a working token', async () => {
        await authenticateFirst();
        const jti = nanoid();

        const response = await authenticateWith(await newJwtVp({ jti }));

        expect(response.statusCode).toEqual(200);
        const { payload } = await jwtVerify(
          response.json.token,
          holderAccessTokensSecret,
          { alg: 'HS384' },
        );
        expect(payload.sub).toEqual(`depot:${depot._id}`);
        await expect(findOneExchange(exchange._id)).resolves.toEqual(
          expectedDbExchange(
            tenant,
            exchange,
            [
              ExchangeStates.AUTHENTICATION_REQUEST,
              ExchangeStates.AUTHENTICATION_SUCCESS,
              ExchangeStates.AUTHENTICATION_REQUEST,
              ExchangeStates.AUTHENTICATION_SUCCESS,
            ],
            {
              depotId: new ObjectId(depot._id),
              authenticatedJtis: [firstJti(), jti],
            },
          ),
        );
        const offersResponse = await fastify.injectJson({
          method: 'POST',
          url: `/vn-api/r/${tenant.did}/credential-offers`,
          headers: { authorization: `Bearer ${response.json.token}` },
          payload: { offerHashes: [] },
        });
        expect(offersResponse.statusCode).toEqual(200);
      });

      it('should 401 a new VP for a different depot, and stay bound to the first depot', async () => {
        await authenticateFirst();
        await persistVpDepot(['jane.doe@example.com']);
        const otherHolder = generateHolder();
        const otherCredential = await generateEmailCredential({
          issuer: emailIssuer,
          holderDid: otherHolder.did,
          email: 'jane.doe@example.com',
        });
        mockDidResolution([...credentials, otherCredential]);

        const response = await authenticateWith(
          await generateAuthVp({
            exchange,
            holder: otherHolder,
            jwtVcs: [otherCredential.jwt],
          }),
        );

        await expectRefused(response, [
          ExchangeStates.AUTHENTICATION_REQUEST,
          ExchangeStates.AUTHENTICATION_SUCCESS,
          ExchangeStates.AUTHENTICATION_REQUEST,
          ExchangeStates.AUTHENTICATION_FAILURE,
        ]);
      });

      describe('VP freshness', () => {
        const OUT_OF_WINDOW = [
          {
            name: 'issued more than 10 minutes ago',
            iat: () => nowSeconds() - 11 * 60,
          },
          {
            name: 'issued more than 5 minutes ahead',
            iat: () => nowSeconds() + 6 * 60,
          },
          { name: 'without an iat', iat: () => null },
        ];

        forEach(({ name, iat }) => {
          it(`should 401 a first VP ${name}, and issue no token`, async () => {
            const response = await authenticateWith(
              await newJwtVp({ iat: iat() }),
            );

            expect(response.statusCode).toEqual(401);
            expect(response.json).toEqual(
              errorResponseMatcher({
                errorCode: 'unauthorized',
                message: 'unauthorized',
                statusCode: 401,
              }),
            );
            expect(response.json.token).toBeUndefined();
            await expect(findOneExchange(exchange._id)).resolves.toEqual(
              expectedDbExchange(
                tenant,
                exchange,
                [ExchangeStates.AUTHENTICATION_FAILURE],
                { disclosureConsentedAt: undefined, err: 'unauthorized' },
              ),
            );
            expect(mockResolveDidDocument.mock.callCount()).toEqual(0);
          });

          it(`should 401 a new VP ${name} after the exchange authenticated`, async () => {
            await authenticateFirst();

            const response = await authenticateWith(
              await newJwtVp({ iat: iat() }),
            );

            await expectRefused(response, refusedEarly);
          });
        }, OUT_OF_WINDOW);

        it('should 200 VPs issued within the window, first and again', async () => {
          const firstResponse = await authenticateWith(
            await newJwtVp({ iat: nowSeconds() - 9 * 60 }),
          );
          const againResponse = await authenticateWith(
            await newJwtVp({ iat: nowSeconds() + 4 * 60 }),
          );

          expect(firstResponse.statusCode).toEqual(200);
          expect(againResponse.statusCode).toEqual(200);
        });

        it('should 401 a VP that ages past the window during its credential checks, and leave the exchange unauthenticated', async (t) => {
          const jwtVp = await newJwtVp({ iat: nowSeconds() - 9 * 60 });
          const now = Date.now();
          // The credential checks take long enough for the VP to age out
          mockResolveDidDocument.mock.mockImplementation(() => {
            t.mock.method(Date, 'now', () => now + 2 * 60 * 1000);
            return Promise.resolve(didVelocityResolution(credentials));
          });

          const response = await authenticateWith(jwtVp);

          expect(response.statusCode).toEqual(401);
          expect(response.json.token).toBeUndefined();
          expect(mockResolveDidDocument.mock.callCount()).toEqual(1);
          const dbExchange = await findOneExchange(exchange._id);
          expect(map('state', dbExchange.events)).toEqual([
            ExchangeStates.NEW,
            ExchangeStates.AUTHENTICATION_REQUEST,
            ExchangeStates.AUTHENTICATION_FAILURE,
          ]);
          expect(dbExchange.depotId).toBeUndefined();
          expect(dbExchange.authenticatedJtis).toBeUndefined();
        });

        it('should let only the fresh VP succeed when a stale one races it', async () => {
          const staleJwtVp = await newJwtVp({ iat: nowSeconds() - 60 * 60 });
          const freshJti = nanoid();
          const freshJwtVp = await newJwtVp({ jti: freshJti });

          const [staleResponse, freshResponse] = await Promise.all([
            authenticateWith(staleJwtVp),
            authenticateWith(freshJwtVp),
          ]);

          expect(staleResponse.statusCode).toEqual(401);
          expect(freshResponse.statusCode).toEqual(200);
          const dbExchange = await findOneExchange(exchange._id);
          expect(dbExchange.authenticatedJtis).toEqual([freshJti]);
          expect(dbExchange.depotId).toEqual(new ObjectId(depot._id));
        });
      });

      it('should 400 for a complete exchange, as before', async () => {
        exchange = await persistExchange({
          tenant,
          service: vpIssuerService,
          depotId: new ObjectId(depot._id),
          events: [
            { state: ExchangeStates.NEW, timestamp: new Date() },
            {
              state: ExchangeStates.AUTHENTICATION_SUCCESS,
              timestamp: new Date(),
            },
            { state: ExchangeStates.COMPLETE, timestamp: new Date() },
          ],
        });

        const response = await authenticateWith(
          await generateAuthVp({
            exchange,
            holder,
            jwtVcs: map('jwt', credentials),
          }),
        );

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: ExchangeErrors.REFERENCED_EXCHANGE_NOT_FOUND,
            message: 'Referenced exchange not found',
            statusCode: 400,
          }),
        );
      });

      it('should leave the exchange free to authenticate again when signing the token fails', async () => {
        mockJwtSign.mock.mockImplementationOnce(() =>
          Promise.reject(new Error('key store timeout')),
        );

        const failedResponse = await authenticateWith(firstJwtVp);

        expect(failedResponse.statusCode).toEqual(500);
        const failedExchange = await findOneExchange(exchange._id);
        expect(map('state', failedExchange.events)).not.toContain(
          ExchangeStates.AUTHENTICATION_SUCCESS,
        );
        expect(failedExchange.depotId).toBeUndefined();
        expect(failedExchange.authenticatedJtis).toBeUndefined();

        const retryResponse = await authenticateWith(firstJwtVp);

        expect(retryResponse.statusCode).toEqual(200);
        const { payload } = await jwtVerify(
          retryResponse.json.token,
          holderAccessTokensSecret,
          { alg: 'HS384' },
        );
        expect(payload.sub).toEqual(`depot:${depot._id}`);
      });

      it('should let only one of two parallel submissions of the same VP succeed', async () => {
        const responses = await Promise.all([
          authenticateWith(firstJwtVp),
          authenticateWith(firstJwtVp),
        ]);

        expect(map('statusCode', responses).sort()).toEqual([200, 401]);
        const dbExchange = await findOneExchange(exchange._id);
        expect(dbExchange.authenticatedJtis).toEqual([firstJti()]);
        expect(
          filter(
            { state: ExchangeStates.AUTHENTICATION_SUCCESS },
            dbExchange.events,
          ),
        ).toHaveLength(1);
      });

      it('should let two parallel VPs with different jtis for the same depot both succeed', async () => {
        const secondJwtVp = await generateAuthVp({
          exchange,
          holder,
          jwtVcs: map('jwt', credentials),
        });

        const responses = await Promise.all([
          authenticateWith(firstJwtVp),
          authenticateWith(secondJwtVp),
        ]);

        expect(map('statusCode', responses)).toEqual([200, 200]);
        const dbExchange = await findOneExchange(exchange._id);
        expect(dbExchange.depotId).toEqual(new ObjectId(depot._id));
        expect(sortBy(identity, dbExchange.authenticatedJtis)).toEqual(
          sortBy(identity, [firstJti(), jwtDecode(secondJwtVp).payload.jti]),
        );
        expect(
          filter(
            { state: ExchangeStates.AUTHENTICATION_SUCCESS },
            dbExchange.events,
          ),
        ).toHaveLength(2);
      });
    });

    describe('VC 1.1 credential subjects', () => {
      beforeEach(async () => {
        await persistIssuerServiceRules([
          {
            path: [
              ['credentialSubject', 'email'],
              ['credentialSubject', '0', 'email'],
            ],
            rule: 'pick',
            valueIndex: 0,
            type: 'EmailV1.0',
          },
        ]);
      });

      it('should 401 presentation_credential_bad_holder and bind no depot when the signed subject also names someone else', async () => {
        await persistVpDepot(['alice@example.com']);
        const credential = await generateRawV1EmailCredential({
          issuer: emailIssuer,
          holderDid: holder.did,
          credentialSubject: [
            { id: generateHolder().did, email: 'alice@example.com' },
            { id: holder.did, email: 'mallory@example.com' },
          ],
        });

        const response = await present([credential]);

        await expectNotAuthenticated(response, {
          errorCode: 'presentation_credential_bad_holder',
        });
      });

      it('should 200 for a signed subject that is one object', async () => {
        const depot = await persistVpDepot(['alice@example.com']);
        const credential = await generateRawV1EmailCredential({
          issuer: emailIssuer,
          holderDid: holder.did,
          credentialSubject: { id: holder.did, email: 'alice@example.com' },
        });

        const response = await present([credential]);

        await expectAuthenticated(response, depot);
      });

      it('should 200 for a signed subject that is an array of one object', async () => {
        const depot = await persistVpDepot(['alice@example.com']);
        const credential = await generateRawV1EmailCredential({
          issuer: emailIssuer,
          holderDid: holder.did,
          credentialSubject: [{ id: holder.did, email: 'alice@example.com' }],
        });

        const response = await present([credential]);

        await expectAuthenticated(response, depot);
      });
    });

    describe('credential subjects', () => {
      beforeEach(async () => {
        await persistIssuerServiceRules([
          {
            path: [
              ['credentialSubject', 'email'],
              ['credentialSubject', null, 'email'],
            ],
            rule: 'pick',
            valueIndex: 0,
            type: 'EmailV1.0',
          },
        ]);
      });

      it('should 401 presentation_credential_bad_holder and bind no depot for a credential naming the holder and someone else', async () => {
        await persistVpDepot(['bob@example.com']);
        const credential = generateV2EmailCredential({
          issuer: emailIssuer,
          credentialSubject: [
            { id: holder.did, email: 'alice@example.com' },
            { id: generateHolder().did, email: 'bob@example.com' },
          ],
        });

        const response = await present([credential]);

        await expectNotAuthenticated(response, {
          errorCode: 'presentation_credential_bad_holder',
        });
      });

      it('should 200 for a credential whose subject is an array of one object', async () => {
        const depot = await persistVpDepot(['alice@example.com']);
        const credential = generateV2EmailCredential({
          issuer: emailIssuer,
          credentialSubject: [{ id: holder.did, email: 'alice@example.com' }],
        });

        const response = await present([credential]);

        await expectAuthenticated(response, depot);
      });

      it('should 200 for a VC 2.0 credential whose subject is one object', async () => {
        const depot = await persistVpDepot(['alice@example.com']);
        const credential = generateV2EmailCredential({
          issuer: emailIssuer,
          credentialSubject: { id: holder.did, email: 'alice@example.com' },
        });

        const response = await present([credential]);

        await expectAuthenticated(response, depot);
      });
    });

    describe('presented credentials', () => {
      it('should check only credentials of the requested types, wherever they are in the VP', async () => {
        const depot = await persistVpDepot(['adam.smith@example.com']);
        const employmentCredential = await generateCredential({
          issuer: emailIssuer,
          holderDid: holder.did,
          type: 'PastEmploymentPosition',
          credentialSubject: { email: 'jane.doe@example.com' },
        });
        const [emailCredential] = await emailCredentials([
          'adam.smith@example.com',
        ]);

        const response = await present([employmentCredential, emailCredential]);

        await expectAuthenticated(response, depot);
        expect(mockResolveDidDocument.mock.callCount()).toEqual(1);
        expect(mockResolveDidDocument.mock.calls[0].arguments[0]).toEqual(
          expect.objectContaining({
            did: `did:velocity:v2:multi:${emailCredential.id.split(':').slice(3).join(':')}`,
            credentials: [expect.objectContaining({ id: emailCredential.id })],
          }),
        );
      });

      it('should skip credentials that cannot be decoded', async () => {
        const depot = await persistVpDepot(['adam.smith@example.com']);
        const [emailCredential] = await emailCredentials([
          'adam.smith@example.com',
        ]);

        const response = await present([
          { jwt: 'not-a-credential' },
          emailCredential,
        ]);

        await expectAuthenticated(response, depot);
      });

      describe('a service that requests two types', () => {
        let depot;
        let phoneCredential;

        beforeEach(async () => {
          await persistIssuerServiceRules(undefined, {
            'disclosureRequest.types': [
              { type: 'EmailV1.0' },
              { type: 'PhoneV1.0' },
            ],
          });
          depot = await persistVpDepot(['adam.smith@example.com']);
          phoneCredential = await generateCredential({
            issuer: emailIssuer,
            holderDid: holder.did,
            type: 'PhoneV1.0',
            credentialSubject: { phone: '+15550100' },
          });
        });

        it('should 401 when only one of the types is presented', async () => {
          const response = await presentEmails(['adam.smith@example.com']);

          await expectUserNotFound(response);
        });

        it('should 200 when a credential of each type is presented', async () => {
          const [emailCredential] = await emailCredentials([
            'adam.smith@example.com',
          ]);

          const response = await present([emailCredential, phoneCredential]);

          await expectAuthenticated(response, depot);
        });

        describe('when another requested credential carries an email', () => {
          let victimPhoneCredential;

          beforeEach(async () => {
            victimPhoneCredential = await generateCredential({
              issuer: emailIssuer,
              holderDid: holder.did,
              type: 'PhoneV1.0',
              credentialSubject: {
                phone: '+15550100',
                email: 'adam.smith@example.com',
              },
            });
          });

          it("should not bind the depot of the phone credential's email", async () => {
            const [ownEmailCredential] = await emailCredentials([
              'mallory@example.com',
            ]);

            const response = await present([
              ownEmailCredential,
              victimPhoneCredential,
            ]);

            await expectUserNotFound(response);
          });

          it("should bind the depot of the email credential's email", async () => {
            const ownDepot = await persistVpDepot(['mallory@example.com']);
            const [ownEmailCredential] = await emailCredentials([
              'mallory@example.com',
            ]);

            const response = await present([
              ownEmailCredential,
              victimPhoneCredential,
            ]);

            await expectAuthenticated(response, ownDepot);
          });
        });
      });

      it('should 400 presentation_invalid when a credential of a requested type has a malformed kid', async () => {
        await persistVpDepot(['adam.smith@example.com']);
        const malformedJwt = await generateCredentialJwt(
          {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            id: 'did:velocity:v2:malformed:1:1',
            type: ['EmailV1.0', 'VerifiableCredential'],
            issuer: { id: emailIssuer.did },
            issuanceDate: new Date().toISOString(),
            credentialSubject: {
              id: holder.did,
              email: 'adam.smith@example.com',
            },
            vnfProtocolVersion: 2,
          },
          generateKeyPair({ format: 'jwk' }).privateKey,
          [],
        );

        const response = await present([{ jwt: malformedJwt }]);

        await expectNotAuthenticated(response, {
          statusCode: 400,
          errorCode: 'presentation_invalid',
          message: 'A presented credential is malformed',
        });
        expect(mockResolveDidDocument.mock.callCount()).toEqual(0);
      });

      it('should 401 when no credential is of a requested type', async () => {
        await persistVpDepot(['adam.smith@example.com']);
        const employmentCredential = await generateCredential({
          issuer: emailIssuer,
          holderDid: holder.did,
          type: 'PastEmploymentPosition',
          credentialSubject: { email: 'adam.smith@example.com' },
        });

        const response = await present([employmentCredential]);

        await expectUserNotFound(response);
        expect(mockResolveDidDocument.mock.callCount()).toEqual(0);
      });

      it('should 400 presentation_invalid when the VP has more than 100 credentials', async () => {
        const response = await authenticateWith(
          await generateAuthVp({
            exchange,
            holder,
            jwtVcs: times(() => 'not-a-credential', 101),
          }),
        );

        await expectNotAuthenticated(response, {
          statusCode: 400,
          errorCode: 'presentation_invalid',
          message:
            'verifiableCredential must be an array of at most 100 compact credentials',
        });
      });

      it('should 400 presentation_mismatch_exchange when the submission is for another exchange', async () => {
        await persistVpDepot(['adam.smith@example.com']);
        const otherExchange = await persistExchange({
          tenant,
          service: vpIssuerService,
        });

        const response = await present(
          await emailCredentials(['adam.smith@example.com']),
          {
            'presentation_submission.definition_id': `${otherExchange._id}.${vpIssuerService._id}`,
          },
        );

        await expectNotAuthenticated(response, {
          statusCode: 400,
          errorCode: 'presentation_mismatch_exchange',
          message: 'Mismatched Exchange Ids',
        });
      });

      it('should 401 unauthorized when the VP has no iss', async () => {
        await persistVpDepot(['adam.smith@example.com']);

        const response = await present(
          await emailCredentials(['adam.smith@example.com']),
          { issuer: undefined },
        );

        await expectNotAuthenticated(response, {
          errorCode: ExchangeErrors.UNAUTHORIZED,
        });
      });

      it('should 401 unauthorized when the VP has no iss but its vp claim has an issuer', async () => {
        await persistVpDepot(['adam.smith@example.com']);
        const credentials = await emailCredentials(['adam.smith@example.com']);
        mockDidResolution(credentials);
        const { payload } = jwtDecode(
          await generateAuthVp({
            exchange,
            holder,
            jwtVcs: map('jwt', credentials),
            overrides: { issuer: undefined },
          }),
        );

        const response = await authenticateWith(
          await generateDocJwt(
            { vp: { ...payload.vp, issuer: { id: holder.did } } },
            holder.keyPair.privateKey,
            { jti: payload.jti, kid: `${holder.did}#0` },
          ),
        );

        await expectNotAuthenticated(response, {
          errorCode: ExchangeErrors.UNAUTHORIZED,
        });
      });

      it('should 401 unauthorized when the VP iss is not the DID of its kid', async () => {
        await persistVpDepot(['adam.smith@example.com']);
        const otherHolder = generateHolder();

        const response = await present(
          await emailCredentials(['adam.smith@example.com']),
          { issuer: otherHolder.did },
        );

        await expectNotAuthenticated(response, {
          errorCode: ExchangeErrors.UNAUTHORIZED,
        });
      });
    });

    describe('credential checks', () => {
      beforeEach(async () => {
        await persistVpDepot(['adam.smith@example.com']);
      });

      it('should 401 presentation_credential_bad_holder when the credential has no holder binding', async () => {
        const response = await presentEmails(['adam.smith@example.com'], {
          vnfProtocolVersion: undefined,
        });

        await expectNotAuthenticated(response, {
          errorCode: 'presentation_credential_bad_holder',
        });
      });

      it('should 401 presentation_credential_bad_holder when the credential subject is not the VP holder', async () => {
        const otherHolder = generateHolder();

        const response = await presentEmails(['adam.smith@example.com'], {
          'credentialSubject.id': otherHolder.did,
        });

        await expectNotAuthenticated(response, {
          errorCode: 'presentation_credential_bad_holder',
        });
      });

      it('should 401 presentation_credential_bad_issuer when the email credential is self-signed', async () => {
        const selfSignedJwt = await generateCredentialJwt(
          {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            id: `urn:uuid:${randomUUID()}`,
            type: ['EmailV1.0', 'VerifiableCredential'],
            issuer: { id: holder.did },
            issuanceDate: new Date().toISOString(),
            credentialSubject: {
              id: holder.did,
              email: 'adam.smith@example.com',
            },
            vnfProtocolVersion: 2,
          },
          holder.keyPair.privateKey,
          `${holder.did}#0`,
        );

        const response = await present([{ jwt: selfSignedJwt }]);

        await expectNotAuthenticated(response, {
          errorCode: 'presentation_credential_bad_issuer',
        });
        expect(mockResolveDidDocument.mock.callCount()).toEqual(0);
      });

      it('should 401 presentation_credential_bad_issuer when the issuer is not permitted to issue the type', async () => {
        mockEmailIssuerRoutes(emailIssuer, {
          permittedVelocityServiceCategory: ['Issuer'],
        });

        const response = await presentEmails(['adam.smith@example.com']);

        await expectNotAuthenticated(response, {
          errorCode: 'presentation_credential_bad_issuer',
        });
      });

      it('should 200 when the credential has no expiry', async () => {
        const depot = await mongoDb()
          .collection('depots')
          .findOne({ serviceId: new ObjectId(vpIssuerService._id) });

        const response = await presentEmails(['adam.smith@example.com'], {
          expirationDate: undefined,
        });

        await expectAuthenticated(response, depot);
      });

      it('should 401 presentation_credential_expired when the credential is expired', async () => {
        const response = await presentEmails(['adam.smith@example.com'], {
          expirationDate: '2025-01-01T00:00:00.000Z',
        });

        await expectNotAuthenticated(response, {
          errorCode: 'presentation_credential_expired',
        });
      });

      it('should 401 presentation_credential_revoked when the credential is revoked', async () => {
        mockGetRevokedStatus.mock.mockImplementation(() => Promise.resolve(1));

        const response = await presentEmails(['adam.smith@example.com']);

        await expectNotAuthenticated(response, {
          errorCode: 'presentation_credential_revoked',
        });
      });

      it('should 401 presentation_credential_failed_tampered when a credential signature is invalid', async () => {
        const [emailCredential] = await emailCredentials([
          'adam.smith@example.com',
        ]);
        const response = await present([
          { ...emailCredential, keyPair: generateKeyPair({ format: 'jwk' }) },
        ]);

        await expectNotAuthenticated(response, {
          errorCode: 'presentation_credential_failed_tampered',
          message: 'presentation_credential_tampered',
        });
      });

      it('should 402 when the verification vouchers are exhausted', async () => {
        const credentials = await emailCredentials(['adam.smith@example.com']);
        mockResolveDidDocument.mock.mockImplementation(() =>
          Promise.reject(
            Object.assign(new Error(), { reason: 'No available tokens' }),
          ),
        );

        const response = await authenticateWith(
          await generateAuthVp({
            exchange,
            holder,
            jwtVcs: map('jwt', credentials),
          }),
        );

        await expectNotAuthenticated(response, {
          statusCode: 402,
          errorCode: 'verification_payment_required',
          message: 'Verification vouchers exhausted',
        });
      });

      it('should 502 credential_check_unavailable when the ledger cannot resolve the credential', async () => {
        const credentials = await emailCredentials(['adam.smith@example.com']);
        mockResolveDidDocument.mock.mockImplementation(() =>
          Promise.reject(new Error('ledger unavailable')),
        );

        const response = await authenticateWith(
          await generateAuthVp({
            exchange,
            holder,
            jwtVcs: map('jwt', credentials),
          }),
        );

        await expectNotAuthenticated(response, {
          statusCode: 502,
          errorCode: ExchangeErrors.CREDENTIAL_CHECK_UNAVAILABLE,
        });
      });

      it('should 502 credential_check_unavailable when the credential type metadata cannot be fetched', async () => {
        restMockHttpClient();
        mockEmailIssuerRoutes(emailIssuer, {
          unavailable: ['credentialTypes'],
        });

        const response = await presentEmails(['adam.smith@example.com']);

        await expectNotAuthenticated(response, {
          statusCode: 502,
          errorCode: ExchangeErrors.CREDENTIAL_CHECK_UNAVAILABLE,
        });
      });

      it('should 502 credential_check_unavailable when the revocation registry is unavailable', async () => {
        mockInitRevocationRegistry.mock.mockImplementationOnce(() =>
          Promise.reject(new Error('ledger unavailable')),
        );

        const response = await presentEmails(['adam.smith@example.com']);

        await expectNotAuthenticated(response, {
          statusCode: 502,
          errorCode: ExchangeErrors.CREDENTIAL_CHECK_UNAVAILABLE,
        });
      });

      it('should 502 credential_check_unavailable when the verified profile cannot be fetched', async () => {
        restMockHttpClient();
        mockEmailIssuerRoutes(emailIssuer, {
          unavailable: ['verifiedProfile'],
        });

        const response = await presentEmails(['adam.smith@example.com']);

        await expectNotAuthenticated(response, {
          statusCode: 502,
          errorCode: ExchangeErrors.CREDENTIAL_CHECK_UNAVAILABLE,
        });
      });

      it('should 502 credential_check_unavailable when the revocation lookup fails', async () => {
        mockGetRevokedStatus.mock.mockImplementation(() =>
          Promise.reject(new Error('ledger unavailable')),
        );

        const response = await presentEmails(['adam.smith@example.com']);

        await expectNotAuthenticated(response, {
          statusCode: 502,
          errorCode: ExchangeErrors.CREDENTIAL_CHECK_UNAVAILABLE,
        });
      });
    });

    describe('service auth methods', () => {
      it('should use preauth for a VP with a vendorOriginContext when the service has both methods', async () => {
        await persistIssuerServiceRules(undefined, {
          authMethods: ['preauth', 'verifiable_presentation'],
        });
        await persistVpDepot(['adam.smith@example.com']);
        const preauthDepot = await persistDepot({
          tenant,
          service: vpIssuerService,
          preauthCode,
        });

        const response = await present(
          await emailCredentials(['adam.smith@example.com']),
          { vendorOriginContext: `depot:${preauthDepot._id}:${preauthCode}` },
        );

        await expectAuthenticated(response, preauthDepot);
        expect(mockResolveDidDocument.mock.callCount()).toEqual(0);
      });

      it('should use VP authentication for a VP without a vendorOriginContext when the service has both methods', async () => {
        await persistIssuerServiceRules(undefined, {
          authMethods: ['preauth', 'verifiable_presentation'],
        });
        const depot = await persistVpDepot(['adam.smith@example.com']);

        const response = await presentEmails(['adam.smith@example.com']);

        await expectAuthenticated(response, depot);
      });

      it('should 400 authentication_method_unsupported for an internal VP service stored with a presentationDefinition', async () => {
        await persistIssuerServiceRules(undefined, {
          presentationDefinition: testPresentationDefinition,
        });
        await persistVpDepot(['adam.smith@example.com']);

        const response = await presentEmails(['adam.smith@example.com']);

        await expectNotAuthenticated(response, {
          statusCode: 400,
          errorCode: ExchangeErrors.AUTHENTICATION_METHOD_UNSUPPORTED,
        });
        expect(mockResolveDidDocument.mock.callCount()).toEqual(0);
      });

      it('should still use preauth for a VP with a vendorOriginContext when a service with both methods has a presentationDefinition', async () => {
        await persistIssuerServiceRules(undefined, {
          authMethods: ['preauth', 'verifiable_presentation'],
          presentationDefinition: testPresentationDefinition,
        });
        const preauthDepot = await persistDepot({
          tenant,
          service: vpIssuerService,
          preauthCode,
        });

        const response = await present(
          await emailCredentials(['adam.smith@example.com']),
          { vendorOriginContext: `depot:${preauthDepot._id}:${preauthCode}` },
        );

        await expectAuthenticated(response, preauthDepot);
      });

      it('should 400 authentication_method_unsupported for a VP service without authMode internal', async () => {
        await persistIssuerServiceRules(undefined, { authMode: null });
        await persistVpDepot(['adam.smith@example.com']);

        const response = await presentEmails(['adam.smith@example.com']);

        await expectNotAuthenticated(response, {
          statusCode: 400,
          errorCode: ExchangeErrors.AUTHENTICATION_METHOD_UNSUPPORTED,
        });
      });
    });

    // Changes the service of the exchange.
    const persistIssuerServiceRules = async (
      verifiablePresentationAuthRules,
      overrides,
    ) => {
      await mongoDb()
        .collection('issuerServices')
        .updateOne(
          { _id: new ObjectId(vpIssuerService._id) },
          {
            $set: {
              ...(verifiablePresentationAuthRules != null
                ? { verifiablePresentationAuthRules }
                : {}),
              ...overrides,
            },
          },
        );
    };
  });

  const findOneExchange = async (value) =>
    mongoDb()
      .collection('exchanges')
      .findOne({ _id: new ObjectId(value) });
});

const generatePreauthCodeAuthJwt = (
  depot,
  preauthCode,
  holderDid,
  keyPair,
  { withJti = true } = {},
) => {
  const didJwk = getDidUriFromJwk(keyPair.publicKey);
  const options = {
    issuer: didJwk,
    ...(withJti ? { jti: nanoid() } : {}),
    kid: `${didJwk}#0`,
  };
  const payload = {
    ...(withJti ? { id: nanoid() } : {}),
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

const isDidVelocityCredential = ({ id }) => startsWith('did:velocity:', id);
