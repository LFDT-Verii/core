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

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { mongoify, errorResponseMatcher } = require('@verii/tests-helpers');
const nock = require('nock');
const { generateKeyPair } = require('@verii/crypto');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { jwtDecode } = require('@verii/jwt');
const { BASE64_FORMAT } = require('@verii/test-regexes');
const {
  castArray,
  compact,
  entries,
  every,
  includes,
  keyBy,
  map,
  omit,
  pick,
  set,
  uniq,
} = require('lodash/fp');
const { getUnixTime, subHours } = require('date-fns/fp');
const {
  extractCredentialType,
  VelocityRevocationListType,
} = require('@verii/vc-checks');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const { openBadgeCredentialExample } = require('@verii/sample-data');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const {
  initKeysFactory,
  initTenantFactory,
  initOfferFactory,
  ExchangeStates,
  CredentialFormat,
  ExchangeProtocols,
  ExchangeTypes,
} = require('../../src/entities');
const { nockRegistrarAppSchemaName } = require('../combined/helpers');

const mockAddCredentialMetadataEntry = jest.fn();
const mockCreateCredentialMetadataList = jest.fn();
const mockAddRevocationListSigned = jest.fn();
const mockGetRevokeUrl = jest.fn();

jest.mock('@verii/metadata-registration', () => ({
  ...jest.requireActual('@verii/metadata-registration'),
  initRevocationRegistry: () => ({
    addRevocationListSigned: mockAddRevocationListSigned,
  }),
  initMetadataRegistry: () => ({
    addCredentialMetadataEntry: mockAddCredentialMetadataEntry,
    createCredentialMetadataList: mockCreateCredentialMetadataList,
  }),
}));

const clearDb = async () => {
  await mongoDb().collection('tenants').deleteMany({});
  await mongoDb().collection('keys').deleteMany({});
  await mongoDb().collection('exchanges').deleteMany({});
  await mongoDb().collection('offers').deleteMany({});
};

const url = (tenant) =>
  `/operator-api/v0.8/tenants/${tenant._id}/vc-api/credentials/issue`;

