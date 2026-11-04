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

const mockResolveDidDocument = mock.fn();
const mockGetStatus = mock.fn(() => Promise.resolve(0));

mock.module('@verii/metadata-registration', {
  namedExports: {
    ...require('@verii/metadata-registration'),
    initVerificationCoupon: mock.fn(() => {}),
    initMetadataRegistry: mock.fn(() => ({
      resolveDidDocument: mockResolveDidDocument,
    })),
    initRevocationRegistry: mock.fn(() => ({
      getRevokedStatus: mockGetStatus,
    })),
  },
});

const {
  mockHttpClient,
  mockHttpClientJsonRoute,
  mockHttpClientModule,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { hashOffer } = require('@verii/verii-issuing');
const { initMetadataRegistry } = require('@verii/metadata-registration');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { default: canonicalize } = require('canonicalize');
const {
  createCommitment,
  generateKeyPair,
  KeyPurposes,
} = require('@verii/crypto');
const { applyOverrides, mapWithIndex } = require('@verii/common-functions');
const { CheckResults } = require('@verii/vc-checks');
const { getDidUriFromJwk, toDidUrl } = require('@verii/did-doc');
const {
  generatePresentationJwt,
  generateCredentialJwt,
  jwtDecode,
  jwtSign,
  jwtVerify,
} = require('@verii/jwt');
const { map, omit } = require('lodash/fp');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes/src/regexes');
const {
  errorResponseMatcher,
} = require('@verii/tests-helpers/src/error-matchers');
const { ObjectId } = require('mongodb');
const { mongoify } = require('@verii/tests-helpers/src/mongoify');
const {
  presentationsRepoPlugin,
} = require('../../src/entities/presentations/repo');
const createTestFastify = require('../helpers/create-test-fastify');
const { initTenantFactory } = require('../../src/entities/tenants');
const { initKeyFactory } = require('../../src/entities/keys');
const { constructTenant } = require('../helpers/construct-tenant');
const {
  initPresentationFactory,
  defaultVcContent,
  PresentationFormat,
} = require('../../src/entities/presentations');
const { initDepotFactory } = require('../../src/entities/depots');
const {
  initRelyingPartyServiceFactory,
} = require('../../src/entities/relying-party-services');
const { CredentialFormat } = require('../../src/entities/credentials');
const {
  ExchangeProtocols,
  ExchangeTypes,
  initExchangeFactory,
} = require('../../src/entities/exchanges');
const {
  buildOpenBadgeCredential,
  openBadgeCredentialContent,
} = require('../helpers/build-open-badge-credential');

const testUrl = '/operator/presentations';

describe('Presentations Test Suite', () => {
  let fastify;
  let persistTenant;
  let persistKey;
  let persistPresentation;

  let tenant;
  let issuerKeyPair;
  let boundIssuerVc;

  let holderKeyPair;
  let holderDid;

  before(async () => {
    try {
      fastify = createTestFastify();
      await fastify.ready();
      initMetadataRegistry();
      ({ persistTenant } = initTenantFactory(fastify));
      ({ persistKey } = initKeyFactory(fastify));
      ({ persistPresentation } = initPresentationFactory(fastify));
    } catch (error) {
      console.error(error);
      throw error;
    }
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    ({ tenant, issuerKeyPair } = await constructTenant(
      persistTenant,
      persistKey,
    ));
    const issuerCred = {
      iss: tenant.did,
      vc: {
        id: '0',
        credentialSubject: {
          listId: 1,
          accountId: 'A',
        },
      },
    };
    boundIssuerVc = await jwtSign(issuerCred, issuerKeyPair.privateKey, {
      kid: `${tenant.did}#key-1`,
    });

    holderKeyPair = generateKeyPair({ format: 'jwk' });
    holderDid = getDidUriFromJwk(holderKeyPair.publicKey);
    resetMockHttpClient();
    mockHttpClientJsonRoute(
      'get',
      `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      {
        id: tenant.did,
        publicKey: [{ id: '#key-1', publicKeyJwk: issuerKeyPair.publicKey }],
      },
    );
    mockHttpClientJsonRoute(
      'get',
      `api/v0.6/organizations/${encodeURIComponent(
        tenant.did,
      )}/verified-profile`,
      {
        credentialSubject: {
          id: tenant.did,
          permittedVelocityServiceCategory: ['IdentityIssuer', 'Issuer'],
        },
      },
    );
    mockHttpClientJsonRoute(
      'get',
      'api/v0.6/credential-types',
      credentialTypeMetadatas,
    );
    mockHttpClientJsonRoute(
      'get',
      'https://www.openbadges.org/jsonld-context.json',
      openBadgeJsonLdContext,
    );
  });

  after(async () => {
    await fastify.close();
  });

  describe('Get Presentation', () => {
    let persistRelyingPartyService;
    let persistDepot;
    let relyingPartyService;
    let otherDepotPresentation;
    let depot;
    let unverifiedPresentation;
    let verifiedPresentation;

    before(() => {
      ({ persistDepot } = initDepotFactory(fastify));
      ({ persistRelyingPartyService } =
        initRelyingPartyServiceFactory(fastify));
    });
    beforeEach(async () => {
      relyingPartyService = await persistRelyingPartyService({
        tenant,
      });
      depot = await persistDepot({
        tenant,
        service: relyingPartyService,
      });
      otherDepotPresentation = await persistPresentation({ tenant });
      unverifiedPresentation = await persistPresentation({ tenant, depot });
      verifiedPresentation = await persistPresentation({
        tenant,
        depot,
        verifications: [
          {
            verified: true,
            tamperCheck: CheckResults.PASS,
            createdAt: new Date(),
            credentials: [
              {
                format: CredentialFormat.JWT_VC,
                credential: 'eyc...',
                w3cCredential: {
                  ...defaultVcContent(),
                  issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
                },
                verified: true,
                conclusion: CheckResults.PASS,
                tamperCheck: CheckResults.PASS,
                trustedIssuerCheck: CheckResults.PASS,
                trustedHolderCheck: CheckResults.PASS,
                revocationCheck: CheckResults.PASS,
                expiryCheck: CheckResults.PASS,
              },
            ],
          },
        ],
      });
    });
    it('should 400 if tenant id is missing', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get`,
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "querystring must have required property 'tenantId'",
        }),
      );
    });
    it('should 400 if tenant is not found', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=foo`,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'Tenant not found',
          errorCode: 'tenant_not_found',
        }),
      );
    });
    it('should 200 & return multiple presentations if no filter', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
        presentations: [
          expectedResponsePresentation(verifiedPresentation),
          expectedResponsePresentation(unverifiedPresentation),
          expectedResponsePresentation(otherDepotPresentation),
        ],
      });
    });
    it('get unverified presentation by id', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&presentationId=${unverifiedPresentation._id}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
        presentations: [expectedResponsePresentation(unverifiedPresentation)],
      });
    });
    it('get verified presentation by id', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&presentationId=${verifiedPresentation._id}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
        presentations: [expectedResponsePresentation(verifiedPresentation)],
      });
    });
    it('should 200 & return empty array if presentationId not found', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${
          tenant._id
        }&presentationId=${new ObjectId()}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
        presentations: [],
      });
    });

    it('get multiple presentations by depot id', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&depotId=${depot._id}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
        presentations: [
          expectedResponsePresentation(verifiedPresentation),
          expectedResponsePresentation(unverifiedPresentation),
        ],
      });
    });

    it('get presentations by exchange id', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&exchangeId=${otherDepotPresentation.exchangeId}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
        presentations: [expectedResponsePresentation(otherDepotPresentation)],
      });
    });
  });

  describe('verify presentation', () => {
    describe('verify a passed in jwtVp', () => {
      const vcKeyPair = generateKeyPair({ format: 'jwk' });
      const credentialDid = 'did:velocity:v2:A:1:1';
      let vp;
      let vc;
      let openBadgeCredential;

      beforeEach(async () => {
        openBadgeCredential = buildOpenBadgeCredential(
          tenant,
          credentialDid,
          holderDid,
        );

        vc = await generateCredentialJwt(
          openBadgeCredential,
          vcKeyPair.privateKey,
          `${credentialDid}#key-1`,
        );

        vp = await generatePresentationJwt(
          {
            type: ['VerifiablePresentation'],
            verifiableCredential: [vc],
            issuer: holderDid,
          },
          holderKeyPair.privateKey,
          `${holderDid}#key`,
        );
      });

      it('should fail to verify a presentation on demand', async () => {
        const payload = {
          tenantId: tenant._id,
          format: PresentationFormat.JWT_VP,
          presentation: vp.slice(0, -1),
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/verify`,
          payload,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          format: PresentationFormat.JWT_VP,
          presentation: vp.slice(0, -1),
          w3cPresentation: jwtDecode(payload.presentation).payload.vp,
          verification: {
            verified: false,
            tamperCheck: CheckResults.FAIL,
          },
          requestId: expect.any(String),
        });
      });

      it('should error 402 if voucher reserve exhausted', async () => {
        mockResolveDidDocument.mock.mockImplementationOnce(() => {
          const resolutionError = new Error();
          resolutionError.reason = 'No available tokens';
          return Promise.reject(resolutionError);
        });

        const payload = {
          tenantId: tenant._id,
          format: PresentationFormat.JWT_VP,
          presentation: vp,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/verify`,
          payload,
        });
        expect(response.statusCode).toEqual(402);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Payment Required',
            message: 'Verification vouchers exhausted',
            errorCode: 'verification_payment_required',
          }),
        );
      });

      it('should create pass summary result even if no expiry date and no status', async () => {
        const openBadgeCredential2 = buildOpenBadgeCredential(
          tenant,
          credentialDid,
          holderDid,
          omit(['issuanceDate', 'expirationDate'], openBadgeCredentialContent),
        );

        const vc2 = await generateCredentialJwt(
          openBadgeCredential2,
          vcKeyPair.privateKey,
          `${credentialDid}#key-1`,
        );

        mockResolveDidDocument.mock.mockImplementationOnce(() =>
          Promise.resolve(
            presentationDIDResolution(
              [credentialDid],
              [vcKeyPair],
              [boundIssuerVc],
            ),
          ),
        );

        const vp2 = await generatePresentationJwt(
          { verifiableCredential: [vc2], issuer: holderDid },
          holderKeyPair.privateKey,
          `${holderDid}#key`,
        );

        const payload = {
          tenantId: tenant._id,
          format: PresentationFormat.JWT_VP,
          presentation: vp2,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/verify`,
          payload,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          format: PresentationFormat.JWT_VP,
          presentation: vp2,
          w3cPresentation: jwtDecode(payload.presentation).payload.vp,
          verification: {
            verified: true,
            tamperCheck: CheckResults.PASS,
            credentials: [
              {
                format: CredentialFormat.JWT_VC,
                credential: vc2,
                w3cCredential: {
                  ...openBadgeCredential2,
                  issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
                },
                verified: true,
                tamperCheck: CheckResults.PASS,
                trustedIssuerCheck: CheckResults.PASS,
                trustedHolderCheck: CheckResults.PASS,
                revocationCheck: CheckResults.PASS,
                expiryCheck: CheckResults.NOT_APPLICABLE,
              },
            ],
          },
          requestId: expect.any(String),
        });
      });

      it('should create failed summary result if expired', async () => {
        const openBadgeCredential2 = buildOpenBadgeCredential(
          tenant,
          credentialDid,
          holderDid,
          {
            ...openBadgeCredentialContent,
            expirationDate: '2025-01-01T00:00:00.000Z',
          },
        );

        const vc2 = await generateCredentialJwt(
          openBadgeCredential2,
          vcKeyPair.privateKey,
          `${credentialDid}#key-1`,
        );

        const vp2 = await generatePresentationJwt(
          {
            type: ['VerifiablePresentation'],
            verifiableCredential: [vc2],
            issuer: holderDid,
          },
          holderKeyPair.privateKey,
          `${holderDid}#key`,
        );

        mockResolveDidDocument.mock.mockImplementationOnce(() =>
          Promise.resolve(
            presentationDIDResolution(
              [credentialDid],
              [vcKeyPair],
              [boundIssuerVc],
            ),
          ),
        );
        const payload = {
          tenantId: tenant._id,
          format: PresentationFormat.JWT_VP,
          presentation: vp2,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/verify`,
          payload,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          format: PresentationFormat.JWT_VP,
          presentation: vp2,
          w3cPresentation: jwtDecode(payload.presentation).payload.vp,
          verification: {
            verified: false,
            tamperCheck: CheckResults.PASS,
            credentials: [
              {
                format: CredentialFormat.JWT_VC,
                credential: vc2,
                w3cCredential: {
                  ...openBadgeCredential2,
                  issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
                },
                verified: false,
                tamperCheck: CheckResults.PASS,
                trustedIssuerCheck: CheckResults.PASS,
                trustedHolderCheck: CheckResults.PASS,
                revocationCheck: CheckResults.PASS,
                expiryCheck: CheckResults.FAIL,
              },
            ],
          },
          requestId: expect.any(String),
        });
      });

      it('should verify scalar disclosure types', async () => {
        const scalarTypeCredential = buildOpenBadgeCredential(
          tenant,
          credentialDid,
          holderDid,
          {
            ...openBadgeCredentialContent,
            type: 'OpenBadgeCredential',
          },
        );
        const scalarTypeVc = await generateCredentialJwt(
          scalarTypeCredential,
          vcKeyPair.privateKey,
          `${credentialDid}#key-1`,
        );
        const scalarTypeVp = await generatePresentationJwt(
          {
            type: 'VerifiablePresentation',
            verifiableCredential: [scalarTypeVc],
            issuer: holderDid,
          },
          holderKeyPair.privateKey,
          `${holderDid}#key`,
        );

        mockResolveDidDocument.mock.mockImplementationOnce(() =>
          Promise.resolve(
            presentationDIDResolution(
              [credentialDid],
              [vcKeyPair],
              [boundIssuerVc],
            ),
          ),
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/verify`,
          payload: {
            tenantId: tenant._id,
            format: PresentationFormat.JWT_VP,
            presentation: scalarTypeVp,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.w3cPresentation.type).toEqual(
          'VerifiablePresentation',
        );
        expect(
          response.json.verification.credentials[0].w3cCredential.type,
        ).toEqual('OpenBadgeCredential');
      });

      it('should be able to verify a presentation on demand', async () => {
        mockResolveDidDocument.mock.mockImplementationOnce(() =>
          Promise.resolve(
            presentationDIDResolution(
              [credentialDid],
              [vcKeyPair],
              [boundIssuerVc],
            ),
          ),
        );
        const payload = {
          tenantId: tenant._id,
          format: PresentationFormat.JWT_VP,
          presentation: vp,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/verify`,
          payload,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          format: PresentationFormat.JWT_VP,
          presentation: vp,
          w3cPresentation: jwtDecode(payload.presentation).payload.vp,
          verification: {
            verified: true,
            tamperCheck: CheckResults.PASS,
            credentials: [
              {
                format: CredentialFormat.JWT_VC,
                credential: vc,
                w3cCredential: {
                  ...openBadgeCredential,
                  issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
                },
                verified: true,
                tamperCheck: CheckResults.PASS,
                trustedIssuerCheck: CheckResults.PASS,
                trustedHolderCheck: CheckResults.PASS,
                revocationCheck: CheckResults.PASS,
                expiryCheck: CheckResults.PASS,
              },
            ],
          },
          requestId: expect.any(String),
        });
      });
    });

    describe('run checks on a stored presentation', () => {
      let presentationsRepo;
      beforeEach(async () => {
        try {
          presentationsRepo = presentationsRepoPlugin(fastify)({
            tenant: { ...tenant, _id: new ObjectId(tenant._id) },
          });
        } catch (error) {
          console.error(error);
          throw error;
        }
      });
      it('should fail to verify a presentation on demand', async () => {
        const credentialDid = `did:velocity:v2:1:2:3:${hashOffer(
          openBadgeCredentialContent,
        )}`;
        const vcKeyPair = generateKeyPair({ format: 'jwk' });
        const presentation = await persistPresentation({
          tenant,
          vcContent: openBadgeCredentialContent,
          credentialDid,
          vcKeyPair,
        });
        const invalidPresentation = presentation.presentation.slice(0, -1);
        await mongoDb()
          .collection('presentations')
          .updateOne(
            { _id: new ObjectId(presentation._id) },
            { $set: { presentation: invalidPresentation } },
          );

        mockResolveDidDocument.mock.mockImplementationOnce(() =>
          Promise.resolve(
            presentationDIDResolution(
              [credentialDid],
              [vcKeyPair],
              [boundIssuerVc],
            ),
          ),
        );

        const payload = {
          tenantId: tenant._id,
          presentationId: presentation._id,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/verify`,
          payload,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          format: PresentationFormat.JWT_VP,
          presentation: invalidPresentation,
          w3cPresentation: jwtDecode(presentation.presentation).payload.vp,
          verification: {
            verified: false,
            tamperCheck: CheckResults.FAIL,
          },
          requestId: expect.any(String),
        });
        await expect(
          presentationsRepo.findById(presentation._id),
        ).resolves.toEqual(
          mongoify({
            ...presentation,
            presentation: invalidPresentation,
            verifications: [
              { ...response.json.verification, createdAt: expect.any(Date) },
            ],
            updatedAt: expect.any(Date),
          }),
        );
      });

      it('should be able to verify a presentation on demand', async () => {
        const credentialDid = `did:velocity:v2:1:2:3:${hashOffer(
          openBadgeCredentialContent,
        )}`;
        const vcKeyPair = generateKeyPair({ format: 'jwk' });
        const presentation = await persistPresentation({
          tenant,
          vcContent: openBadgeCredentialContent,
          credentialDid,
          vcKeyPair,
        });

        mockResolveDidDocument.mock.mockImplementationOnce(() =>
          Promise.resolve(
            presentationDIDResolution(
              [credentialDid],
              [vcKeyPair],
              [boundIssuerVc],
            ),
          ),
        );

        const payload = {
          tenantId: tenant._id,
          presentationId: presentation._id,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/verify`,
          payload,
        });
        const vpContent = jwtDecode(presentation.presentation).payload.vp;
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          format: PresentationFormat.JWT_VP,
          presentation: presentation.presentation,
          w3cPresentation: vpContent,
          verification: {
            verified: true,
            tamperCheck: CheckResults.PASS,
            credentials: [
              {
                format: CredentialFormat.JWT_VC,
                credential: vpContent.verifiableCredential[0],
                w3cCredential: {
                  ...jwtDecode(vpContent.verifiableCredential[0]).payload.vc,
                  issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
                },
                verified: true,
                tamperCheck: CheckResults.PASS,
                trustedIssuerCheck: CheckResults.PASS,
                trustedHolderCheck: CheckResults.PASS,
                revocationCheck: CheckResults.PASS,
                expiryCheck: CheckResults.PASS,
              },
            ],
          },
          requestId: expect.any(String),
        });
        await expect(
          presentationsRepo.findById(presentation._id),
        ).resolves.toEqual({
          ...mongoify(presentation),
          verifications: [
            {
              ...response.json.verification,
              credentials: map(
                (credential) => ({
                  ...credential,
                  conclusion: CheckResults.PASS,
                }),
                response.json.verification.credentials,
              ),
              createdAt: expect.any(Date),
            },
          ],
          updatedAt: expect.any(Date),
        });
      });
    });

    describe('notify the holder', () => {
      const credentialDid = `did:velocity:v2:1:2:3:${hashOffer(
        openBadgeCredentialContent,
      )}`;
      const messagingSettings = {
        webhookUrl: 'https://wallet.example.com/push',
        authToken: 'push-token-123',
      };
      let persistExchange;
      let vcKeyPair;

      before(() => {
        ({ persistExchange } = initExchangeFactory(
          fastify,
          ExchangeTypes.RELYING_PARTY,
        ));
      });

      beforeEach(() => {
        vcKeyPair = generateKeyPair({ format: 'jwk' });
      });

      const persistExchangePresentation = async (exchangeOverrides) => {
        const exchange = await persistExchange({
          tenant,
          protocolMetadata: { protocol: ExchangeProtocols.VN_API },
          messagingSettings,
          ...exchangeOverrides,
        });
        const presentation = await persistPresentation({
          tenant,
          exchange,
          vcContent: openBadgeCredentialContent,
          credentialDid,
          vcKeyPair,
        });
        return { exchange, presentation };
      };

      const mockDidResolution = () =>
        mockResolveDidDocument.mock.mockImplementationOnce(() =>
          Promise.resolve(
            presentationDIDResolution(
              [credentialDid],
              [vcKeyPair],
              [boundIssuerVc],
            ),
          ),
        );

      const verifyAndNotify = (presentation) =>
        fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/verify`,
          payload: {
            tenantId: tenant._id,
            presentationId: presentation._id,
            notifyHolder: true,
          },
        });

      it('should send PresentationVerified to the push url with a signed authorization', async () => {
        const { exchange, presentation } = await persistExchangePresentation();
        mockDidResolution();

        const response = await verifyAndNotify(presentation);

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          format: PresentationFormat.JWT_VP,
          presentation: presentation.presentation,
          w3cPresentation: expect.any(Object),
          verification: expect.objectContaining({ verified: true }),
          notification: { status: 'sent' },
          requestId: expect.any(String),
        });
        expect(mockHttpClient.post.mock.callCount()).toEqual(1);
        const [url, body, { headers }] =
          mockHttpClient.post.mock.calls[0].arguments;
        expect(url).toEqual(messagingSettings.webhookUrl);
        expect(body).toEqual({
          id: expect.any(String),
          pushToken: messagingSettings.authToken,
          data: {
            notificationType: 'PresentationVerified',
            issuer: tenant.did,
            exchangeId: `${exchange._id}`,
            serviceEndpoint: messagingSettings.webhookUrl,
          },
        });
        expect(headers.Authorization).toMatch(/^Bearer /);
        const { header, payload } = await jwtVerify(
          headers.Authorization.slice('Bearer '.length),
          issuerKeyPair.publicKey,
        );
        expect(header.kid).toEqual(
          toDidUrl(
            tenant.did,
            tenant.keysByPurpose[KeyPurposes.EXCHANGES].kidFragment,
          ),
        );
        expect(payload).toEqual(
          expect.objectContaining({
            hash: createCommitment(canonicalize(body)),
            sub: `${exchange._id}`,
            aud: 'https://wallet.example.com',
            iss: tenant.did,
          }),
        );
        const dbPresentation = await mongoDb()
          .collection('presentations')
          .findOne({ _id: new ObjectId(presentation._id) });
        expect(dbPresentation.verifications).toHaveLength(1);
      });

      it('should send PresentationVerified when the presentation fails verification', async () => {
        const { presentation } = await persistExchangePresentation();
        await mongoDb()
          .collection('presentations')
          .updateOne(
            { _id: new ObjectId(presentation._id) },
            { $set: { presentation: presentation.presentation.slice(0, -1) } },
          );

        const response = await verifyAndNotify(presentation);

        expect(response.statusCode).toEqual(200);
        expect(response.json.verification).toEqual({
          verified: false,
          tamperCheck: CheckResults.FAIL,
        });
        expect(response.json.notification).toEqual({ status: 'sent' });
        expect(mockHttpClient.post.mock.callCount()).toEqual(1);
        expect(
          mockHttpClient.post.mock.calls[0].arguments[1].data.notificationType,
        ).toEqual('PresentationVerified');
      });

      it('should skip the message when the exchange has no messaging settings', async () => {
        const { presentation } = await persistExchangePresentation({
          protocolMetadata: { protocol: ExchangeProtocols.OPENID4VP },
          messagingSettings: undefined,
        });
        mockDidResolution();

        const response = await verifyAndNotify(presentation);

        expect(response.statusCode).toEqual(200);
        expect(response.json.verification.verified).toEqual(true);
        expect(response.json.notification).toEqual({
          status: 'skipped_no_messaging_settings',
        });
        expect(mockHttpClient.post.mock.callCount()).toEqual(0);
      });

      for (const [failure, error] of [
        [
          'returns 500',
          Object.assign(new Error('Response Error'), { statusCode: 500 }),
        ],
        [
          'times out',
          Object.assign(new Error('Headers Timeout Error'), {
            code: 'UND_ERR_HEADERS_TIMEOUT',
          }),
        ],
      ]) {
        it(`should return a failed notification and the verification when the push url ${failure}`, async () => {
          const { presentation } = await persistExchangePresentation();
          mockDidResolution();
          mockHttpClient.post.mock.mockImplementationOnce(() =>
            Promise.reject(error),
          );

          const response = await verifyAndNotify(presentation);

          expect(response.statusCode).toEqual(200);
          expect(response.json.verification.verified).toEqual(true);
          expect(response.json.notification).toEqual({
            status: 'failed',
            error: error.message,
          });
          expect(mockHttpClient.post.mock.callCount()).toEqual(1);
          const dbPresentation = await mongoDb()
            .collection('presentations')
            .findOne({ _id: new ObjectId(presentation._id) });
          expect(dbPresentation.verifications).toHaveLength(1);
        });
      }

      it('should return a failed notification when the push url redirects', async () => {
        const { presentation } = await persistExchangePresentation();
        mockDidResolution();
        mockHttpClient.post.mock.mockImplementationOnce(() =>
          Promise.resolve({ statusCode: 307 }),
        );

        const response = await verifyAndNotify(presentation);

        expect(response.statusCode).toEqual(200);
        expect(response.json.notification).toEqual({
          status: 'failed',
          error: 'push url responded with 307',
        });
        expect(mockHttpClient.post.mock.callCount()).toEqual(1);
      });

      it('should fail without posting to an http push url', async () => {
        const { presentation } = await persistExchangePresentation({
          messagingSettings: {
            ...messagingSettings,
            webhookUrl: 'http://wallet.example.com/push',
          },
        });
        mockDidResolution();

        const response = await verifyAndNotify(presentation);

        expect(response.statusCode).toEqual(200);
        expect(response.json.notification).toEqual({
          status: 'failed',
          error: 'push url must use https',
        });
        expect(mockHttpClient.post.mock.callCount()).toEqual(0);
      });

      it('should post to an http push url when WALLET_MESSAGES_ALLOW_INSECURE_URL is set', async (t) => {
        fastify.config.walletMessagesAllowInsecureUrl = true;
        t.after(() => {
          fastify.config.walletMessagesAllowInsecureUrl = false;
        });
        const { presentation } = await persistExchangePresentation({
          messagingSettings: {
            ...messagingSettings,
            webhookUrl: 'http://wallet.example.com/push',
          },
        });
        mockDidResolution();

        const response = await verifyAndNotify(presentation);

        expect(response.statusCode).toEqual(200);
        expect(response.json.notification).toEqual({ status: 'sent' });
        expect(mockHttpClient.post.mock.calls[0].arguments[0]).toEqual(
          'http://wallet.example.com/push',
        );
      });

      it('should send nothing when verification requires payment', async () => {
        const { presentation } = await persistExchangePresentation();
        mockResolveDidDocument.mock.mockImplementationOnce(() => {
          const resolutionError = new Error();
          resolutionError.reason = 'No available tokens';
          return Promise.reject(resolutionError);
        });

        const response = await verifyAndNotify(presentation);

        expect(response.statusCode).toEqual(402);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Payment Required',
            message: 'Verification vouchers exhausted',
            errorCode: 'verification_payment_required',
          }),
        );
        expect(mockHttpClient.post.mock.callCount()).toEqual(0);
      });

      it('should 400 when notifyHolder is sent with an inline presentation', async () => {
        const { presentation } = await persistExchangePresentation();

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/verify`,
          payload: {
            tenantId: tenant._id,
            format: PresentationFormat.JWT_VP,
            presentation: presentation.presentation,
            notifyHolder: true,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            message: 'notifyHolder requires a presentationId',
            errorCode: 'presentation_verify_request_invalid',
          }),
        );
        expect(mockHttpClient.post.mock.callCount()).toEqual(0);
      });

      it('should 404 when the presentation is unknown', async () => {
        const presentationId = new ObjectId().toString();

        const response = await verifyAndNotify({ _id: presentationId });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Not Found',
            message: `Presentation ${presentationId} not found`,
            errorCode: 'presentation_not_found',
          }),
        );
      });
    });
  });
});

