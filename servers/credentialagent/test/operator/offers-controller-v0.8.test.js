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
const {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
  mock,
} = require('node:test');
const { expect } = require('expect');

mock.module('../../src/fetchers/push-gateway/generate-push-gateway-token.js', {
  namedExports: { generatePushGatewayToken: () => Promise.resolve('token') },
});

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { nanoid } = require('nanoid');
const { flow, map, omit, set } = require('lodash/fp');
const { intermediateIssuer } = require('@verii/sample-data');
const nock = require('nock');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
  NANO_ID_FORMAT,
} = require('@verii/test-regexes');

const {
  mongoify,
  testAuthToken,
  errorResponseMatcher,
} = require('@verii/tests-helpers');
const { hashOffer } = require('@verii/verii-issuing');
const { openBadgeCredentialExample } = require('@verii/sample-data');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const {
  nockRegistrarAppSchemaName,
} = require('../combined/helpers/nock-registrar-app-schema-name');
const initOfferRepo = require('../../src/entities/offers/repos/repo');
const {
  ExchangeStates,
  ExchangeTypes,
  initOfferFactory,
  initTenantFactory,
  initUserFactory,
  initOfferExchangeFactory,
  initDisclosureFactory,
  NotificationTypes,
} = require('../../src/entities');
const {
  nockRegistrarGetOrganizationDidDoc,
} = require('../combined/helpers/nock-registrar-get-organization-diddoc');

const exchangeOffersUrl = ({ tenant, exchange }, suffix = '') =>
  `/operator-api/v0.8/tenants/${tenant._id}/exchanges/${exchange._id}/offers/${suffix}`;

const exchangesUrl = ({ tenant, exchange }, suffix = '') =>
  `/operator-api/v0.8/tenants/${tenant._id}/exchanges/${exchange._id}/${suffix}`;

const credentialTypesObject = { credentialTypes: ['PastEmploymentPosition'] };
const testPushEndpointURL = new URL('https://push.localhost.test/push');