describe('vc-api credentials endpoints', () => {
  let fastify;
  let persistTenant;
  let persistKey;
  let persistOffer;

  let tenant;
  let holderKeys;
  let holderDid;
  let baseCredential;

  beforeEach(async () => {
    nock.cleanAll();
    jest.resetAllMocks();
    mockGetRevokeUrl.mockImplementation(
      (listId, index) =>
        `ethereum://0x1234/getRevokeStatus?address=0x412&listId=${listId}&index=${index}`
    );
    await clearDb();
    tenant = await persistTenant({
      serviceIds: ['#foo-service-id-1'],
    });
    const keyPair = generateKeyPair({ format: 'jwk' });
    await persistKey({ tenant, kidFragment: '#ID2', keyPair });

    holderKeys = await generateKeyPair({ format: 'jwk' });
    holderDid = getDidUriFromJwk(holderKeys.publicKey);
    baseCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://www.w3.org/2018/credentials/examples/v1',
      ],
      type: ['VerifiableCredential', 'PastEmploymentPosition'],
      issuer: {
        id: tenant.did,
      },
      credentialSubject: {
        id: holderDid,
        company: tenant.did,
        companyName: {
          localized: {
            en: 'Microsoft Corporation',
          },
        },
        title: {
          localized: {
            en: 'Director, Communications (HoloLens & Mixed Reality Experiences)',
          },
        },
        startMonthYear: {
          month: 10,
          year: 2010,
        },
        endMonthYear: {
          month: 6,
          year: 2019,
        },
        location: {
          countryCode: 'US',
          regionCode: 'MA',
        },
        description: {
          localized: {
            en: 'l Data, AI, Hybrid, IoT, Datacenter, Mixed Reality/HoloLens, D365, Power Platform - all kinds of fun stuff!',
          },
        },
      },
    };
  });

  afterAll(() => {
    nock.cleanAll();
    nock.restore();
  });

  describe('vc-api when enabled', () => {
    beforeAll(async () => {
      fastify = buildFastify({
        vcApiEnabled: true,
      });
      await fastify.ready();
      ({ persistTenant } = initTenantFactory(fastify));
      ({ persistKey } = initKeysFactory(fastify));
      ({ persistOffer } = initOfferFactory(fastify));
    });

    afterAll(async () => {
      await clearDb();
      await fastify.close();
    });

    it('should fail to issue a json-ld credential', async () => {
      const payload = {
        credential: baseCredential,
        options: {
          format: CredentialFormat.JSON_LD_VC,
        },
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: url(tenant),
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'options.format must be jwt-vc',
          statusCode: 400,
        })
      );
    });

    it('should fail 400 with options missing', async () => {
      const payload = {
        credential: baseCredential,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: url(tenant),
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'options.format must be jwt-vc',
          statusCode: 400,
        })
      );
    });

    it('should fail 400 with invalid credentialRequest', async () => {
      const payload = {
        credential: omit(['@context'], baseCredential),
        options: {
          format: CredentialFormat.JWT_VC,
        },
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: url(tenant),
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: "body/credential must have required property '@context'",
          statusCode: 400,
        })
      );
    });

    it('should fail 400 with invalid credentialSubject', async () => {
      nockRegistrarAppSchemaName();
      const credential = omit(['credentialSubject.company'], baseCredential);
      const payload = {
        credential,
        options: {
          format: CredentialFormat.JWT_VC,
        },
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: url(tenant),
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message:
            "'$.credentialSubject' must have required property 'company'",
          statusCode: 400,
        })
      );
    });

    describe('successful issuing', () => {
      beforeEach(() => {
        mockCreateCredentialMetadataList.mockResolvedValue(true);
        mockAddCredentialMetadataEntry.mockResolvedValue(true);

        const nockInstance = nock('http://oracle.localhost.test');
        nockCredentialTypes();
        nockRegistrarAppSchemaName({ nockInstance });
      });

      it('should issue a credential', async () => {
        const payload = {
          credential: baseCredential,
          options: {
            format: CredentialFormat.JWT_VC,
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: url(tenant),
          payload,
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          verifiableCredential: expect.any(String),
        });
        const vc = jwtDecode(response.json.verifiableCredential);
        expect(vc).toEqual(
          jwtVcExpectation({
            tenant,
            credentialId: vc.payload.jti,
            credential: payload.credential,
            holderDid,
          })
        );
        const dbOffer = await mongoDb()
          .collection('offers')
          .findOne({ did: vc.payload.jti });
        expect(dbOffer).toEqual(
          offerExpectation({
            tenant,
            credential: payload.credential,
            credentialId: vc.payload.jti,
            holderDid,
          })
        );

        const dbExchange = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: dbOffer.exchangeId });
        expect(dbExchange).toEqual(
          exchangeExpectation({
            tenant,
            dbOffer,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.COMPLETE,
            ],
          })
        );
        expect(mockAddCredentialMetadataEntry.mock.calls).toEqual([
          [
            expect.any(Object),
            expect.any(String),
            'did:ion:cao',
            'cosekey:aes-256-gcm',
          ],
        ]);
      });

      it("should issue a credential without a credential subject's DID", async () => {
        const payload = {
          credential: omit(['credentialSubject.id'], baseCredential),
          options: {
            format: CredentialFormat.JWT_VC,
          },
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: url(tenant),
          payload,
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          verifiableCredential: expect.any(String),
        });
        const vc = jwtDecode(response.json.verifiableCredential);
        const jwtVcExpectationObj = jwtVcExpectation({
          tenant,
          credentialId: vc.payload.jti,
          credential: payload.credential,
          vnfProtocolVersion: 1,
        });
        expect(vc).toEqual(omit(['payload.sub'], jwtVcExpectationObj));
        const dbOffer = await mongoDb()
          .collection('offers')
          .findOne({ did: vc.payload.jti });
        expect(dbOffer).toEqual(
          offerExpectation({
            tenant,
            credential: payload.credential,
            credentialId: vc.payload.jti,
          })
        );

        const dbExchange = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: dbOffer.exchangeId });
        expect(dbExchange).toEqual(
          exchangeExpectation({
            tenant,
            dbOffer,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.COMPLETE,
            ],
          })
        );
      });

      it('should issue a credential with consentedAt overridden', async () => {
        const payload = {
          credential: baseCredential,
          options: {
            format: CredentialFormat.JWT_VC,
            consented: subHours(24, new Date()),
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: url(tenant),
          payload,
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          verifiableCredential: expect.any(String),
        });
        const vc = jwtDecode(response.json.verifiableCredential);
        expect(vc).toEqual(
          jwtVcExpectation({
            tenant,
            credentialId: vc.payload.jti,
            credential: payload.credential,
            holderDid,
          })
        );
        const dbOffer = await mongoDb()
          .collection('offers')
          .findOne({ did: vc.payload.jti });
        expect(dbOffer).toEqual(
          offerExpectation({
            tenant,
            credential: payload.credential,
            credentialId: vc.payload.jti,
            holderDid,
            overrides: {
              consentedAt: payload.options.consented,
            },
          })
        );

        const dbExchange = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: dbOffer.exchangeId });
        expect(dbExchange).toEqual(
          exchangeExpectation({
            tenant,
            dbOffer,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.COMPLETE,
            ],
          })
        );
      });

      it('should issue a credential with expirationDate properties if set', async () => {
        const credential = {
          ...baseCredential,
          expirationDate: new Date().toISOString(),
        };
        const payload = {
          credential,
          options: {
            format: CredentialFormat.JWT_VC,
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: url(tenant),
          payload,
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          verifiableCredential: expect.any(String),
        });
        const vc = jwtDecode(response.json.verifiableCredential);
        expect(vc).toEqual(
          jwtVcExpectation({
            tenant,
            credentialId: vc.payload.jti,
            credential,
            holderDid,
            overrides: {
              'payload.exp': getUnixTime(new Date(credential.expirationDate)),
            },
          })
        );
        const dbOffer = await mongoDb()
          .collection('offers')
          .findOne({ did: vc.payload.jti });
        expect(dbOffer).toEqual(
          offerExpectation({
            tenant,
            credential,
            credentialId: vc.payload.jti,
            holderDid,
          })
        );

        const dbExchange = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: dbOffer.exchangeId });
        expect(dbExchange).toEqual(
          exchangeExpectation({
            tenant,
            dbOffer,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.COMPLETE,
            ],
          })
        );
      });

      it('should issue a credential even if the issuer property isnt passed directly', async () => {
        const credential = omit(['issuer'], baseCredential);
        const payload = {
          credential,
          options: {
            format: CredentialFormat.JWT_VC,
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: url(tenant),
          payload,
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          verifiableCredential: expect.any(String),
        });
        const vc = jwtDecode(response.json.verifiableCredential);
        expect(vc).toEqual(
          jwtVcExpectation({
            tenant,
            credentialId: vc.payload.jti,
            credential: baseCredential,
            holderDid,
          })
        );
        const dbOffer = await mongoDb()
          .collection('offers')
          .findOne({ did: vc.payload.jti });
        expect(dbOffer).toEqual(
          offerExpectation({
            tenant,
            credential: baseCredential,
            credentialId: vc.payload.jti,
            holderDid,
          })
        );

        const dbExchange = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: dbOffer.exchangeId });
        expect(dbExchange).toEqual(
          exchangeExpectation({
            tenant,
            dbOffer,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.COMPLETE,
            ],
          })
        );
      });

      it('should issue a credential with resource reference data', async () => {
        const resourceId = 'did:velocity:resource';
        const targetOffer = await persistOffer({
          tenant,
          consentedAt: new Date(),
          did: resourceId,
          digestSRI: 'digestSRI',
        });
        const payload = {
          credential: {
            ...baseCredential,
            replaces: [
              {
                id: resourceId,
              },
            ],
            relatedResource: [
              {
                id: resourceId,
              },
            ],
          },
          options: {
            format: CredentialFormat.JWT_VC,
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: url(tenant),
          payload,
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          verifiableCredential: expect.any(String),
        });
        const vc = jwtDecode(response.json.verifiableCredential);
        expect(vc).toEqual(
          jwtVcExpectation({
            tenant,
            credentialId: vc.payload.jti,
            credential: {
              ...payload.credential,
              replaces: [
                {
                  id: resourceId,
                  digestSRI: targetOffer.digestSRI,
                  hint: targetOffer.type,
                },
              ],
              relatedResource: [
                {
                  id: resourceId,
                  digestSRI: targetOffer.digestSRI,
                  hint: targetOffer.type,
                },
              ],
            },
            holderDid,
          })
        );
        const dbOffer = await mongoDb()
          .collection('offers')
          .findOne({ did: vc.payload.jti });
        expect(dbOffer).toEqual(
          offerExpectation({
            tenant,
            credential: {
              ...payload.credential,
              replaces: [
                {
                  id: resourceId,
                  digestSRI: targetOffer.digestSRI,
                  hint: targetOffer.type,
                },
              ],
              relatedResource: [
                {
                  id: resourceId,
                  digestSRI: targetOffer.digestSRI,
                  hint: targetOffer.type,
                },
              ],
            },
            credentialId: vc.payload.jti,
            holderDid,
          })
        );

        const dbExchange = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: dbOffer.exchangeId });
        expect(dbExchange).toEqual(
          exchangeExpectation({
            tenant,
            dbOffer,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.COMPLETE,
            ],
          })
        );
      });

      it('should issue a open badge v3', async () => {
        const payload = {
          credential: {
            ...openBadgeCredentialExample,
            issuer: {
              id: tenant.did,
            },
          },
          options: {
            format: CredentialFormat.JWT_VC,
          },
        };
        payload.credential.credentialSubject.id = holderDid;

        nock('https://imsglobal.org')
          .get('/schemas/open-badge-v3.0-schema.json')
          .reply(
            200,
            require('../combined/schemas/open-badge-credential.schema.json')
          );

        const response = await fastify.injectJson({
          method: 'POST',
          url: url(tenant),
          payload,
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          verifiableCredential: expect.any(String),
        });
        const vc = jwtDecode(response.json.verifiableCredential);
        expect(vc).toEqual(
          jwtVcExpectation({
            tenant,
            credentialId: vc.payload.jti,
            credential: payload.credential,
            holderDid,
            credentialTypeContext: [],
            overrides: {
              'payload.vc.credentialStatus': [
                payload.credential.credentialStatus,
                {
                  id: expect.stringMatching(
                    '^ethereum:0x[0-9a-fA-F]+/getRevokedStatus\\?address=0x[0-9a-z]+&listId=\\d+&index=\\d+$'
                  ),
                  type: VelocityRevocationListType,
                },
              ],
              'payload.vc.refreshService': [
                payload.credential.refreshService,
                {
                  type: 'VelocityNetworkRefreshService2024',
                  id: `${tenant.did}#foo-service-id-1`,
                },
              ],
              'payload.vc.credentialSubject.type': 'AchievementSubject',
              'payload.vc.credentialSubject.@context': undefined,
              'payload.vc.credentialSchema': {
                type: '1EdTechJsonSchemaValidator2019',
                id: 'http://example.com/schema.json',
              },
            },
          })
        );
      });
    });
  });

  describe('vc-api when disabled', () => {
    beforeAll(async () => {
      fastify = buildFastify();
      await fastify.ready();
      ({ persistTenant } = initTenantFactory(fastify));
      ({ persistKey } = initKeysFactory(fastify));
    });

    afterAll(async () => {
      await clearDb();
      await fastify.close();
    });

    it('the endpoint should not be found', async () => {
      const payload = {
        credential: baseCredential,
        options: {
          format: CredentialFormat.JWT_VC,
        },
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: url(tenant),
        payload,
      });
      expect(response.statusCode).toEqual(404);
    });
  });
});