const expectedResponsePresentation = (presentation, overrides) =>
  applyOverrides(
    {
      ...omit(['_id', 'tenantId'], presentation),
      id: presentation._id,
      verifications: map(
        (verification) => ({
          ...verification,
          credentials: map(omit(['conclusion']), verification.credentials),
        }),
        presentation.verifications,
      ),
    },
    overrides,
  );

const presentationDIDResolution = (
  credentialDids,
  credentialKeyPairs,
  boundIssuerVcs,
) => ({
  didDocument: {
    id: `did:velocity:v2:multi:${credentialDids.map((credentialDid) =>
      credentialDid.split(':').slice(3).join(':'),
    )}`,
    publicKey: mapWithIndex(
      (credentialDid, i) => ({
        // The ledger resolver echoes the verifier-supplied credential id.
        id: `${credentialDid}#key-1`,
        publicKeyJwk: credentialKeyPairs[i].publicKey,
      }),
      credentialDids,
    ),
    service: ['SERVICE'],
  },
  didDocumentMetadata: {
    boundIssuerVcs: mapWithIndex(
      (credentialDid, i) => ({
        id: credentialDid,
        format: 'jwt_vc',
        vc: boundIssuerVcs[i],
      }),
      credentialDids,
    ),
  },
  didResolutionMetadata: {},
});

const credentialTypeMetadatas = [
  {
    credentialType: 'fooType',
    schemaUrl: 'https://example.com/foo-schema.schema.json',
  },
  {
    credentialType: 'EducationDegreeGraduationV1.1',
    schemaUrl:
      'https://example.com/education-degree-graduation-v1.1.schema.json',
  },
  {
    credentialType: 'OpenBadgeCredential',
    schemaUrl: 'https://example.com/open-badge-credential.schema.json',
  },
];

const openBadgeJsonLdContext = {
  '@context': {
    OpenBadgeCredential: {
      '@id': 'https://velocitynetwork.foundation/contexts#OpenBadgeCredential',
      '@context': {
        authority: {
          '@id':
            'https://velocitynetwork.foundation/contexts#primaryOrganization',
        },
      },
    },
  },
};