describe('vendor offer management', () => {
  let fastify;
  let persistOffer;
  let persistOfferExchange;
  let persistVendorUserIdMapping;
  let persistTenant;
  let persistDisclosure;
  let tenant;
  let disclosure;
  let exchange;
  let exchangeId;
  let newOffer;
  let user;
  let exchangeCollection;
  let offerCollection;
  let exchangeOffers;
  let pushExchange;
  let pushExchangeOffers;
  let offersRepo;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistDisclosure } = initDisclosureFactory(fastify));
    ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
    ({ newOffer, persistOffer } = initOfferFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistVendorUserIdMapping } = initUserFactory(fastify));
  });

  beforeEach(async () => {
    fastify.resetOverrides();
    fastify.removeDocSchema();
    fastify.overrides.reqConfig = (config) => ({
      ...config,
      enableOfferValidation: true,
    });
    offerCollection = mongoDb().collection('offers');
    exchangeCollection = mongoDb().collection('exchanges');

    await mongoDb().collection('vendorUserIdMappings').deleteMany({});
    await offerCollection.deleteMany({});
    await exchangeCollection.deleteMany({});
    await mongoDb().collection('tenants').deleteMany({});

    const orgDid = 'did:velocity:0xc257274276a4e539741ca11b590b9447b26a8051';

    nockRegistrarGetOrganizationDidDoc(orgDid, { id: orgDid });
    tenant = await persistTenant({
      did: orgDid,
      serviceIds: [`${orgDid}#issuer-1`],
    });
    disclosure = await persistDisclosure({ tenant });
    exchange = await persistOfferExchange({ tenant, disclosure });
    pushExchange = await persistOfferExchange({
      tenant,
      disclosure,
      pushDelegate: {
        pushToken: 'some-token',
        pushUrl: testPushEndpointURL.href,
      },
    });
    exchangeId = exchange._id;

    user = await persistVendorUserIdMapping();
    exchangeOffers = await Promise.all([
      persistOffer({ tenant, exchange }),
      persistOffer({ tenant, exchange }),
    ]);
    pushExchangeOffers = await Promise.all([
      persistOffer({ tenant, exchange: pushExchange }),
    ]);

    offersRepo = initOfferRepo(fastify)({
      log: fastify.log,
      config: fastify.config,
      tenant: { ...tenant, _id: new ObjectId(tenant._id) },
    });
  });

  const newVendorOffer = async (overrides) =>
    omit(
      [
        'issuer',
        'credentialSchema',
        'contentHash',
        'isDuplicate',
        'exchangeId',
      ],
      await newOffer(overrides)
    );

  afterEach(() => {
    nock.cleanAll();
  });

  after(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
    mock.reset();
  });

  describe('/offers Adding offers to exchange Test Suite', () => {
    it('Adding offer should 200 when adding offer when credential type has unrelated schema url and name and hit the cache second time', async () => {
      const getSchemaNock = nockRegistrarAppSchemaName({
        schemaName: 'fooV1',
        responseJson: require('../combined/schemas/past-employment-position-with-uri-id.schema'),
        repeatCount: 2,
      });

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: { ...offer, _id: 123 },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...offer,
        credentialSubject: {
          ...offer.credentialSubject,
          type: 'PastEmploymentPosition',
        },
        exchangeId,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        issuer: {
          id: tenant.did,
        },
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });

      expect(offerFromDb).toEqual(
        mongoify({
          ...offer,
          credentialSubject: {
            ...offer.credentialSubject,
            type: 'PastEmploymentPosition',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              ...offer,
              credentialSubject: {
                ...offer.credentialSubject,
                type: 'PastEmploymentPosition',
              },
            }),
          },
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          issuer: {
            id: tenant.did,
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId,
        })
      );

      expect(getSchemaNock.pendingMocks()).toHaveLength(1);

      const responseWithSchemaAlreadyCached = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: { ...offer, _id: 123 },
      });
      expect(responseWithSchemaAlreadyCached.statusCode).toEqual(200);
      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/offers should 200 and have an ObjectId _id on created offer', async () => {
      await nockRegistrarAppSchemaName({
        schemaName: 'past-employment-position',
        credentialType: 'PastEmploymentPosition',
        responseJson: require('../combined/schemas/past-employment-position.schema.json'),
      });

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: { ...offer, _id: '222222220dcddc00099735ba' },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...offer,
        credentialSubject: {
          ...offer.credentialSubject,
          type: 'PastEmploymentPosition',
        },
        exchangeId,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        issuer: {
          id: tenant.did,
        },
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });

      expect(offerFromDb).toEqual(
        mongoify({
          ...offer,
          credentialSubject: {
            ...offer.credentialSubject,
            type: 'PastEmploymentPosition',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              ...offer,
              credentialSubject: {
                ...offer.credentialSubject,
                type: 'PastEmploymentPosition',
              },
            }),
          },
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId,
          issuer: {
            id: tenant.did,
          },
        })
      );
    });

    it('/offers should 200 and have relatedResources', async () => {
      const credentialIds = [
        'did:velocity:0x1234567890abcdef',
        'did:velocity:0x9999999999999999',
      ];

      const credentials = await Promise.all([
        persistOffer({
          tenant,
          consentedAt: new Date(),
          did: credentialIds[0],
        }),
        persistOffer({
          tenant,
          consentedAt: new Date(),
          did: credentialIds[1],
          digestSRI: nanoid(),
        }),
      ]);

      const replaces = [{ id: credentialIds[0] }];
      const relatedResource = [
        {
          id: credentialIds[1],
          type: 'RelatedType',
        },
        {
          id: 'data:application/pdf;Aw98ScQOik',
          hint: ['PDF'],
          mediaType: 'application/pdf',
        },
        {
          id: 'http://docs.velocity.network/sample.pdf',
          hint: ['PDF'],
          mediaType: 'application/pdf',
          name: 'Judgement-2024-05-21.pdf',
          digestSRI: 'sha384-EiDrDhbTg9CfPbjtchRjDqE64HGY7Ok4U9mNd8vQZ664AQ',
        },
      ];

      await nockRegistrarAppSchemaName({
        schemaName: 'past-employment-position',
        credentialType: 'PastEmploymentPosition',
        responseJson: require('../combined/schemas/past-employment-position.schema.json'),
      });

      const expectedOffer = await newVendorOffer({
        tenant,
        exchange,
        replaces,
        relatedResource,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: expectedOffer,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...expectedOffer,
        credentialSubject: {
          ...expectedOffer.credentialSubject,
          type: 'PastEmploymentPosition',
        },
        replaces: [
          {
            ...replaces[0],
            hint: credentials[0].type,
          },
        ],
        relatedResource: [
          {
            ...relatedResource[0],
            type: [relatedResource[0].type], // coerced to an array by ajv
            hint: credentials[1].type,
            digestSRI: credentials[1].digestSRI,
          },
          relatedResource[1],
          relatedResource[2],
        ],
        exchangeId,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        issuer: {
          id: tenant.did,
        },
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });

      expect(offerFromDb).toEqual(
        mongoify({
          ...expectedOffer,
          credentialSubject: {
            ...expectedOffer.credentialSubject,
            type: 'PastEmploymentPosition',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              ...expectedOffer,
              credentialSubject: {
                ...expectedOffer.credentialSubject,
                type: 'PastEmploymentPosition',
              },
            }),
          },
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId,
          issuer: {
            id: tenant.did,
          },
          replaces: [
            {
              ...replaces[0],
              hint: credentials[0].type,
            },
          ],
          relatedResource: [
            {
              ...relatedResource[0],
              type: [relatedResource[0].type], // coerced to an array by ajv
              hint: credentials[1].type,
              digestSRI: credentials[1].digestSRI,
            },
            relatedResource[1],
            relatedResource[2],
          ],
        })
      );
    });

    it('/offers should 200 and adding an openbadge v3', async () => {
      const payload = await newVendorOffer({
        tenant,
        exchange,
        ...openBadgeCredentialExample,
      });

      nockRegistrarAppSchemaName({
        schemaName: 'open-badge-credential',
        credentialType: 'OpenBadgeCredential',
        responseJson: require('../combined/schemas/open-badge-credential.schema.json'),
        repeatCount: 1,
      });

      nock('https://imsglobal.org')
        .get('/schemas/open-badge-v3.0-schema.json')
        .reply(
          200,
          require('../combined/schemas/open-badge-credential.schema.json')
        );

      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...payload,
        credentialSubject: {
          ...payload.credentialSubject,
          type: 'AchievementSubject',
        },
        exchangeId,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        issuer: {
          id: tenant.did,
        },
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
    });

    it('/offers should 200 when credential id is a did but is not found in the offers collection', async () => {
      const resourceReference = {
        replaces: [
          {
            id: 'did:velocity:none',
            type: ['VC'],
          },
        ],
        relatedResource: [
          {
            id: 'did:velocity:none',
            type: ['VC'],
          },
        ],
      };

      await nockRegistrarAppSchemaName({
        schemaName: 'past-employment-position',
        credentialType: 'PastEmploymentPosition',
        responseJson: require('../combined/schemas/past-employment-position.schema.json'),
      });
      await persistOffer({
        tenant,
        consentedAt: new Date(),
        did: 'did:velocity:another',
      });
      const expectedOffer = await newVendorOffer({
        tenant,
        exchange,
        ...resourceReference,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: expectedOffer,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...expectedOffer,
        credentialSubject: {
          ...expectedOffer.credentialSubject,
          type: 'PastEmploymentPosition',
        },
        exchangeId,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        issuer: {
          id: tenant.did,
        },
        ...resourceReference,
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });

      expect(offerFromDb).toEqual(
        mongoify({
          ...expectedOffer,
          credentialSubject: {
            ...expectedOffer.credentialSubject,
            type: 'PastEmploymentPosition',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              ...expectedOffer,
              credentialSubject: {
                ...expectedOffer.credentialSubject,
                type: 'PastEmploymentPosition',
              },
            }),
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId,
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          issuer: {
            id: tenant.did,
          },
          ...resourceReference,
        })
      );
    });

    it('Ad/offers should 200 when the id is a URL and therefore can not be found in the offers collection', async () => {
      const resourceReference = {
        replaces: [
          {
            id: 'https://example.com/pdf',
          },
        ],
        relatedResource: [
          {
            id: 'https://example.com/pdf',
          },
        ],
      };

      await nockRegistrarAppSchemaName({
        schemaName: 'past-employment-position',
        credentialType: 'PastEmploymentPosition',
        responseJson: require('../combined/schemas/past-employment-position.schema.json'),
      });
      await persistOffer({
        tenant,
        consentedAt: new Date(),
        did: 'did:velocity:another',
      });
      const expectedOffer = await newVendorOffer({
        tenant,
        exchange,
        ...resourceReference,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: expectedOffer,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...expectedOffer,
        credentialSubject: {
          ...expectedOffer.credentialSubject,
          type: 'PastEmploymentPosition',
        },
        exchangeId,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        issuer: {
          id: tenant.did,
        },
        ...resourceReference,
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });

      expect(offerFromDb).toEqual(
        mongoify({
          ...expectedOffer,
          credentialSubject: {
            ...expectedOffer.credentialSubject,
            type: 'PastEmploymentPosition',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              ...expectedOffer,
              credentialSubject: {
                ...expectedOffer.credentialSubject,
                type: 'PastEmploymentPosition',
              },
            }),
          },
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId,
          ...resourceReference,
          issuer: {
            id: tenant.did,
          },
        })
      );
    });

    it('/offers should 200 when only one relatedResource is set but is missing targetDid', async () => {
      const targetDid = 'did:velocity:0x1234567890abcdef';
      await nockRegistrarAppSchemaName({
        schemaName: 'past-employment-position',
        credentialType: 'PastEmploymentPosition',
        responseJson: require('../combined/schemas/past-employment-position.schema.json'),
      });
      const expectedOffer = await newVendorOffer({
        tenant,
        exchange,
        relatedResource: [
          {
            id: targetDid,
            type: ['VC'],
          },
        ],
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: expectedOffer,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...expectedOffer,
        credentialSubject: {
          ...expectedOffer.credentialSubject,
          type: 'PastEmploymentPosition',
        },
        exchangeId,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        issuer: {
          id: tenant.did,
        },
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });

      expect(offerFromDb).toEqual(
        mongoify({
          ...expectedOffer,
          credentialSubject: {
            ...expectedOffer.credentialSubject,
            type: 'PastEmploymentPosition',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              ...expectedOffer,
              credentialSubject: {
                ...expectedOffer.credentialSubject,
                type: 'PastEmploymentPosition',
              },
            }),
          },
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId,
          issuer: {
            id: tenant.did,
          },
        })
      );
    });

    it('/offers should 200 and have an ObjectId _id on created offer 2', async () => {
      await nockRegistrarAppSchemaName({
        schemaName: 'past-employment-position',
        credentialType: 'PastEmploymentPosition',
        responseJson: require('../combined/schemas/past-employment-position.schema.json'),
      });

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: {
          ...offer,
          _id: '222222220dcddc00099735ba',
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...offer,
        credentialSubject: {
          ...offer.credentialSubject,
          type: 'PastEmploymentPosition',
        },
        exchangeId,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        issuer: {
          id: tenant.did,
        },
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });

      expect(offerFromDb).toEqual(
        mongoify({
          ...offer,
          credentialSubject: {
            ...offer.credentialSubject,
            type: 'PastEmploymentPosition',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              credentialSubject: {
                ...offer.credentialSubject,
                type: 'PastEmploymentPosition',
              },
            }),
          },
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId,
          issuer: {
            id: tenant.did,
          },
        })
      );
    });

    it('/offers should 200 and have issuer name and image on created offer', async () => {
      await nockRegistrarAppSchemaName({
        schemaName: 'past-employment-position',
        credentialType: 'PastEmploymentPosition',
        responseJson: require('../combined/schemas/past-employment-position.schema.json'),
      });

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: {
          ...offer,
          issuer: {
            id: tenant.did,
            name: 'image',
            image: 'http://image.com',
          },
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...offer,
        credentialSubject: {
          ...offer.credentialSubject,
          type: 'PastEmploymentPosition',
        },
        exchangeId,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        issuer: {
          id: tenant.did,
          name: 'image',
          image: 'http://image.com',
        },
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });

      expect(offerFromDb).toEqual(
        mongoify({
          ...offer,
          credentialSubject: {
            ...offer.credentialSubject,
            type: 'PastEmploymentPosition',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              ...offer,
              credentialSubject: {
                ...offer.credentialSubject,
                type: 'PastEmploymentPosition',
              },
            }),
          },
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId,
          issuer: {
            id: tenant.did,
            name: 'image',
            image: 'http://image.com',
          },
        })
      );
    });

    it('/offers should 200 and have issuer with additional property in the issuer', async () => {
      await nockRegistrarAppSchemaName({
        schemaName: 'past-employment-position',
        credentialType: 'PastEmploymentPosition',
        responseJson: require('../combined/schemas/past-employment-position.schema.json'),
      });

      const offer = await newVendorOffer({ tenant, exchange });
      const issuer = {
        id: tenant.did,
        name: 'image',
        image: 'http://image.com',
        additionalProperty: 'additionalProperty',
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: { ...offer, issuer },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...offer,
        credentialSubject: {
          ...offer.credentialSubject,
          type: 'PastEmploymentPosition',
        },
        exchangeId,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        issuer,
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: new ObjectId(disclosure._id),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });

      expect(offerFromDb).toEqual(
        mongoify({
          ...offer,
          credentialSubject: {
            ...offer.credentialSubject,
            type: 'PastEmploymentPosition',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              ...offer,
              credentialSubject: {
                ...offer.credentialSubject,
                type: 'PastEmploymentPosition',
              },
            }),
          },
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId,
          issuer,
        })
      );
    });

    it('/offers should 200 and add default type to credential subject', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enableOfferValidation: true,
      });
      ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
      ({ newOffer, persistOffer } = initOfferFactory(fastify));
      ({ persistTenant } = initTenantFactory(fastify));
      ({ persistVendorUserIdMapping } = initUserFactory(fastify));
      offerCollection = mongoDb().collection('offers');
      exchangeCollection = mongoDb().collection('exchanges');

      const getSchemaNock = nockRegistrarAppSchemaName();

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: { ...offer, _id: 'mock' },
      });

      expect(response.statusCode).toEqual(200);
      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });

      expect(offerFromDb).toEqual(
        mongoify({
          ...offer,
          credentialSubject: {
            ...offer.credentialSubject,
            type: 'PastEmploymentPosition',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              ...offer,
              credentialSubject: {
                ...offer.credentialSubject,
                type: 'PastEmploymentPosition',
              },
            }),
          },
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          issuer: {
            id: tenant.did,
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId,
        })
      );

      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/offers should 200 and pass validation with open badge credential schema', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enableOfferValidation: true,
      });
      ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
      ({ newOffer, persistOffer } = initOfferFactory(fastify));
      ({ persistTenant } = initTenantFactory(fastify));
      ({ persistVendorUserIdMapping } = initUserFactory(fastify));
      offerCollection = mongoDb().collection('offers');
      exchangeCollection = mongoDb().collection('exchanges');

      const getSchemaNock = nockRegistrarAppSchemaName({
        schemaName: 'open-badge-credential',
        credentialType: 'OpenBadgeCredential',
        responseJson: require('../combined/schemas/open-badge-credential.schema.json'),
      });

      const offer = await newVendorOffer({
        tenant,
        exchange,
        type: ['OpenBadgeCredential'],
        credentialSubject: {
          vendorUserId: '1234765',
          achievement: {
            type: 'Achievement',
            id: 'https://velocitynetwork.foundation/credentials/openbadgecredential-5',
            name: 'Our Wallet Passed JFF Plugfest #1 2022',
            description: 'This wallet can display this Open Badge 3.0',
            criteria: {
              narrative:
                'The first cohort of the JFF Plugfest 1 in May/June of 2021 collaborated to push interoperability of VCs in education forward.',
            },
            image: {
              id: 'https://w3c-ccg.github.io/vc-ed/plugfest-1-2022/images/plugfest-1-badge-image.png',
              type: 'Image',
            },
          },
        },
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: { ...offer, _id: 'mock' },
      });

      expect(response.statusCode).toEqual(200);
      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });

      expect(offerFromDb).toEqual(
        mongoify({
          ...offer,
          credentialSubject: {
            ...offer.credentialSubject,
            type: 'AchievementSubject',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              ...offer,
              credentialSubject: {
                ...offer.credentialSubject,
                type: 'AchievementSubject',
              },
            }),
          },
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          issuer: {
            id: tenant.did,
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId,
        })
      );

      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/offers should 200 and get schema from libapp with version', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enableOfferValidation: true,
      });
      ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
      ({ newOffer, persistOffer } = initOfferFactory(fastify));
      ({ persistTenant } = initTenantFactory(fastify));
      ({ persistVendorUserIdMapping } = initUserFactory(fastify));
      offerCollection = mongoDb().collection('offers');
      exchangeCollection = mongoDb().collection('exchanges');

      const getSchemaNock = nockRegistrarAppSchemaName({
        schemaName: 'employment-current-v1.1',
        credentialType: 'EmploymentCurrentV1.1',
        responseJson: require('../combined/schemas/employment-current-v1.1.schema.json'),
      });

      const offer = await newVendorOffer({
        tenant,
        exchange,
        type: ['EmploymentCurrentV1.1'],
        // linkedCredentials: [{ linkType: 'REPLACE', linkedCredentialId: '' }],
        credentialSubject: {
          vendorUserId: 'olivia.hafez@example.com',
          '@context': 'https://velocitynetwork.foundation/contexts/employment',
          legalEmployer: {
            name: 'Microsoft Corporation ion',
            identifier:
              'did:ion:EiAbP9xvCYnUOiLwqgbkV4auH_26Pv7BT2pYYT3masvvhw',
            place: {
              addressLocality: 'Bellevue',
              addressRegion: 'US-WA',
              addressCountry: 'US',
            },
          },
          role: 'Project Manager (current)',
          description: 'Backend development project management',
          employmentType: ['permanent'],
          place: {
            name: 'Media Lab',
            addressLocality: 'Buffalo',
            addressRegion: 'US-NY',
            addressCountry: 'US',
          },
          startDate: '2013-10-01',
          recipient: {
            givenName: 'Olivia',
            familyName: 'Hafez',
            middleName: 'Melanie',
            namePrefix: 'Dr.',
            nameSuffix: 'Mrs.',
          },
          alignment: [
            {
              targetName: 'Test Name',
              targetUrl:
                'https://credentialfinder.org/credential/5769/Bachelor_of_Science_in_Nursing_RN_to_BSN',
              targetFramework: 'Test Framework',
            },
          ],
        },
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: { ...offer, _id: 'mock' },
      });

      expect(response.statusCode).toEqual(200);
      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });
      expect(offerFromDb).toEqual(
        mongoify({
          ...offer,
          credentialSubject: {
            ...offer.credentialSubject,
            employmentType: ['permanent'],
            alignment: [
              {
                targetFramework: 'Test Framework',
                targetName: 'Test Name',
                targetUrl:
                  'https://credentialfinder.org/credential/5769/Bachelor_of_Science_in_Nursing_RN_to_BSN',
                type: 'AlignmentObject',
              },
            ],
            legalEmployer: {
              ...offer.credentialSubject.legalEmployer,
              place: {
                ...offer.credentialSubject.legalEmployer.place,
                type: 'Place',
              },
              type: 'Organization',
            },
            place: {
              ...offer.credentialSubject.place,
              type: 'Place',
            },
            recipient: {
              ...offer.credentialSubject.recipient,
              type: 'PersonName',
            },
            type: 'Employment',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              ...offer,
              credentialSubject: {
                ...offer.credentialSubject,
                employmentType: ['permanent'],
                alignment: [
                  {
                    targetFramework: 'Test Framework',
                    targetName: 'Test Name',
                    targetUrl:
                      'https://credentialfinder.org/credential/5769/Bachelor_of_Science_in_Nursing_RN_to_BSN',
                    type: 'AlignmentObject',
                  },
                ],
                legalEmployer: {
                  ...offer.credentialSubject.legalEmployer,
                  place: {
                    ...offer.credentialSubject.legalEmployer.place,
                    type: 'Place',
                  },
                  type: 'Organization',
                },
                place: {
                  ...offer.credentialSubject.place,
                  type: 'Place',
                },
                recipient: {
                  ...offer.credentialSubject.recipient,
                  type: 'PersonName',
                },
                type: 'Employment',
              },
            }),
          },
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          issuer: {
            id: tenant.did,
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId,
        })
      );

      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/offers should 200 when invalid offer when enableOfferValidation is false', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enableOfferValidation: false,
      });

      const getSchemaNock = nockRegistrarAppSchemaName();

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: {
          _id: 'nonsense',
          ...omit(['credentialSubject.startMonthYear'], offer),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/offers should 200 and add commercial entity info', async () => {
      await nockRegistrarAppSchemaName({
        schemaName: 'past-employment-position',
        credentialType: 'PastEmploymentPosition',
        responseJson: require('../combined/schemas/past-employment-position.schema.json'),
      });

      disclosure = await persistDisclosure({
        tenant,
        commercialEntityName: 'name',
        commercialEntityLogo: 'logo',
      });
      exchange = await persistOfferExchange({ tenant, disclosure });
      exchangeId = exchange._id.toString();

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: {
          ...offer,
          issuer: {
            name: 'name',
            image: 'logo',
          },
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...offer,
        credentialSubject: {
          ...offer.credentialSubject,
          type: 'PastEmploymentPosition',
        },
        exchangeId: exchange._id.toString(),
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        issuer: {
          id: tenant.did,
          name: 'name',
          image: 'logo',
        },
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const offerFromDb = await offerCollection.findOne({
        _id: new ObjectId(response.json.id),
      });

      expect(offerFromDb).toEqual(
        mongoify({
          ...offer,
          credentialSubject: {
            ...offer.credentialSubject,
            type: 'PastEmploymentPosition',
          },
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          contentHash: {
            type: 'VelocityContentHash2020',
            value: hashOffer({
              ...offer,
              credentialSubject: {
                ...offer.credentialSubject,
                type: 'PastEmploymentPosition',
              },
            }),
          },
          linkCode: expect.any(String),
          linkCodeCommitment: {
            type: 'VelocityCredentialLinkCodeCommitment2022',
            value: expect.any(String),
          },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          exchangeId: exchange._id.toString(),
          issuer: {
            id: tenant.did,
            name: 'name',
            image: 'logo',
          },
        })
      );
    });

    it('/offers should 400 offer has part of commercial entity info', async () => {
      await nockRegistrarAppSchemaName({
        schemaName: 'past-employment-position',
        credentialType: 'PastEmploymentPosition',
        responseJson: require('../combined/schemas/past-employment-position.schema.json'),
      });

      disclosure = await persistDisclosure({
        tenant,
        commercialEntityName: 'name',
        commercialEntityLogo: 'logo',
      });
      exchange = await persistOfferExchange({ tenant, disclosure });
      exchangeId = exchange._id.toString();

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: {
          ...offer,
          issuer: {
            image: 'logo',
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'invalid_commercial_entity',
          message: 'Invalid commercial entity',
          statusCode: 400,
        })
      );
    });

    it('/offers should return 400 when offer doesnt match schema', async () => {
      const getSchemaNock = nockRegistrarAppSchemaName({
        responseJson: require('../combined/schemas/past-employment-position-with-uri-id.schema'),
      });

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: {
          _id: 'nonsense',
          ...omit(['credentialSubject.startMonthYear'], offer),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message:
            "'$.credentialSubject' must have required property 'startMonthYear'",
          statusCode: 400,
        })
      );
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/offers should 502 when offer schema is not resolvable', async () => {
      const getSchemaNock = nockRegistrarAppSchemaName({ statusCode: 404 });

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: {
          _id: 'nonsense',
          ...omit(['credentialSubject.startMonthYear'], offer),
        },
      });

      expect(response.statusCode).toEqual(502);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 502,
          error: 'Bad Gateway',
          errorCode: 'missing_error_code',
          message:
            'failed to resolve http://mock.com/schemas/past-employment-position',
        })
      );
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/offers should 502 when offer schema is missing an id', async () => {
      const getSchemaNock = nockRegistrarAppSchemaName({
        responseJson: omit(
          ['$id'],
          require('../combined/schemas/past-employment-position-with-uri-id.schema')
        ),
      });

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: {
          _id: 'nonsense',
          ...omit(['credentialSubject.startMonthYear'], offer),
        },
      });

      expect(response.statusCode).toEqual(502);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 502,
          error: 'Bad Gateway',
          errorCode: 'missing_error_code',
          message:
            'http://mock.com/schemas/past-employment-position $id field missing',
        })
      );
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/offers should return 400 when offer credentialType is not recognized', async () => {
      const getCredentialTypesNock = nock('http://oracle.localhost.test')
        .get('/api/v0.6/credential-types')
        .query({ credentialType: 'PastEmploymentPosition' })
        .reply(200, []);

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: {
          _id: 'nonsense',
          ...omit(['credentialSubject.startMonthYear'], offer),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'PastEmploymentPosition is not a recognized credential type',
        })
      );
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      expect(getCredentialTypesNock.isDone()).toEqual(true);
    });

    it('/offers should return 502 if registrar has non 404 error ', async () => {
      const getSchemaNock = nockRegistrarAppSchemaName({ statusCode: 400 });

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: {
          _id: 'nonsense',
          ...omit(['credentialSubject.startMonthYear'], offer),
        },
      });

      expect(response.statusCode).toEqual(502);
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/offers should return 422 a duplicate offer is sent', async () => {
      await nockRegistrarAppSchemaName({
        schemaName: 'past-employment-position',
        credentialType: 'PastEmploymentPosition',
        responseJson: require('../combined/schemas/past-employment-position.schema.json'),
      });

      const offer = flow(
        set('credentialSubject.vendorUserId', user.vendorUserId)
      )(await newVendorOffer());
      const offerHash = hashOffer({
        ...offer,
        credentialSubject: {
          ...offer.credentialSubject,
          type: 'PastEmploymentPosition',
        },
      });

      await exchangeCollection.updateOne(
        { _id: new ObjectId(exchangeId) },
        { $set: { offerHashes: [offerHash] } }
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: offer,
      });

      expect(response.statusCode).toEqual(422);
    });

    it('/offers should return 400 when credentialSubject.vendorUserId is missing', async () => {
      const offer = omit(
        ['credentialSubject.vendorUserId'],
        await newVendorOffer()
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: offer,
      });

      expect(response.statusCode).toEqual(400);
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          disclosureId: disclosure._id.toString(),
          events: [
            { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
            {
              state: ExchangeStates.OFFER_VALIDATION_ERROR,
              timestamp: expect.any(Date),
            },
          ],
          offerHashes: [],
          ...credentialTypesObject,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('/offers should return 400 when expirationDate and validUntil are set', async () => {
      const offer = await newOffer();
      const extendedOffer = flow(
        omit(['isDuplicate', 'contentHash', 'exchangeId']),
        set('credentialSubject.vendorUserId', user.vendorUserId),
        set('expirationDate', new Date()),
        set('validUntil', new Date())
      )(offer);
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: extendedOffer,
      });

      expect(response.statusCode).toEqual(400);
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('/offers should throw a 404 error when exchangeId not found', async () => {
      const offer = await newOffer();
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl(
          { tenant, exchange: { id: 'some_exchange_id' } },
          ''
        ),
        payload: {
          ...set('credentialSubject.vendorUserId', user.vendorUserId, offer),
        },
      });

      expect(response.statusCode).toEqual(404);
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('/offers should throw a 404 error wrong tenantId in url', async () => {
      const offer = await newOffer();
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl(
          { tenant: { _id: new ObjectId() }, exchange },
          ''
        ),
        payload: set(
          'credentialSubject.vendorUserId',
          user.vendorUserId,
          offer
        ),
      });

      expect(response.statusCode).toEqual(404);
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('/offers throw 400 if commercial entity does not match', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enableOfferValidation: false,
      });

      disclosure = await persistDisclosure({
        tenant,
        commercialEntityName: 'name',
        commercialEntityLogo: 'logo',
      });
      exchange = await persistOfferExchange({ tenant, disclosure });
      exchangeId = exchange._id.toString();

      const offer = await newVendorOffer({ tenant, exchange });
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, ''),
        payload: {
          ...offer,
          issuer: {
            name: 'wrong name',
            image: 'http://wrong.com',
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'invalid_commercial_entity',
          message: 'Invalid commercial entity',
          statusCode: 400,
        })
      );
    });
  });

  describe('/offers/complete', () => {
    it('should throw a 404 error when exchangeId is badly formatted', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl(
          { tenant, exchange: { id: 'EXCHANGE-ID' } },
          'complete'
        ),
        payload: {
          purpose: ['push'],
        },
      });

      expect(response.statusCode).toEqual(404);
    });

    it('should throw a 404 error when exchangeId not found', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl(
          { tenant, exchange: { id: new ObjectId() } },
          'complete'
        ),
        payload: {
          purpose: ['push'],
        },
      });

      expect(response.statusCode).toEqual(404);
    });

    it('/offers/complete should return 404 when org not found', async () => {
      nock.cleanAll();
      nockRegistrarGetOrganizationDidDoc(tenant.did, {});
      nock(testPushEndpointURL.origin)
        .post(testPushEndpointURL.pathname)
        .reply(204, null);
      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange: pushExchange }, 'complete'),
        payload: {},
      });

      expect(response.statusCode).toEqual(404);
    });

    it('/offers/complete 200 with offers and push notification', async () => {
      nockRegistrarGetOrganizationDidDoc(
        intermediateIssuer.id,
        intermediateIssuer
      );
      let parsedBody;
      const nockedPushEndpoint = nock(testPushEndpointURL.origin)
        .post(testPushEndpointURL.pathname, (body) => {
          parsedBody = body;
          return body;
        })
        .reply(204, null);

      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange: pushExchange }, 'complete'),
        payload: {},
      });
      expect(nockedPushEndpoint.isDone()).toEqual(true);
      expect(parsedBody).toEqual({
        data: {
          exchangeId: pushExchange._id,
          issuer: tenant.did,
          notificationType: 'NewOffersReady',
          serviceEndpoint: testPushEndpointURL.href,
          count: 1,
          ...credentialTypesObject,
        },
        id: expect.stringMatching(NANO_ID_FORMAT),
        pushToken: 'some-token',
      });

      expect(response.statusCode).toEqual(200);

      expect(response.json).toEqual({
        offerIds: expect.arrayContaining(map('_id', pushExchangeOffers)),
        pushSentAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(pushExchange._id),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(pushExchange._id),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          pushDelegate: {
            pushUrl: testPushEndpointURL.href,
            pushToken: 'some-token',
          },
          pushSentAt: expect.any(Date),
          events: [
            { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
            {
              state: ExchangeStates.OFFERS_RECEIVED,
              timestamp: expect.any(Date),
            },
          ],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('/offers/complete 200 with no offers and push notification', async () => {
      nockRegistrarGetOrganizationDidDoc(
        intermediateIssuer.id,
        intermediateIssuer
      );
      let parsedBody;

      const nockedPushEndpoint = nock(testPushEndpointURL.origin)
        .post(testPushEndpointURL.pathname, (body) => {
          parsedBody = body;
          return body;
        })
        .reply(204, null);
      const receivedEmptyExchange = await persistOfferExchange({
        tenant,
        disclosure,
        pushDelegate: {
          pushToken: 'some-token',
          pushUrl: testPushEndpointURL.href,
        },
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl(
          { tenant, exchange: receivedEmptyExchange },
          'complete'
        ),
        payload: {},
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        pushSentAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(nockedPushEndpoint.isDone()).toEqual(true);
      expect(parsedBody).toEqual({
        data: {
          exchangeId: receivedEmptyExchange._id,
          issuer: tenant.did,
          notificationType: NotificationTypes.NO_OFFERS_FOUND,
          serviceEndpoint: testPushEndpointURL.href,
        },
        id: expect.stringMatching(NANO_ID_FORMAT),
        pushToken: 'some-token',
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(receivedEmptyExchange._id),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(receivedEmptyExchange._id),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          pushDelegate: {
            pushUrl: testPushEndpointURL.href,
            pushToken: 'some-token',
          },
          pushSentAt: expect.any(Date),
          events: [
            { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
            {
              state: ExchangeStates.NO_OFFERS_RECEIVED,
              timestamp: expect.any(Date),
            },
            {
              state: ExchangeStates.COMPLETE,
              timestamp: expect.any(Date),
            },
          ],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('/offers/complete should not fail if push failed', async () => {
      nockRegistrarGetOrganizationDidDoc(
        intermediateIssuer.id,
        intermediateIssuer
      );
      let parsedBody;

      const nockedPushEndpoint = nock(testPushEndpointURL.origin)
        .post(testPushEndpointURL.pathname, (body) => {
          parsedBody = body;
          return body;
        })
        .replyWithError('some error');
      const receivedEmptyExchange = await persistOfferExchange({
        tenant,
        disclosure,
        pushDelegate: {
          pushToken: 'some-token',
          pushUrl: testPushEndpointURL.href,
        },
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl(
          { tenant, exchange: receivedEmptyExchange },
          'complete'
        ),
        payload: {},
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        pushSentAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(nockedPushEndpoint.isDone()).toEqual(true);
      expect(parsedBody).toEqual({
        data: {
          exchangeId: receivedEmptyExchange._id,
          issuer: tenant.did,
          notificationType: NotificationTypes.NO_OFFERS_FOUND,
          serviceEndpoint: testPushEndpointURL.href,
        },
        id: expect.stringMatching(NANO_ID_FORMAT),
        pushToken: 'some-token',
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(receivedEmptyExchange._id),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(receivedEmptyExchange._id),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          pushDelegate: {
            pushUrl: testPushEndpointURL.href,
            pushToken: 'some-token',
          },
          pushSentAt: expect.any(Date),
          disclosureId: disclosure._id.toString(),
          events: [
            { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
            {
              state: ExchangeStates.NO_OFFERS_RECEIVED,
              timestamp: expect.any(Date),
            },
            {
              state: ExchangeStates.COMPLETE,
              timestamp: expect.any(Date),
            },
          ],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('/offers/complete should not fail if push failed', async () => {
      nockRegistrarGetOrganizationDidDoc(
        intermediateIssuer.id,
        intermediateIssuer
      );
      let parsedBody;

      const nockedPushEndpoint = nock(testPushEndpointURL.origin)
        .post(testPushEndpointURL.pathname, (body) => {
          parsedBody = body;
          return body;
        })
        .replyWithError('some error');
      const receivedEmptyExchange = await persistOfferExchange({
        tenant,
        disclosure,
        pushDelegate: {
          pushToken: 'some-token',
          pushUrl: testPushEndpointURL.href,
        },
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl(
          { tenant, exchange: receivedEmptyExchange },
          'complete'
        ),
        payload: {},
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        pushSentAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(nockedPushEndpoint.isDone()).toEqual(true);
      expect(parsedBody).toEqual({
        data: {
          exchangeId: receivedEmptyExchange._id,
          issuer: tenant.did,
          notificationType: NotificationTypes.NO_OFFERS_FOUND,
          serviceEndpoint: testPushEndpointURL.href,
        },
        id: expect.stringMatching(NANO_ID_FORMAT),
        pushToken: 'some-token',
      });
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(receivedEmptyExchange._id),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(receivedEmptyExchange._id),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          pushDelegate: {
            pushUrl: testPushEndpointURL.href,
            pushToken: 'some-token',
          },
          pushSentAt: expect.any(Date),
          events: [
            { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
            {
              state: ExchangeStates.NO_OFFERS_RECEIVED,
              timestamp: expect.any(Date),
            },
            {
              state: ExchangeStates.COMPLETE,
              timestamp: expect.any(Date),
            },
          ],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('/offers/complete 200 with offers and no push notification', async () => {
      let parsedBody;
      const nockedPushEndpoint = nock(testPushEndpointURL.origin)
        .post(testPushEndpointURL.pathname, (body) => {
          parsedBody = body;
          return body;
        })
        .reply(204, null);

      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl({ tenant, exchange }, 'complete'),
        payload: {},
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offerIds: expect.arrayContaining(map('_id', exchangeOffers)),
      });
      expect(nockedPushEndpoint.isDone()).toEqual(false);
      expect(parsedBody).toBeUndefined();
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(exchangeId),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(exchangeId),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [
            { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
            {
              state: ExchangeStates.OFFERS_RECEIVED,
              timestamp: expect.any(Date),
            },
          ],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('/offers/complete 200 with no offers and no push notification due to missing pushDelegate.pushUrl', async () => {
      nockRegistrarGetOrganizationDidDoc(
        intermediateIssuer.id,
        intermediateIssuer
      );
      let parsedBody;

      const nockedPushEndpoint = nock(testPushEndpointURL.origin)
        .post(testPushEndpointURL.pathname, (body) => {
          parsedBody = body;
          return body;
        })
        .reply(204, null);
      const receivedEmptyExchange = await persistOfferExchange({
        tenant,
        disclosure,
        pushDelegate: {
          pushToken: 'some-token',
        },
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl(
          { tenant, exchange: receivedEmptyExchange },
          'complete'
        ),
        payload: {},
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({});
      expect(nockedPushEndpoint.isDone()).toEqual(false);
      expect(parsedBody).toBeUndefined();
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(receivedEmptyExchange._id),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(receivedEmptyExchange._id),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          pushDelegate: {
            pushToken: 'some-token',
          },
          events: [
            { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
            {
              state: ExchangeStates.NO_OFFERS_RECEIVED,
              timestamp: expect.any(Date),
            },
            {
              state: ExchangeStates.COMPLETE,
              timestamp: expect.any(Date),
            },
          ],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('/offers/complete 200 with no offers and no push notification due to missing pushDelegate', async () => {
      nockRegistrarGetOrganizationDidDoc(
        intermediateIssuer.id,
        intermediateIssuer
      );
      let parsedBody;

      const nockedPushEndpoint = nock(testPushEndpointURL.origin)
        .post(testPushEndpointURL.pathname, (body) => {
          parsedBody = body;
          return body;
        })
        .reply(204, null);
      const receivedEmptyExchange = await persistOfferExchange({
        tenant,
        disclosure,
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: exchangeOffersUrl(
          { tenant, exchange: receivedEmptyExchange },
          'complete'
        ),
        payload: {},
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({});
      expect(nockedPushEndpoint.isDone()).toEqual(false);
      expect(parsedBody).toBeUndefined();
      expect(
        await exchangeCollection.findOne({
          _id: new ObjectId(receivedEmptyExchange._id),
        })
      ).toEqual(
        mongoify({
          _id: new ObjectId(receivedEmptyExchange._id),
          type: ExchangeTypes.ISSUING,
          tenantId: new ObjectId(tenant._id),
          disclosureId: disclosure._id.toString(),
          events: [
            { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
            {
              state: ExchangeStates.NO_OFFERS_RECEIVED,
              timestamp: expect.any(Date),
            },
            {
              state: ExchangeStates.COMPLETE,
              timestamp: expect.any(Date),
            },
          ],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });
  });

  describe('Retrieving URIs', () => {
    let receivedExchange;
    beforeEach(async () => {
      receivedExchange = await persistOfferExchange({
        tenant,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.OFFERS_RECEIVED,
            timestamp: new Date(),
          },
        ],
      });
      await Promise.all([persistOffer({ tenant, exchange: receivedExchange })]);
    });

    describe('Retrieving URIs as strings', () => {
      it('should 404 for an unknown exchange', async () => {
        const response = await fastify.inject({
          method: 'GET',
          url: exchangesUrl(
            { tenant, exchange: { _id: 'EXCHANGE_ID' } },
            'qrcode.uri'
          ),
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(404);
      });
      it('should 400 if an exchange is incomplete', async () => {
        const response = await fastify.inject({
          method: 'GET',
          url: exchangesUrl({ tenant, exchange }, 'qrcode.uri'),
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
      });
      it('should return a URI representing an exchange with a single offer', async () => {
        const response = await fastify.inject({
          method: 'GET',
          url: exchangesUrl(
            { tenant, exchange: receivedExchange },
            'qrcode.uri'
          ),
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.body).toEqual(
          `velocity-test://issue?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${encodeURIComponent(
            tenant.did
          )}%2Fissue%2Fget-credential-manifest%3Fexchange_id%3D${
            receivedExchange._id
          }%26credential_types%3DPastEmploymentPosition&issuerDid=${tenant.did.replace(
            /:/g,
            '%3A'
          )}`
        );
      });

      it('should return a URI representing an exchange with a single offer & vendorOriginContext', async () => {
        const response = await fastify.inject({
          method: 'GET',
          url: exchangesUrl(
            { tenant, exchange: receivedExchange },
            'qrcode.uri?vendorOriginContext=123'
          ),
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.body).toEqual(
          `velocity-test://issue?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${encodeURIComponent(
            tenant.did
          )}%2Fissue%2Fget-credential-manifest%3Fexchange_id%3D${
            receivedExchange._id
          }%26credential_types%3DPastEmploymentPosition&issuerDid=${tenant.did.replace(
            /:/g,
            '%3A'
          )}&vendorOriginContext=123`
        );
      });

      it('should return a URI representing an exchange with multiple offers with different types', async () => {
        await persistOffer({
          tenant,
          exchange: receivedExchange,
          type: ['CurrentEmploymentPosition'],
        });

        const response = await fastify.inject({
          method: 'GET',
          url: exchangesUrl(
            { tenant, exchange: receivedExchange },
            'qrcode.uri'
          ),
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.body).toEqual(
          `velocity-test://issue?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${encodeURIComponent(
            tenant.did
          )}%2Fissue%2Fget-credential-manifest%3Fexchange_id%3D${
            receivedExchange._id
          }%26credential_types%3DCurrentEmploymentPosition%26credential_types%3DPastEmploymentPosition&issuerDid=${tenant.did.replace(
            /:/g,
            '%3A'
          )}`
        );
      });
      it('should return a URI representing an exchange with multiple offers with the same types', async () => {
        await persistOffer({
          tenant,
          exchange: receivedExchange,
        });

        const response = await fastify.inject({
          method: 'GET',
          url: exchangesUrl(
            { tenant, exchange: receivedExchange },
            'qrcode.uri'
          ),
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.body).toEqual(
          `velocity-test://issue?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${encodeURIComponent(
            tenant.did
          )}%2Fissue%2Fget-credential-manifest%3Fexchange_id%3D${
            receivedExchange._id
          }%26credential_types%3DPastEmploymentPosition&issuerDid=${tenant.did.replace(
            /:/g,
            '%3A'
          )}`
        );
      });
    });
    describe('Retrieving URIs as QR code pngs', () => {
      it('should return a QR code representing the exchange', async () => {
        const response = await fastify.inject({
          method: 'GET',
          url: exchangesUrl(
            { tenant, exchange: receivedExchange },
            'qrcode.png'
          ),
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.headers['content-type']).toEqual('image/png');
        expect(response.statusCode).toEqual(200);
        expect(response.body.length).toBeGreaterThan(100);
      });
    });
  });

  describe('/offers/clean_pii test suite', () => {
    const cleanPiiUrl = (_tenant) =>
      `/operator-api/v0.8/tenants/${_tenant._id}/offers/clean_pii`;

    let customTenant1;
    let customTenant2;
    let customDisclosure;
    let customExchange;
    let customUser;
    let oldestOffer;
    let offer1;
    let offerApproved;
    let offerRejected;
    let offerWithCustomUser;
    let offerWithCustomDisclosure;

    beforeEach(async () => {
      await offerCollection.deleteMany({});
      customTenant1 = await persistTenant();
      customTenant2 = await persistTenant();

      customDisclosure = await persistDisclosure();
      customExchange = await persistOfferExchange({
        tenant,
        disclosure: customDisclosure,
      });

      customUser = await persistVendorUserIdMapping({
        vendorUserId: 'custom123',
        tenant: customTenant1,
      });

      oldestOffer = await persistOffer({ tenant, exchange });
      [
        offer1,
        offerApproved,
        offerRejected,
        offerWithCustomUser,
        offerWithCustomDisclosure,
      ] = await Promise.all([
        await persistOffer({ tenant, exchange }),
        await persistOffer({ tenant, exchange, consentedAt: new Date() }),
        await persistOffer({ tenant, exchange, rejectedAt: new Date() }),
        await persistOffer({ tenant, exchange, user: customUser }),
        await persistOffer({
          tenant,
          exchange: customExchange,
          user: customUser,
        }),
        await persistOffer({
          tenant: customTenant1,
          exchange,
        }),
        await persistOffer({
          tenant: customTenant2,
          exchange,
        }),
      ]);
    });

    it('should return 200 when no offers to clean', async () => {
      await mongoDb().collection('offers').deleteMany({});
      const response = await fastify.injectJson({
        method: 'POST',
        url: cleanPiiUrl(tenant),
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({ numCleaned: 0 });
    });

    it('should return 200 when offers cleaned', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: cleanPiiUrl(tenant),
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({ numCleaned: 6 });

      const offersDb = await offersRepo
        .collection()
        .find(
          {
            'issuer.id': tenant.did,
          },
          {
            sort: {
              _id: 1,
            },
          }
        )
        .toArray();
      expect(offersDb).toHaveLength(6);
      for (const offer of offersDb) {
        expect(offer.credentialSubject).toStrictEqual({
          vendorUserId: expect.any(String),
        });
      }
      const othersOffersDb = await offersRepo
        .collection()
        .find(
          {
            'issuer.id': {
              $ne: tenant.did,
            },
          },
          {
            sort: {
              _id: 1,
            },
          }
        )
        .toArray();
      for (const offer of othersOffersDb) {
        expect(offer.credentialSubject).not.toStrictEqual({
          vendorUserId: expect.any(String),
        });
      }
    });

    it('should return 200 and clean pii by vendor user id', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: cleanPiiUrl(tenant),
        payload: {
          filter: {
            vendorUserId: customUser.vendorUserId,
          },
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({ numCleaned: 2 });

      const offersDb = await offersRepo.find();
      expect(offersDb).toHaveLength(6);
      expect(map('credentialSubject', offersDb)).toStrictEqual(
        expect.arrayContaining([
          oldestOffer.credentialSubject,
          offer1.credentialSubject,
          offerApproved.credentialSubject,
          offerRejected.credentialSubject,
          {
            vendorUserId: offerWithCustomUser.credentialSubject.vendorUserId,
          },
          {
            vendorUserId:
              offerWithCustomDisclosure.credentialSubject.vendorUserId,
          },
        ])
      );
    });

    it('should return 200 and clean finalized offers', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: cleanPiiUrl(tenant),
        payload: {
          filter: {
            finalized: true,
          },
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({ numCleaned: 2 });

      const offersDb = await offersRepo.find();
      expect(offersDb).toHaveLength(6);
      expect(map('credentialSubject', offersDb)).toStrictEqual(
        expect.arrayContaining([
          oldestOffer.credentialSubject,
          offer1.credentialSubject,
          offerWithCustomUser.credentialSubject,
          offerWithCustomDisclosure.credentialSubject,
          {
            vendorUserId: offerApproved.credentialSubject.vendorUserId,
          },
          {
            vendorUserId: offerRejected.credentialSubject.vendorUserId,
          },
        ])
      );
    });

    it('should return 200 and clean offers that created before timestamp', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: cleanPiiUrl(tenant),
        payload: {
          filter: {
            createdBefore: oldestOffer.createdAt,
          },
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({ numCleaned: 1 });

      const offersDb = await offersRepo.find();
      expect(offersDb).toHaveLength(6);
      expect(map('credentialSubject', offersDb)).toStrictEqual(
        expect.arrayContaining([
          offerApproved.credentialSubject,
          offer1.credentialSubject,
          offerWithCustomUser.credentialSubject,
          offerWithCustomDisclosure.credentialSubject,
          offerRejected.credentialSubject,
          {
            vendorUserId: oldestOffer.credentialSubject.vendorUserId,
          },
        ])
      );
    });

    it('should return 200 and clean offers for the specified disclosure', async () => {
      const customDisclosure1 = await persistDisclosure();
      const customExchange1 = await persistOfferExchange({
        tenant,
        disclosure: customDisclosure1,
      });
      const customOffer = await persistOffer({
        tenant,
        exchange: customExchange1,
        user: customUser,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: cleanPiiUrl(tenant),
        payload: {
          filter: {
            disclosureId: customDisclosure1._id.toString(),
          },
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({ numCleaned: 1 });

      const offersDb = await offersRepo.find();
      expect(offersDb).toHaveLength(7);
      expect(map('credentialSubject', offersDb)).toStrictEqual(
        expect.arrayContaining([
          oldestOffer.credentialSubject,
          offer1.credentialSubject,
          offerApproved.credentialSubject,
          offerRejected.credentialSubject,
          offerWithCustomUser.credentialSubject,
          offerWithCustomDisclosure.credentialSubject,
          {
            vendorUserId: customOffer.credentialSubject.vendorUserId,
          },
        ])
      );
    });
  });
});