const offerExpectation = ({
  credential,
  credentialId,
  holderDid,
  tenant,
  overrides = {},
}) => {
  let expectation = {
    ...credential,
    '@context': expect.arrayContaining([
      ...credential['@context'],
      'https://lib.test/contexts/credential-extensions-2022.jsonld.json',
    ]),
    _id: expect.any(ObjectId),
    did: credentialId,
    credentialSubject: {
      type: 'PastEmploymentPosition',
      ...credential.credentialSubject,
      id: holderDid,
    },
    type: expect.arrayContaining(credential.type),
    ...defaultVnfCredentialExpectations,
    linkCode: expect.any(String),
    credentialStatus: {
      id: expect.stringMatching(
        '^ethereum:0x[0-9a-fA-F]+/getRevokedStatus\\?address=0x[0-9a-z]+&listId=\\d+&index=\\d+$'
      ),
      type: VelocityRevocationListType,
    },
    issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
    tenantId: new ObjectId(tenant._id),
    exchangeId: expect.any(ObjectId),
    offerId: expect.any(String),
    digestSRI: expect.any(String),
    consentedAt: expect.any(Date),
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
  };
  for (const [key, value] of entries(overrides)) {
    expectation = set(key, value, expectation);
  }
  return expectation;
};

const jwtVcExpectation = ({
  tenant,
  credential,
  credentialId,
  holderDid,
  vnfProtocolVersion = 2,
  credentialTypeContext = [
    'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
  ],
  overrides = {},
}) => {
  let expectation = {
    header: {
      alg: 'ES256K',
      kid: `${credentialId}#key-1`,
      typ: 'JWT',
    },
    payload: {
      iat: expect.any(Number),
      iss: tenant.did,
      nbf: expect.any(Number),
      jti: credentialId,
      sub: holderDid,
      vc: {
        ...credential,
        '@context': uniq(
          compact([
            'https://www.w3.org/2018/credentials/v1',
            ...credentialTypeContext,
            ...castArray(credential['@context']),
            'https://lib.test/contexts/credential-extensions-2022.jsonld.json',
          ])
        ),
        id: credentialId,
        type: expect.arrayContaining(credential.type),
        credentialSubject: {
          type: 'PastEmploymentPosition',
          ...credential.credentialSubject,
        },
        refreshService: {
          type: 'VelocityNetworkRefreshService2024',
          id: `${tenant.did}#foo-service-id-1`,
        },
        credentialSchema: {
          type: 'JsonSchemaValidator2018',
          id: credentialTypeMetadata[extractCredentialType(credential)]
            .schemaUrl,
        },
        ...defaultVnfCredentialExpectations,
        credentialStatus: {
          id: expect.stringMatching(
            '^ethereum:0x[0-9a-fA-F]+/getRevokedStatus\\?address=0x[0-9a-z]+&listId=\\d+&index=\\d+$'
          ),
          type: VelocityRevocationListType,
        },
        vnfProtocolVersion,
        issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
      },
    },
  };
  for (const [key, value] of entries(overrides)) {
    expectation = set(key, value, expectation);
  }
  return expectation;
};

