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
  mockHttpClientJsonRoute,
  mockHttpClientModule,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { hashOffer } = require('@verii/verii-issuing');
const { initMetadataRegistry } = require('@verii/metadata-registration');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { generateKeyPair } = require('@verii/crypto');
const { applyOverrides, mapWithIndex } = require('@verii/common-functions');
const { generateKeyPairInHexAndJwk } = require('@verii/tests-helpers');
const { CheckResults } = require('@verii/vc-checks');
const { getDidUriFromJwk } = require('@verii/did-doc');
const {
  generatePresentationJwt,
  generateCredentialJwt,
  jwtDecode,
  jwtSign,
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

    holderKeyPair = generateKeyPairInHexAndJwk();
    holderDid = getDidUriFromJwk(holderKeyPair.publicJwk);
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
          holderKeyPair.privateJwk,
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
          holderKeyPair.privateJwk,
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
          holderKeyPair.privateJwk,
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
        id: `${credentialDid.toLowerCase()}#key-1`,
        publicKeyJwk: credentialKeyPairs[i].publicKey,
      }),
      credentialDids,
    ),
    service: ['SERVICE'],
  },
  didDocumentMetadata: {
    boundIssuerVcs: mapWithIndex(
      (credentialDid, i) => ({
        id: credentialDid.toLowerCase(),
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