const exchangeExpectation = ({ tenant, dbOffer, states }) =>
  mongoify({
    _id: dbOffer.exchangeId,
    type: ExchangeTypes.ISSUING,
    tenantId: tenant._id,
    events: map((state) => ({ state, timestamp: expect.any(Date) }), states),
    protocolMetadata: {
      protocol: ExchangeProtocols.W3C_VC_API,
    },
    finalizedOfferIds: [dbOffer._id],
    createdBy: 'velocity.admin@example.com',
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
  });

const credentialTypeMetadata = keyBy('credentialType', [
  {
    credentialType: 'EmailV1.0',
    layer1: true,
    schemaUrl:
      'https://velocitynetwork.foundation/schemas/email-v1.0.schema.json',
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
    credentialType: 'PastEmploymentPosition',
    layer1: true,
    schemaUrl: 'http://mock.com/schemas/past-employment-position',
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
  {
    credentialType: 'OpenBadgeCredential',
    layer1: true,
    schemaUrl: 'https://imsglobal.org/schemas/open-badge-v3.0-schema.json',
  },
]);

const nockCredentialTypes = () => {
  nock('http://oracle.localhost.test')
    .get('/api/v0.6/credential-types')
    .query((query) =>
      every(
        (credentialType) =>
          includes(credentialType, Object.keys(credentialTypeMetadata)),
        castArray(query.credentialType)
      )
    )
    .times(2)
    .reply(200, (uri) => {
      const questionMarkIdx = uri.indexOf('?');
      const searchParamsString = uri.substring(questionMarkIdx);
      const query = new URLSearchParams(searchParamsString);
      return Object.values(
        pick(query.getAll('credentialType'), credentialTypeMetadata)
      );
    });
};

const defaultVnfCredentialExpectations = {
  contentHash: {
    type: 'VelocityContentHash2020',
    value: expect.any(String),
  },
  credentialSchema: {
    type: 'JsonSchemaValidator2018',
    id: credentialTypeMetadata.PastEmploymentPosition.schemaUrl,
  },
  linkCodeCommitment: {
    type: 'VelocityCredentialLinkCodeCommitment2022',
    value: expect.stringMatching(BASE64_FORMAT),
  },
};
