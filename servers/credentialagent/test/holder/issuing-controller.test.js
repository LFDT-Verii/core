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
const { getUnixTime, subYears, subDays } = require('date-fns/fp');
const { nanoid } = require('nanoid');
const { mapWithIndex, wait } = require('@verii/common-functions');
const { jwtDecode, jwtSign, hexFromJwk, jwkThumbprint } = require('@verii/jwt');
const {
  VnfProtocolVersions,
  VelocityRevocationListType,
} = require('@verii/vc-checks');
const { generateKeyPair: joseGenerateKeyPair, exportJWK } = require('jose');
const { generateDidInfo, getDidUriFromJwk } = require('@verii/did-doc');
const { ObjectId } = require('mongodb');
const {
  castArray,
  compact,
  first,
  isEmpty,
  map,
  omit,
  reverse,
  get,
  set,
  entries,
  uniq,
} = require('lodash/fp');
const nock = require('nock');
const { openBadgeCredentialExample } = require('@verii/sample-data');

const {
  OBJECT_ID_FORMAT,
  ISO_DATETIME_FORMAT,
  BASE64_FORMAT,
} = require('@verii/test-regexes');
const {
  mongoify,
  jsonify,
  errorResponseMatcher,
} = require('@verii/tests-helpers');
const { KeyPurposes, generateKeyPair } = require('@verii/crypto');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { hashOffer } = require('@verii/velocity-issuing');

const {
  nockCredentialTypes,
  credentialTypeMetadata,
} = require('./helpers/credential-type-metadata');
const { nockRegistrarAppSchemaName } = require('../combined/helpers');
const { jwtVcExpectation } = require('./helpers/jwt-vc-expectation');
const initExchangeRepo = require('../../src/entities/exchanges/repos/repo');
const initTenantRepo = require('../../src/entities/tenants/repos/repo');
const initOffersRepo = require('../../src/entities/offers/repos/repo');
const {
  initDisclosureFactory,
  initOfferFactory,
  initTenantFactory,
  initUserFactory,
  initOfferExchangeFactory,
  initGroupsFactory,
  initKeysFactory,
  ExchangeStates,
  ExchangeTypes,
  generateLinkCode,
  exchangeRepoDefaultProjection,
  VendorEndpoint,
} = require('../../src/entities');
const {
  generateTestAccessToken,
} = require('./helpers/generate-test-access-token');

const mockAddCredentialMetadataEntry = jest.fn();
const mockCreateCredentialMetadataList = jest.fn();
const mockAddRevocationListSigned = jest.fn();
const mockLookupPrimary = jest.fn();
const mockInitPermissions = jest.fn();
jest.mock('@verii/metadata-registration', () => ({
  ...jest.requireActual('@verii/metadata-registration'),
  initRevocationRegistry: () => ({
    addRevocationListSigned: mockAddRevocationListSigned,
  }),
  initMetadataRegistry: () => ({
    addCredentialMetadataEntry: mockAddCredentialMetadataEntry,
    createCredentialMetadataList: mockCreateCredentialMetadataList,
  }),
  initVerificationCoupon: () => ({}),
}));

jest.mock('@verii/contract-permissions', () => ({
  initPermissions: () => ({
    lookupPrimary: mockLookupPrimary,
  }),
}));

const mockVendorUrl = 'http://mockvendor.localhost.test';
const requestOffersFromVendorEndpoint = '/issuing/generate-offers';
const acceptedOffersNotificationEndpoint =
  '/issuing/receive-issued-credentials';

const credentialTypesObject = { credentialTypes: ['PastEmploymentPosition'] };

describe('Holder Issuing Test Suite', () => {
  let fastify;
  let newOffer;
  let persistDisclosure;
  let persistOffer;
  let persistOfferExchange;
  let persistVendorUserIdMapping;
  let persistTenant;
  let persistGroup;
  let tenant;
  let disclosure;
  let persistKey;
  let exchange;
  let exchangeId;
  let exchangeRepo;
  let tenantRepo;
  let offersRepo;
  let user;
  let authToken;
  let keyPair;
  let tenantKeyDatum;

  const updateExchangeOffersIds = async (id, offerIds, finalizedOfferIds) => {
    const $set = { offerIds: map((v) => new ObjectId(v), offerIds) };
    if (!isEmpty(finalizedOfferIds)) {
      $set.finalizedOfferIds = map((v) => new ObjectId(v), finalizedOfferIds);
    }
    await exchangeRepo.update(id, $set);
  };

  const genAuthToken = async (tenant1, exchange1, user1 = user) =>
    generateTestAccessToken(
      exchange1._id.toString(),
      tenant1.did,
      user1._id,
      null,
      null,
      '30d',
      null,
      keyPair.privateKey,
      tenantKeyDatum.kidFragment
    );

  beforeAll(async () => {
    fastify = buildFastify({
      storeIssuerAsString: false,
    });
    await fastify.ready();
    ({ persistDisclosure } = initDisclosureFactory(fastify));
    ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
    ({ newOffer, persistOffer } = initOfferFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeysFactory(fastify));
    ({ persistVendorUserIdMapping } = initUserFactory(fastify));
    ({ persistGroup } = initGroupsFactory(fastify));
    keyPair = generateKeyPair({ format: 'jwk' });
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    nock.cleanAll();
    fastify.resetOverrides();
    fastify.removeDocSchema();
    fastify.overrides.reqConfig = (config) => ({
      ...config,
      enableOfferValidation: true,
      validationPluginAjvOptions: {
        allErrors: true,
      },
    });
    mockAddCredentialMetadataEntry.mockResolvedValue(true);
    mockCreateCredentialMetadataList.mockResolvedValue(true);

    await mongoDb().collection('offers').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('disclosures').deleteMany({});
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('vendorUserIdMappings').deleteMany({});
    await mongoDb().collection('groups').deleteMany({});

    tenant = await persistTenant({
      serviceIds: ['#foo-service-id-1'],
    });
    disclosure = await persistDisclosure({
      tenant,
      vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
    });

    offersRepo = initOffersRepo(fastify)({
      log: fastify.log,
      config: fastify.config,
      tenant: { ...tenant, _id: new ObjectId(tenant._id) },
    });

    exchangeRepo = initExchangeRepo(fastify)({
      log: fastify.log,
      config: fastify.config,
      tenant: { ...tenant, _id: new ObjectId(tenant._id) },
    });

    tenantRepo = initTenantRepo(fastify)({
      log: fastify.log,
      config: fastify.config,
    });

    tenantKeyDatum = await persistKey({
      tenant,
      kidFragment: '#ID2',
      keyPair,
    });

    exchange = await persistOfferExchange({
      tenant,
      disclosure,
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        {
          state: ExchangeStates.IDENTIFIED,
          timestamp: new Date(),
        },
      ],
    });
    exchangeId = exchange._id;

    user = await persistVendorUserIdMapping({ tenant });
    authToken = await genAuthToken(tenant, exchange);
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  const issuingUrl = ({ did }, suffix = '') =>
    `/api/holder/v0.6/org/${did}/issue/${suffix}`;

  const omitForVendorOffer = omit([
    '_id',
    'issuer',
    'credentialSchema',
    'contentHash',
    'credentialStatus',
    'createdAt',
    'updatedAt',
  ]);
  const newVendorOffer = async (overrides) =>
    omitForVendorOffer(await newOffer(overrides));

  describe('generate link code', () => {
    it('Should generate a link code', async () => {
      const result = generateLinkCode();

      expect(result).toEqual({
        linkCodeCommitment: {
          type: 'VelocityCredentialLinkCodeCommitment2022',
          value: expect.any(String),
        },
        linkCode: expect.any(String),
      });
    });
  });

  describe('/credential-offers OFFERS_TYPE === PREPREPARED_ONLY', () => {
    let offers;

    beforeEach(async () => {
      offers = [];
      offers.push(await persistOffer({ tenant, exchange, user }));
      await wait(25);
      offers.push(
        await persistOffer({
          tenant,
          exchange,
          user,
          type: ['EducationDegree'],
          credentialSubject: educationDegreeCredentialSubject(user),
        })
      );

      await mongoDb()
        .collection('exchanges')
        .updateOne(
          { _id: new ObjectId(exchangeId, exchangeRepoDefaultProjection) },
          {
            $push: {
              events: {
                state: ExchangeStates.OFFERS_RECEIVED,
                timestamp: new Date(),
              },
            },
          }
        );
    });

    it('/credential-offers should return 401 when not authorized', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['CurrentEmploymentPosition'],
          exchangeId,
        },
      });
      expect(response.statusCode).toEqual(401);
    });

    it('should should return 401 when token expired', async () => {
      const expiredToken = generateTestAccessToken(
        exchange._id.toString(),
        tenant.did,
        user._id,
        null,
        null,
        null,
        getUnixTime(subDays(1)(new Date())),
        keyPair.privateKey,
        tenantKeyDatum.kidFragment
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['EducationDegree'],
          offerHashes: [],
        },
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });
      expect(response.statusCode).toEqual(401);
    });

    it('/credential-offers should return 400 when no exchangeId', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['CurrentEmploymentPosition'],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(400);
    });

    it('should filter out prepared offers with missing credentialSchema.id', async () => {
      await persistOffer({
        tenant,
        exchange,
        user,
        credentialSchema: {},
        types: ['SpecialType'],
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['SpecialType'],
          offerHashes: [],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [],
      });
    });

    it('should return PREPREPARED offers of one type already saved in db', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['EducationDegree'],
          offerHashes: [],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [offerResponseExpectation(offers[1])],
        challenge: expect.any(String),
      });
      expect(await exchangeRepo.findById(exchangeId)).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          offerIds: [offers[1]._id],
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_RECEIVED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
        })
      );
    });

    it('1.should return PREPREPARED offers of all types already saved in db', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          offerHashes: [],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: expect.arrayContaining(map(offerResponseExpectation, offers)),
        challenge: expect.any(String),
      });
      expect(await exchangeRepo.findById(exchangeId)).toEqual(
        exchangeExpectation({
          exchangeId,
          user,
          disclosure,
          offerIds: map((offer) => new ObjectId(offer._id), offers),
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_RECEIVED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
        })
      );
    });

    it('/credential-offers should return 400 when exchange is complete', async () => {
      const emptyExchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.COMPLETE,
            timestamp: new Date(),
          },
          {
            state: ExchangeStates.OFFERS_SENT,
            timestamp: new Date(),
          },
        ],
      });
      const token = await genAuthToken(tenant, emptyExchange);

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: [],
          exchangeId: emptyExchange._id,
        },
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'offers_already_cliamed_synch',
          message: `Exchange ${emptyExchange._id} is in an invalid state`,
          statusCode: 400,
        })
      );
      expect(
        await exchangeRepo.findById(
          emptyExchange._id,
          exchangeRepoDefaultProjection
        )
      ).toEqual(
        exchangeExpectation({
          disclosure,
          exchangeId: emptyExchange._id,
          overrides: {
            err: `Exchange ${emptyExchange._id} is in an invalid state`,
            offerIds: undefined,
            challenge: undefined,
            challengeIssuedAt: undefined,
          },
          states: [
            ExchangeStates.NEW,
            ExchangeStates.COMPLETE,
            ExchangeStates.OFFERS_SENT,
            ExchangeStates.UNEXPECTED_ERROR,
          ],
        })
      );
    });

    it('should NOT permit retrievals of offers if COMPLETE', async () => {
      await mongoDb()
        .collection('exchanges')
        .updateOne(
          { _id: new ObjectId(exchangeId) },
          {
            $push: {
              events: {
                state: ExchangeStates.COMPLETE,
                timestamp: new Date(),
              },
            },
          }
        );
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['EducationDegree'],
          offerHashes: [],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(400);
    });

    it('/credential-offers should return 401 if user not found', async () => {
      const offer = await newOffer({ tenant });
      await mongoDb().collection('vendorUserIdMappings').deleteMany({});
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint)
        .reply(202, { offers: [offer] });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(401);
    });

    it('/credential-offers should return 404 if tenant not found', async () => {
      const offer = await newOffer({ tenant });
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint)
        .reply(202, { offers: [offer] });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl({ did: 'did:value' }, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.json.message).toEqual(
        'Tenant {"tenantId":"did:value"} not found'
      );
      expect(response.statusCode).toEqual(404);
    });

    it('/credential-offers should return 400 when no exchangeId', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['CurrentEmploymentPosition'],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(400);
    });

    it('should return 200 & no credential if there isnt an offer setup', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['OpenBadgeCredential'],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [],
      });
    });

    it('should filter out prepared offers with missing credentialSchema.id', async () => {
      await persistOffer({
        tenant,
        exchange,
        user,
        credentialSchema: {},
        types: ['SpecialType'],
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['SpecialType'],
          offerHashes: [],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [],
      });
    });

    it('should return offers even if there are none associated to this exchange', async () => {
      const emptyExchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.IDENTIFIED,
            timestamp: new Date(),
          },
        ],
      });
      authToken = await genAuthToken(tenant, emptyExchange);

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: [],
          exchangeId: emptyExchange._id,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: expect.arrayContaining(map(offerResponseExpectation, offers)),
        challenge: expect.any(String),
      });
      expect(await exchangeRepo.findById(emptyExchange._id)).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId: emptyExchange._id,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: reverse(map('_id', offers)),
        })
      );
      expect(await exchangeRepo.findById(exchange._id)).toEqual(
        exchangeExpectation({
          exchangeId,
          disclosure,
          user,
          overrides: {
            challenge: undefined,
            challengeIssuedAt: undefined,
          },
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_RECEIVED,
          ],
          omitList: ['vendorUserId', 'offerIds'],
        })
      );
    });

    it('should return offers not associated to this exchange filtered by offerHashes', async () => {
      const offer = await persistOffer({
        tenant,
        type: ['EducationDegree'],
        credentialSubject: {
          ...educationDegreeCredentialSubject(user),
          school: 'did:ethr:not-a-duplicate-new-school',
          schoolName: {
            localized: {
              en: 'New School Univerity',
            },
          },
        },
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['EducationDegree'],
          offerHashes: map('contentHash.value', offers),
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [offerResponseExpectation(offer)],
        challenge: expect.any(String),
      });
      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_RECEIVED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: [offer._id],
        })
      );
    });

    it('should return PREPREPARED offers of all types already saved in db that arent contained in offerHashes', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          offerHashes: [offers[1].contentHash.value],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [offerResponseExpectation(offers[0])],
        challenge: expect.any(String),
      });
      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_RECEIVED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: [offers[0]._id],
        })
      );
    });

    it('should permit retrieval of offers if exchange has an ERRORED event', async () => {
      await mongoDb()
        .collection('exchanges')
        .updateOne(
          { _id: new ObjectId(exchangeId) },
          {
            $push: {
              events: {
                state: ExchangeStates.UNEXPECTED_ERROR,
                timestamp: new Date(),
              },
            },
            $set: {
              err: 'Some Error',
            },
          }
        );

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['EducationDegree'],
          offerHashes: [],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);

      expect(response.json).toEqual({
        offers: expect.arrayContaining([
          {
            ...omit(
              [
                '_id',
                'createdAt',
                'linkCode',
                'updatedAt',
                'credentialStatus',
                'contentHash',
              ],
              offers[1]
            ),
            credentialSubject: omit(
              ['vendorUserId'],
              offers[1].credentialSubject
            ),
            hash: expect.any(String),
            id: expect.stringMatching(OBJECT_ID_FORMAT),
          },
        ]),
        challenge: expect.any(String),
      });
    });

    it('should return only unique exchange offers', async () => {
      const extraOffer = await persistOffer({
        exchange,
        tenant,
        type: ['EducationDegree'],
        credentialSubject: {
          ...educationDegreeCredentialSubject(user),
          school: 'did:ethr:a-new-school',
          schoolName: {
            localized: {
              en: 'New School Univerity',
            },
          },
        },
      });

      const newerDuplicateOffer = await persistOffer({
        exchange,
        tenant,
        type: ['EducationDegree'],
        credentialSubject: educationDegreeCredentialSubject(user),
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId: exchange._id,
          types: ['EducationDegree'],
          offerHashes: [],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: expect.arrayContaining(
          map(offerResponseExpectation, [newerDuplicateOffer, extraOffer])
        ),
        challenge: expect.any(String),
      });
      expect(await exchangeRepo.findById(exchange._id)).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_RECEIVED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: [newerDuplicateOffer._id, extraOffer._id],
        })
      );
    });
  });

  describe('/credential-offers OFFERS_TYPE equal ALL', () => {
    beforeEach(async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        offerType: 'ALL',
        enableOfferValidation: true,
      });
    });

    it('/credential-offers should return 200 when unknown offer type specified and no offers are found on agent or vendor', async () => {
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint)
        .reply(200, { offers: [] });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['EmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [],
      });
      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: [],
        })
      );
    });

    it('/credential-offers should return 502 and add "err: offer id not exist" to exchange ', async () => {
      const offer = await newVendorOffer({ tenant, exchange });
      const offer2 = await newVendorOffer({ tenant, exchange });
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint)
        .reply(200, {
          offers: [omit(['offerId'], offer), omit(['offerId'], offer2)],
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['EmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(500);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Internal Server Error',
          message: '2 offer(s) without offerId received from vendor',
          statusCode: 500,
          errorCode: 'upstream_offers_offer_id_missing',
        })
      );
      const exchangeDb = await exchangeRepo.findById(
        exchangeId,
        exchangeRepoDefaultProjection
      );
      expect(exchangeDb).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFER_ID_UNDEFINED_ERROR,
            ExchangeStates.UNEXPECTED_ERROR,
          ],
          overrides: {
            err: '2 offer(s) without offerId received from vendor',
            offerIds: undefined,
            challenge: undefined,
            challengeIssuedAt: undefined,
          },
        })
      );
    });

    it('1. /credential-offers should return an array of offers', async () => {
      const getSchemaNock = nockRegistrarAppSchemaName();

      const offer = await newVendorOffer({ tenant, exchange });
      let sentBody;
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, { offers: [offer] });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({ offer, exchange, tenant }),
        ],
        challenge: expect.any(String),
      });

      expect(getSchemaNock.isDone()).toEqual(true);

      const dbResult = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(response.json.offers[0].id) });
      expect(dbResult).toEqual(
        offerExpectation({
          tenant,
          offer: buildCredentialSubjectWithType(offer),
          autocleanFinalizedOfferPii: false,
        })
      );
      expect(
        await exchangeRepo.findById(exchange._id, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          exchangeId,
          disclosure,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: map('id', response.json.offers),
          overrides: {
            vendorOfferStatuses: {
              [offer.offerId]: 'OK',
            },
          },
        })
      );
      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: ['PastEmploymentPosition'],
        vendorUserId: user.vendorUserId,
      });
    });

    // eslint-disable-next-line max-len
    it('/credential-offers should return 200 and a error validationStatus if an offer is received with expirationDate and validUntil set', async () => {
      const offer = await newVendorOffer({ tenant, exchange });
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint)
        .reply(200, {
          offers: [
            {
              ...offer,
              expirationDate: new Date(),
              validUntil: new Date(),
            },
          ],
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['EmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [],
      });
      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: [],
          overrides: {
            vendorOfferStatuses: {
              [offer.offerId]:
                "'$.expirationDate' and '$.validUntil' cannot both be set",
            },
          },
        })
      );
    });

    it('/credential-offers should return offers where issuer as string', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        offerType: 'ALL',
        enableOfferValidation: true,
        storeIssuerAsString: true,
      });

      const getSchemaNock = nockRegistrarAppSchemaName();

      const offer = await newVendorOffer({
        tenant,
        exchange,
      });
      let sentBody;
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, { offers: [offer] });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          {
            ...buildCredentialSubjectWithSchemaDefaults({
              offer,
              exchange,
              tenant,
            }),
            issuer: tenant.did,
          },
        ],
        challenge: expect.any(String),
      });

      expect(getSchemaNock.isDone()).toEqual(true);

      const dbResult = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(response.json.offers[0].id) });
      expect(dbResult).toEqual(
        offerExpectation({
          tenant,
          offer: buildCredentialSubjectWithType(offer),
          autocleanFinalizedOfferPii: false,
        })
      );
      expect(
        await exchangeRepo.findById(exchange._id, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          exchangeId,
          disclosure,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: map('id', response.json.offers),
          overrides: {
            vendorOfferStatuses: {
              [offer.offerId]: 'OK',
            },
          },
        })
      );
      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: ['PastEmploymentPosition'],
        vendorUserId: user.vendorUserId,
      });
    });

    it('/credential-offers should call custom webhookUrl from a tenant', async () => {
      const webhookUrl = 'https://customUrl.com';
      const customTenant = await persistTenant({
        webhookUrl,
      });

      const customDisclosure = await persistDisclosure({
        tenant: customTenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      });

      const customExchange = await persistOfferExchange({
        tenant: customTenant,
        disclosure: customDisclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.IDENTIFIED,
            timestamp: new Date(),
          },
        ],
      });

      await persistKey({
        tenant: customTenant,
        kidFragment: '#ID2',
        keyPair,
      });

      const customUser = await persistVendorUserIdMapping({
        tenant: customTenant,
      });
      const customAuthToken = await genAuthToken(
        customTenant,
        customExchange,
        customUser
      );

      const offer = await newVendorOffer({
        tenant: customTenant,
        exchange: customExchange,
        user: customUser,
      });

      let identityWebhookHeaders;
      const webhookNock = nock(webhookUrl)
        .post(requestOffersFromVendorEndpoint)
        // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
        .reply(200, function () {
          identityWebhookHeaders = this.req.headers;

          return {
            offers: [offer],
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(customTenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId: customExchange._id,
        },
        headers: {
          authorization: `Bearer ${customAuthToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(webhookNock.isDone()).toBe(true);
      expect(identityWebhookHeaders.authorization).toBe(
        'Bearer fake-bearer-token'
      );
    });

    it('/credential-offers should call custom webhookUrl from a tenant with token', async () => {
      const webhookUrl = 'https://customUrl.com';
      const customTenant = await persistTenant({
        webhookUrl,
        webhookAuth: {
          type: 'bearer',
          bearerToken: 'secret',
        },
      });

      const customDisclosure = await persistDisclosure({
        tenant: customTenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      });

      const customExchange = await persistOfferExchange({
        tenant: customTenant,
        disclosure: customDisclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.IDENTIFIED,
            timestamp: new Date(),
          },
        ],
      });

      await persistKey({
        tenant: customTenant,
        kidFragment: '#ID2',
        keyPair,
      });

      const customUser = await persistVendorUserIdMapping({
        tenant: customTenant,
      });
      const customAuthToken = await genAuthToken(
        customTenant,
        customExchange,
        customUser
      );

      const offer = await newVendorOffer({
        tenant: customTenant,
        exchange: customExchange,
        user: customUser,
      });

      let identityWebhookHeaders;
      const webhookNock = nock(webhookUrl)
        .post(requestOffersFromVendorEndpoint)
        // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
        .reply(200, function () {
          identityWebhookHeaders = this.req.headers;

          return {
            offers: [offer],
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(customTenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId: customExchange._id,
        },
        headers: {
          authorization: `Bearer ${customAuthToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(webhookNock.isDone()).toBe(true);
      expect(identityWebhookHeaders.authorization).toBe('Bearer secret');
    });

    it('/credential-offers should not apply customToken if webhookUrl is not present', async () => {
      const customTenant = await persistTenant({
        webhookAuth: {
          type: 'bearer',
          bearerToken: 'secret',
        },
      });

      const customDisclosure = await persistDisclosure({
        tenant: customTenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      });

      const customExchange = await persistOfferExchange({
        tenant: customTenant,
        disclosure: customDisclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.IDENTIFIED,
            timestamp: new Date(),
          },
        ],
      });

      await persistKey({
        tenant: customTenant,
        kidFragment: '#ID2',
        keyPair,
      });

      const customUser = await persistVendorUserIdMapping({
        tenant: customTenant,
      });
      const customAuthToken = await genAuthToken(
        customTenant,
        customExchange,
        customUser
      );

      const offer = await newVendorOffer({
        tenant: customTenant,
        exchange: customExchange,
        user: customUser,
      });

      let identityWebhookHeaders;
      const webhookNock = nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint)
        // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
        .reply(200, function () {
          identityWebhookHeaders = this.req.headers;

          return {
            offers: [offer],
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(customTenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId: customExchange._id,
        },
        headers: {
          authorization: `Bearer ${customAuthToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(webhookNock.isDone()).toBe(true);
      expect(identityWebhookHeaders.authorization).toBe(
        'Bearer fake-bearer-token'
      );
    });

    it('/credential-offers should not apply customToken if webhookAuth.bearerToken is empty string', async () => {
      const webhookUrl = 'https://customUrl.com';

      const customTenant = await persistTenant({
        webhookUrl,
        webhookAuth: {
          type: 'bearer',
          bearerToken: '',
        },
      });

      const customDisclosure = await persistDisclosure({
        tenant: customTenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      });

      const customExchange = await persistOfferExchange({
        tenant: customTenant,
        disclosure: customDisclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.IDENTIFIED,
            timestamp: new Date(),
          },
        ],
      });

      await persistKey({
        tenant: customTenant,
        kidFragment: '#ID2',
        keyPair,
      });

      const customUser = await persistVendorUserIdMapping({
        tenant: customTenant,
      });
      const customAuthToken = await genAuthToken(
        customTenant,
        customExchange,
        customUser
      );

      const offer = await newVendorOffer({
        tenant: customTenant,
        exchange: customExchange,
        user: customUser,
      });

      let identityWebhookHeaders;
      const webhookNock = nock(webhookUrl)
        .post(requestOffersFromVendorEndpoint)
        // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
        .reply(200, function () {
          identityWebhookHeaders = this.req.headers;

          return {
            offers: [offer],
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(customTenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId: customExchange._id,
        },
        headers: {
          authorization: `Bearer ${customAuthToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(webhookNock.isDone()).toBe(true);
      expect(identityWebhookHeaders.authorization).toBe(
        'Bearer fake-bearer-token'
      );
    });

    it('/credential-offers should call custom webhookUrl from a tenant with custom auth token', async () => {
      const webhookUrl = 'https://customUrl.com';
      const customTenant = await persistTenant({
        webhookUrl,
        webhookAuth: {
          type: 'bearer',
          bearerToken: 'secret',
        },
      });
      const customDisclosure = await persistDisclosure({
        tenant: customTenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      });

      const customExchange = await persistOfferExchange({
        tenant: customTenant,
        disclosure: customDisclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.IDENTIFIED,
            timestamp: new Date(),
          },
        ],
      });

      await persistKey({
        tenant: customTenant,
        kidFragment: '#ID2',
        keyPair,
      });

      const customUser = await persistVendorUserIdMapping({
        tenant: customTenant,
      });
      const customAuthToken = await genAuthToken(
        customTenant,
        customExchange,
        customUser
      );

      const offer = await newVendorOffer({
        tenant: customTenant,
        exchange: customExchange,
        user: customUser,
      });

      let identityWebhookHeaders;
      nock(webhookUrl)
        .post(requestOffersFromVendorEndpoint)
        // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
        .reply(200, function () {
          identityWebhookHeaders = this.req.headers;

          return {
            offers: [offer],
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(customTenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId: customExchange._id,
        },
        headers: {
          authorization: `Bearer ${customAuthToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(identityWebhookHeaders.authorization).toEqual('Bearer secret');
    });

    it('/credential-offers should return all offers if exchange has only OFFERS_RECEIVED event and no OFFERS_WAITING_ON_VENDOR event', async () => {
      await mongoDb()
        .collection('exchanges')
        .updateOne(
          { _id: new ObjectId(exchangeId) },
          {
            $push: {
              events: {
                $each: [
                  {
                    state: ExchangeStates.OFFERS_RECEIVED,
                    timestamp: new Date(),
                  },
                ],
              },
            },
          }
        );

      const preparedOffer = await persistOffer({
        tenant,
        exchange,
        user,
        credentialSubject: {
          vendorUserId: user.vendorUserId,
          company: tenant.did,
          companyName: {
            localized: {
              en: 'Velocity test',
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
      });
      const offer = await newVendorOffer({ tenant, exchange });
      let sentBody;
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, { offers: [offer] });

      const getSchemaNock = nockRegistrarAppSchemaName();

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({ offer, exchange, tenant }),
          offerResponseExpectation(preparedOffer),
        ],
        challenge: expect.any(String),
      });

      expect(getSchemaNock.isDone()).toEqual(true);

      const dbResult = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(response.json.offers[0].id) });
      expect(dbResult).toEqual(
        offerExpectation({
          offer: buildCredentialSubjectWithType(offer),
          tenant,
          autocleanFinalizedOfferPii: false,
        })
      );
      expect(await exchangeRepo.findById(exchange._id)).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_RECEIVED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: map('id', response.json.offers),
          overrides: {
            vendorOfferStatuses: {
              [offer.offerId]: 'OK',
            },
          },
        })
      );
      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: ['PastEmploymentPosition'],
        vendorUserId: user.vendorUserId,
      });
    });

    it('/credential-offers should return only PREPREPARED offers if exhange has OFFERS_RECEIVED event and OFFERS_WAITING_ON_VENDOR', async () => {
      await mongoDb()
        .collection('exchanges')
        .updateOne(
          { _id: new ObjectId(exchangeId) },
          {
            $push: {
              events: {
                $each: [
                  {
                    state: ExchangeStates.OFFERS_RECEIVED,
                    timestamp: new Date(),
                  },
                  {
                    state: ExchangeStates.OFFERS_WAITING_ON_VENDOR,
                    timestamp: new Date(),
                  },
                ],
              },
            },
          }
        );

      const preparedOffer = await persistOffer({ tenant, exchange, user });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [offerResponseExpectation(preparedOffer)],
        challenge: expect.any(String),
      });
      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_RECEIVED,
            ExchangeStates.OFFERS_WAITING_ON_VENDOR,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: map('id', response.json.offers),
        })
      );
    });

    it('/credential-offers should return an array of offers when exchangeId is not returned by vendor', async () => {
      const offer = omit(
        ['exchangeId'],
        await newVendorOffer({ tenant, exchange })
      );
      let sentBody;
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, { offers: [offer] });
      const getSchemaNock = nockRegistrarAppSchemaName();
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(getSchemaNock.isDone()).toEqual(true);
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({ offer, exchange, tenant }),
        ],
        challenge: expect.any(String),
      });
      const dbResult = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(response.json.offers[0].id) });
      expect(dbResult).toEqual(
        offerExpectation({
          offer: buildCredentialSubjectWithType({
            ...offer,
            exchangeId: new ObjectId(exchange._id),
          }),
          tenant,
          autocleanFinalizedOfferPii: false,
        })
      );
      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: map('id', response.json.offers),
          overrides: {
            vendorOfferStatuses: {
              [offer.offerId]: 'OK',
            },
          },
        })
      );
      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: ['PastEmploymentPosition'],
        vendorUserId: user.vendorUserId,
      });
    });

    it('/credential-offers should return an empty array if duplicate offer', async () => {
      const getSchemaNock = nockRegistrarAppSchemaName();
      const tenantWithVendorOrganizationId = await persistTenant({
        vendorOrganizationId: 'abc123',
      });
      const disclosureOldTenant = await persistDisclosure({
        tenant: tenantWithVendorOrganizationId,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      });
      const exchangeForOldTenant = await persistOfferExchange({
        tenant: tenantWithVendorOrganizationId,
        disclosure: disclosureOldTenant,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.IDENTIFIED,
            timestamp: new Date(),
          },
        ],
      });
      const userForOldTenant = await persistVendorUserIdMapping({
        tenant: tenantWithVendorOrganizationId,
      });
      tenantKeyDatum = await persistKey({
        keyPair,
        tenant: tenantWithVendorOrganizationId,
      });
      const authTokenForOldTenant = await genAuthToken(
        tenantWithVendorOrganizationId,
        exchangeForOldTenant,
        userForOldTenant
      );

      const offer = await newVendorOffer({
        tenant: tenantWithVendorOrganizationId,
        exchange: exchangeForOldTenant,
      });
      const hash = hashOffer(buildCredentialSubjectWithType(offer));
      let sentBody;
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, { offers: [offer] });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenantWithVendorOrganizationId, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId: exchangeForOldTenant._id,
          offerHashes: [hash],
        },
        headers: {
          authorization: `Bearer ${authTokenForOldTenant}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json.offers).toHaveLength(0);

      expect(sentBody).toEqual({
        exchangeId: exchangeForOldTenant._id,
        tenantDID: tenantWithVendorOrganizationId.did,
        tenantId: tenantWithVendorOrganizationId._id,
        vendorOrganizationId:
          tenantWithVendorOrganizationId.vendorOrganizationId,
        types: ['PastEmploymentPosition'],
        vendorUserId: userForOldTenant.vendorUserId,
      });
      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/credential-offers should throw error when ERROR_ON_INVALID_WEBHOOK_OFFERS is true and at least one invalid offer', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        offerType: 'ALL',
        enableOfferValidation: true,
        errorOnInvalidWebhookOffers: true,
      });
      const tenantWithVendorOrganizationId = await persistTenant({
        vendorOrganizationId: 'abc123',
      });
      const disclosureOldTenant = await persistDisclosure({
        tenant: tenantWithVendorOrganizationId,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      });
      const exchangeForOldTenant = await persistOfferExchange({
        tenant: tenantWithVendorOrganizationId,
        disclosure: disclosureOldTenant,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.IDENTIFIED,
            timestamp: new Date(),
          },
        ],
      });
      const userForOldTenant = await persistVendorUserIdMapping({
        tenant: tenantWithVendorOrganizationId,
      });
      tenantKeyDatum = await persistKey({
        keyPair,
        tenant: tenantWithVendorOrganizationId,
      });
      const authTokenForOldTenant = await genAuthToken(
        tenantWithVendorOrganizationId,
        exchangeForOldTenant,
        userForOldTenant
      );
      const getSchemaNock = nockRegistrarAppSchemaName();

      const offer = await newVendorOffer({
        tenant: tenantWithVendorOrganizationId,
        exchange: exchangeForOldTenant,
        credentialSubject: {
          vendorUserId: userForOldTenant.vendorUserId,
          company: tenantWithVendorOrganizationId.did,
        },
      });

      let sentBody;
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, { offers: [offer] });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenantWithVendorOrganizationId, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId: exchangeForOldTenant._id,
        },
        headers: {
          authorization: `Bearer ${authTokenForOldTenant}`,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'upstream_offers_invalid',
          message: 'Invalid webhook offers',
          statusCode: 400,
        })
      );

      expect(sentBody).toEqual({
        exchangeId: exchangeForOldTenant._id,
        tenantDID: tenantWithVendorOrganizationId.did,
        tenantId: tenantWithVendorOrganizationId._id,
        vendorOrganizationId:
          tenantWithVendorOrganizationId.vendorOrganizationId,
        types: ['PastEmploymentPosition'],
        vendorUserId: userForOldTenant.vendorUserId,
      });
      exchangeRepo = initExchangeRepo(fastify)({
        log: fastify.log,
        config: fastify.config,
        tenant: {
          ...tenantWithVendorOrganizationId,
          _id: new ObjectId(tenantWithVendorOrganizationId._id),
        },
      });
      const exchangedb = await exchangeRepo.findById(
        exchangeForOldTenant._id,
        exchangeRepoDefaultProjection
      );
      expect(exchangedb).toEqual(
        exchangeExpectation({
          user: userForOldTenant,
          disclosure: disclosureOldTenant,
          exchangeId: exchangeForOldTenant._id,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
            ExchangeStates.UNEXPECTED_ERROR,
          ],
          overrides: {
            err: 'Invalid webhook offers',
            offerIds: [],
            vendorOfferStatuses: {
              [offer.offerId]:
                // eslint-disable-next-line max-len
                "'$.credentialSubject' must have required property 'companyName', '$.credentialSubject' must have required property 'title', '$.credentialSubject' must have required property 'startMonthYear', '$.credentialSubject' must have required property 'endMonthYear'",
            },
          },
        })
      );
      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/credential-offers should return 202 if vendor returns 202', async () => {
      nock(mockVendorUrl).post(requestOffersFromVendorEndpoint).reply(202);
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(202);
      expect(response.json).toEqual({
        offers: [],
      });
      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_WAITING_ON_VENDOR,
          ],
          overrides: {
            offerHashes: [],
            challenge: undefined,
            challengeIssuedAt: undefined,
          },
          omitList: ['offerIds'],
        })
      );
    });

    it('/credential-offers should return 401 if user not found', async () => {
      const offer = await newOffer({ tenant });
      await mongoDb().collection('vendorUserIdMappings').deleteMany({});
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint)
        .reply(202, { offers: [offer] });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(401);
    });

    it('/credential-offers should return 404 if tenant not found', async () => {
      const offer = await newOffer({ tenant });
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint)
        .reply(202, { offers: [offer] });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl({ did: 'did:value' }, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.json.message).toEqual(
        'Tenant {"tenantId":"did:value"} not found'
      );
      expect(response.statusCode).toEqual(404);
    });

    it('/credential-offers should return 400 when no exchangeId', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['CurrentEmploymentPosition'],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(400);
    });

    it('/credential-offers should 200 if some offers from vendor are not valid', async () => {
      const [offer0, offer1, offer2] = await Promise.all([
        newVendorOffer({ tenant, exchange }),
        newVendorOffer({ tenant, exchange }),
        newVendorOffer({ tenant, exchange }),
      ]);
      let sentBody;
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, {
          offers: [
            offer0,
            omit(['credentialSubject.title'], offer1),
            omit(['credentialSubject.title'], offer2),
          ],
        });
      const getSchemaNock = nockRegistrarAppSchemaName({ repeatCount: 3 });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(getSchemaNock.isDone()).toEqual(true);
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({
            offer: offer0,
            exchange,
            tenant,
          }),
        ],
        challenge: expect.any(String),
      });

      expect(
        await exchangeRepo.findById(exchange._id, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: [response.json.offers[0].id],
          overrides: {
            vendorOfferStatuses: {
              [offer0.offerId]: 'OK',
              [offer1.offerId]:
                "'$.credentialSubject' must have required property 'title'",
              [offer2.offerId]:
                "'$.credentialSubject' must have required property 'title'",
            },
          },
        })
      );
      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: ['PastEmploymentPosition'],
        vendorUserId: user.vendorUserId,
      });
    });

    it("/credential-offers should 200 if some offers from vendor don't pass schema validation", async () => {
      const [offer0, offer1] = await Promise.all([
        newVendorOffer({ tenant, exchange }),
        newVendorOffer({ tenant, exchange }),
      ]);
      let sentBody;
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, {
          offers: [
            offer0,
            omit(
              ['credentialSubject.company', 'credentialSubject.title'],
              offer1
            ),
          ],
        });
      const getSchemaNock = nockRegistrarAppSchemaName({ repeatCount: 2 });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(getSchemaNock.isDone()).toEqual(true);
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({
            offer: offer0,
            exchange,
            tenant,
          }),
        ],
        challenge: expect.any(String),
      });

      expect(await exchangeRepo.findById(exchange._id)).toEqual(
        exchangeExpectation({
          exchangeId: exchange._id,
          user,
          disclosure,
          offerIds: [response.json.offers[0].id],
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          overrides: {
            vendorOfferStatuses: {
              [offer0.offerId]: 'OK',
              [offer1.offerId]:
                "'$.credentialSubject' must have required property 'company', '$.credentialSubject' must have required property 'title'",
            },
          },
        })
      );

      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: ['PastEmploymentPosition'],
        vendorUserId: user.vendorUserId,
      });
    });

    it('/credential-offers should 200 and include invalid offers from vendor if enableOfferValidation is false', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        offerType: 'ALL',
        enableOfferValidation: false,
      });

      const [offer0, offer1] = await Promise.all([
        newVendorOffer({ tenant, exchange }),
        newVendorOffer({ tenant, exchange }),
      ]);
      let sentBody;
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, {
          offers: [
            offer0,
            omit(
              ['credentialSubject.company', 'credentialSubject.title'],
              offer1
            ),
          ],
        });
      const getSchemaNock = nockRegistrarAppSchemaName({ repeatCount: 2 });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(getSchemaNock.isDone()).toEqual(true);
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({
            offer: offer0,
            exchange,
            tenant,
          }),
          {
            ...buildCredentialSubjectWithSchemaDefaults({
              offer: offer1,
              exchange,
              tenant,
            }),
            credentialSubject: omit(['vendorUserId', 'company', 'title'], {
              ...offer1.credentialSubject,
              type: 'PastEmploymentPosition',
            }),
            hash: hashOffer(
              omit(
                ['credentialSubject.company', 'credentialSubject.title'],
                buildCredentialSubjectWithType(offer1)
              )
            ),
          },
        ],
        challenge: expect.any(String),
      });

      expect(await exchangeRepo.findById(exchange._id)).toEqual(
        exchangeExpectation({
          exchangeId: exchange._id,
          user,
          disclosure,
          offerIds: [response.json.offers[0].id, response.json.offers[1].id],
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          overrides: {
            vendorOfferStatuses: {
              [offer0.offerId]: 'OK',
              [offer1.offerId]: 'OK',
            },
          },
        })
      );

      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: ['PastEmploymentPosition'],
        vendorUserId: user.vendorUserId,
      });
    });

    it('/credential-offers should 200 if some offers from vendor have unknown credential types', async () => {
      const getSchemaNockPastEmploymentPosition = nockRegistrarAppSchemaName();
      const getSchemaNockEducationDegree = nockRegistrarAppSchemaName({
        schemaName: 'education-degree',
        credentialType: 'EducationDegree',
        statusCode: 404,
      });

      const [offer0, offer1] = await Promise.all([
        newVendorOffer({ tenant, exchange }),
        newVendorOffer({ tenant, exchange, type: ['EducationDegree'] }),
      ]);
      let sentBody;
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, {
          offers: [
            offer0,
            omit(
              ['credentialSubject.company', 'credentialSubject.title'],
              offer1
            ),
          ],
        });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(getSchemaNockPastEmploymentPosition.isDone()).toEqual(true);
      expect(getSchemaNockEducationDegree.isDone()).toEqual(true);
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({
            offer: offer0,
            exchange,
            tenant,
          }),
        ],
        challenge: expect.any(String),
      });

      expect(await exchangeRepo.findById(exchange._id)).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId: exchange._id,
          offerIds: [response.json.offers[0].id],
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          overrides: {
            vendorOfferStatuses: {
              [offer0.offerId]: 'OK',
              [offer1.offerId]:
                'failed to resolve http://mock.com/schemas/education-degree',
            },
          },
        })
      );
      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: ['PastEmploymentPosition'],
        vendorUserId: user.vendorUserId,
      });
    });

    it('/credential-offers should return 200 with no linkCode for not revoked offer', async () => {
      const { did: vcDID } = generateDidInfo();
      const replacementOffer = {
        ...(await newVendorOffer()),
        exchangeId,
        linkedCredentials: [{ linkedCredentialId: vcDID, linkType: 'REPLACE' }],
      };

      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint)
        .reply(200, { offers: [replacementOffer] });
      const getSchemaNock = nockRegistrarAppSchemaName();
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(getSchemaNock.isDone()).toEqual(true);
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          jsonOfferExpectation({
            offer: omit(
              'linkedCredentials',
              buildCredentialSubjectWithType(replacementOffer)
            ),
            tenant,
          }),
        ],
        challenge: expect.any(String),
      });
      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(response.json.offers[0].id) })
      ).toEqual(
        offerExpectation({
          offer: buildCredentialSubjectWithType(replacementOffer),
          tenant,
          overrides: {
            'linkedCredentials[0].invalidAt': expect.any(Date),
            'linkedCredentials[0].invalidReason': `Revoked offer ${replacementOffer.linkedCredentials[0].linkedCredentialId} not found`,
          },
          autocleanFinalizedOfferPii: false,
        })
      );
      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: [response.json.offers[0].id],
          overrides: {
            vendorOfferStatuses: {
              [replacementOffer.offerId]: 'OK',
            },
          },
        })
      );
    });

    it('/credential-offers should return 200 with linkCode for an offer for revoked credential', async () => {
      const { did: vcDID } = generateDidInfo();
      const offerLinkCode = nanoid(160);
      await persistOffer({
        tenant,
        exchange,
        did: vcDID,
        linkCode: offerLinkCode,
        credentialSubjectType: 'PastEmploymentPosition',
        credentialStatus: {
          revokedAt: new Date(),
        },
      });

      const replacementOffer = {
        ...(await newVendorOffer({ tenant, exchange })),
        linkedCredentials: [{ linkedCredentialId: vcDID, linkType: 'REPLACE' }],
      };

      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint)
        .reply(200, { offers: [replacementOffer] });
      const getSchemaNock = nockRegistrarAppSchemaName();
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(getSchemaNock.isDone()).toEqual(true);
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          jsonOfferExpectation({
            offer: buildCredentialSubjectWithType(replacementOffer),
            tenant,
          }),
        ],
        challenge: expect.any(String),
      });
      const dbOffer = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(response.json.offers[0].id) });
      expect(dbOffer).toEqual({
        ...offerExpectation({
          offer: buildCredentialSubjectWithType(replacementOffer),
          tenant,
          overrides: { 'linkedCredentials[0].linkCode': expect.any(String) },
          autocleanFinalizedOfferPii: false,
        }),
      });
      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: [response.json.offers[0].id],
          overrides: {
            vendorOfferStatuses: {
              [replacementOffer.offerId]: 'OK',
            },
          },
        })
      );
    });

    it('/credential-offers should return 200 for multiple offers with linkedCredentials, should ignore wrong link code', async () => {
      const offerDids = ['did:velocity:1', 'did:velocity:2'];
      const linkCodes = map(() => nanoid(160), [0, 0]);
      const offers = await Promise.all(
        mapWithIndex(
          (did, i) =>
            persistOffer({
              tenant,
              exchange,
              did,
              credentialSubjectType: 'PastEmploymentPosition',
              linkCode: linkCodes[i],
              credentialStatus: {
                revokedAt: new Date(),
              },
            }),
          offerDids
        )
      );

      const vendorOffer = {
        ...omit(['linkCode', 'did'], omitForVendorOffer(offers[0])),
        linkedCredentials: [
          { linkedCredentialId: offerDids[0], linkType: 'REPLACE' },
        ],
        offerId: nanoid(),
      };
      const vendorOffer2 = {
        ...omit(['linkCode', 'did'], omitForVendorOffer(offers[1])),
        linkedCredentials: [
          { linkedCredentialId: 'did:velocity:some-did', linkType: 'REPLACE' },
          { linkedCredentialId: offerDids[1], linkType: 'REPLACE' },
        ],
        offerId: nanoid(),
      };

      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint)
        .reply(200, { offers: [vendorOffer, vendorOffer2] });

      const getSchemaNock = nockRegistrarAppSchemaName({ repeatCount: 2 });
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(getSchemaNock.isDone()).toEqual(true);
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          {
            ...buildCredentialSubjectWithSchemaDefaults({
              offer: vendorOffer,
              exchange,
              tenant,
            }),
            linkedCredentials: [
              {
                linkType: 'REPLACE',
                linkCode: linkCodes[0],
              },
            ],
          },
          {
            ...buildCredentialSubjectWithSchemaDefaults({
              offer: vendorOffer2,
              exchange,
              tenant,
            }),
            linkedCredentials: [
              {
                linkType: 'REPLACE',
                linkCode: linkCodes[1],
              },
            ],
          },
        ],
        challenge: expect.any(String),
      });
      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: map('id', response.json.offers),
          overrides: {
            vendorOfferStatuses: {
              [vendorOffer.offerId]: 'OK',
              [vendorOffer2.offerId]: 'OK',
            },
          },
        })
      );
    });

    it('/credential-offers should return all non expired offers associated with vendor', async () => {
      const offer1 = await newVendorOffer({ tenant, exchange });
      const offer2 = await newVendorOffer({
        tenant,
        exchange,
        offerExpirationDate: new Date('2021-08-04T21:13:32.019Z'),
      });
      const webhookNock = await nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, () => true)
        .reply(200, { offers: [offer1, offer2] });

      const getSchemaNock = nockRegistrarAppSchemaName();
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(webhookNock.isDone()).toEqual(true);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({
            offer: offer1,
            exchange,
            tenant,
          }),
        ],
        challenge: expect.any(String),
      });
      expect(getSchemaNock.isDone()).toEqual(true);
      expect(await offersRepo.count({})).toEqual(1);
    });

    it('/credential-offers should return only unique offers', async () => {
      const vendorOffer = await newOffer({
        tenant,
        exchange,
        type: ['EducationDegree'],
        credentialSubject: educationDegreeCredentialSubject(user),
      });

      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, () => true)
        .reply(200, { offers: [omitForVendorOffer(vendorOffer)] });

      const getSchemaNock = nockRegistrarAppSchemaName({
        schemaName: 'education-degree',
        credentialType: 'EducationDegree',
        responseJson: {
          ...require('../combined/schemas/will-always-validate.json'),
          $id: 'education-degree',
        },
      });

      const persistedOffer = await persistOffer({
        exchange,
        tenant,
        type: ['EducationDegree'],
        credentialSubject: {
          ...educationDegreeCredentialSubject(user),
          school: 'did:ethr:a-new-school',
          schoolName: {
            localized: {
              en: 'New School Univerity',
            },
          },
        },
      });

      // persisted duplicate offer that should be ignored by system
      await persistOffer({
        exchange,
        tenant,
        type: ['EducationDegree'],
        credentialSubject: educationDegreeCredentialSubject(user),
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['EducationDegree'],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: expect.arrayContaining(
          map(offerResponseExpectation, [
            omit(['issuer.type'], vendorOffer),
            persistedOffer,
          ])
        ),
        challenge: expect.any(String),
      });

      expect(
        await exchangeRepo.findById(exchange._id, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: map('id', response.json.offers),
          overrides: {
            vendorOfferStatuses: {
              [vendorOffer.offerId]: 'OK',
            },
          },
        })
      );

      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/credential-offers should return nothing if everything is a duplicate', async () => {
      const getSchemaNock = nockRegistrarAppSchemaName({
        schemaName: 'education-degree',
        credentialType: 'EducationDegree',
        responseJson: require('../combined/schemas/education-degree.schema.json'),
      });
      const vendorOffer = await newOffer({
        tenant,
        exchange,
        type: ['EducationDegree'],
        credentialSubject: educationDegreeCredentialSubject(user),
      });
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, () => true)
        .reply(200, { offers: [omitForVendorOffer(vendorOffer)] });

      const persistedOffer = await persistOffer({
        exchange,
        tenant,
        type: ['EducationDegree'],
        credentialSubject: {
          ...educationDegreeCredentialSubject(user),
          school: 'did:ethr:a-new-school',
          schoolName: {
            localized: {
              en: 'New School Univerity',
            },
          },
        },
      });

      // persisted duplicate offer that should be ignored by system
      await persistOffer({
        exchange,
        tenant,
        type: ['EducationDegree'],
        credentialSubject: {
          ...educationDegreeCredentialSubject(user),
          type: 'EducationDegree',
        },
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['EducationDegree'],
          offerHashes: [
            persistedOffer.contentHash.value,
            hashOffer({
              ...vendorOffer,
              credentialSubject: {
                ...vendorOffer.credentialSubject,
                type: 'EducationDegree',
              },
            }),
          ],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [],
      });

      expect(
        await exchangeRepo.findById(exchange._id, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: map('id', response.json.offers),
          overrides: {
            vendorOfferStatuses: {
              [vendorOffer.offerId]: 'Duplicate',
            },
          },
        })
      );
      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/credential-offers should return challenge of vnf protocol version is >= 2', async () => {
      const vendorOffer = await newOffer({
        tenant,
        exchange,
        type: ['EducationDegree'],
        credentialSubject: educationDegreeCredentialSubject(user),
      });

      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, () => true)
        .reply(200, { offers: [omitForVendorOffer(vendorOffer)] });

      const getSchemaNock = nockRegistrarAppSchemaName({
        schemaName: 'education-degree',
        credentialType: 'EducationDegree',
        responseJson: {
          ...require('../combined/schemas/will-always-validate.json'),
          $id: 'education-degree',
        },
      });

      const persistedOffer = await persistOffer({
        exchange,
        tenant,
        type: ['EducationDegree'],
        credentialSubject: {
          ...educationDegreeCredentialSubject(user),
          school: 'did:ethr:a-new-school',
          schoolName: {
            localized: {
              en: 'New School Univerity',
            },
          },
        },
        issuer: {
          id: tenant.did,
          type: ['Issuer'],
          name: 'mock',
          image: 'mock',
          badProperty: 'should be ignored',
        },
      });

      // persisted duplicate offer that should be ignored by system
      await persistOffer({
        exchange,
        tenant,
        type: ['EducationDegree'],
        credentialSubject: educationDegreeCredentialSubject(user),
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['EducationDegree'],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
          'x-vnf-protocol-version': '2',
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        challenge: expect.any(String),
        offers: expect.arrayContaining(
          map(offerResponseExpectation, [
            omit(['issuer.type'], vendorOffer),
            omit(['issuer.badProperty'], persistedOffer),
          ])
        ),
      });
      const exchangeFromDb = await exchangeRepo.findById(
        exchange._id,
        exchangeRepoDefaultProjection
      );
      expect(exchangeFromDb).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: map('id', response.json.offers),
          overrides: {
            vendorOfferStatuses: {
              [vendorOffer.offerId]: 'OK',
            },
            challenge: expect.any(String),
            challengeIssuedAt: expect.any(Number),
          },
        })
      );
      expect(exchangeFromDb.challenge).toHaveLength(16);
      expect(exchangeFromDb.challengeIssuedAt).toBeLessThanOrEqual(
        getUnixTime(new Date())
      );
      expect(exchangeFromDb.challengeIssuedAt).toBeGreaterThan(
        getUnixTime(new Date()) - 5
      );
      expect(getSchemaNock.isDone()).toEqual(true);
    });

    it('/credential-offers should return 200 if vendor offer statuses OK', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        offerType: 'ALL',
        enableOfferValidation: true,
        errorOnInvalidWebhookOffers: true,
      });
      const getSchemaNock = nockRegistrarAppSchemaName();

      const webhookUrl = 'https://customUrl.com';
      const customTenant = await persistTenant({ webhookUrl });
      const customDisclosure = await persistDisclosure({
        tenant: customTenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      });

      const customExchange = await persistOfferExchange({
        tenant: customTenant,
        disclosure: customDisclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.IDENTIFIED,
            timestamp: new Date(),
          },
        ],
      });

      await persistKey({
        tenant: customTenant,
        kidFragment: '#ID2',
        keyPair,
      });

      const customUser = await persistVendorUserIdMapping({
        tenant: customTenant,
      });
      const customAuthToken = await genAuthToken(
        customTenant,
        customExchange,
        customUser
      );

      const offer = await newVendorOffer({
        tenant: customTenant,
        exchange: customExchange,
        user: customUser,
      });

      nock(webhookUrl)
        .post(requestOffersFromVendorEndpoint)
        .reply(200, { offers: [offer] });

      fastify.cache.clear();
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(customTenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId: customExchange._id,
        },
        headers: {
          authorization: `Bearer ${customAuthToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(customExchange._id) });
      expect(dbExchange.vendorOfferStatuses).toEqual({
        [offer.offerId]: 'OK',
      });
      expect(getSchemaNock.isDone()).toEqual(true);
      expect(fastify.cache.size).toBe(1);
    });

    it('/credential-offers should return the same response after user is authenticated after first token has expired', async () => {
      const offer = await newVendorOffer({ tenant, exchange });
      const expectedResponse = [
        buildCredentialSubjectWithSchemaDefaults({ offer, exchange, tenant }),
      ];

      const getSchemaNock = nockRegistrarAppSchemaName({ repeatCount: 2 });

      let sentBody;
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .times(2)
        .reply(200, { offers: [offer] });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: expectedResponse,
        challenge: expect.any(String),
      });

      const newAuthToken = await genAuthToken(tenant, exchange);
      const response2 = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          types: ['PastEmploymentPosition'],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${newAuthToken}`,
        },
      });

      expect(response2.statusCode).toEqual(200);
      expect(response2.json).toEqual({
        offers: expectedResponse,
        challenge: expect.any(String),
      });

      const dbResult = await mongoDb().collection('offers').countDocuments({});
      expect(dbResult).toEqual(2);
      expect(
        await exchangeRepo.findById(exchange._id, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          exchangeId,
          disclosure,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          offerIds: map('id', response2.json.offers),
          overrides: {
            vendorOfferStatuses: {
              [offer.offerId]: 'OK',
            },
          },
        })
      );
      expect(getSchemaNock.isDone()).toEqual(true);
      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: ['PastEmploymentPosition'],
        vendorUserId: user.vendorUserId,
      });
    });
  });

  describe('/credential-offers OFFERS_TYPE equal LEGACY', () => {
    beforeEach(async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        offerType: 'LEGACY',
        enableOfferValidation: true,
      });
    });

    it('/credential-offers should return only prepared offers if exchange has OFFERS_RECEIVED event', async () => {
      await mongoDb()
        .collection('exchanges')
        .updateOne(
          { _id: new ObjectId(exchangeId) },
          {
            $push: {
              events: {
                $each: [
                  {
                    state: ExchangeStates.OFFERS_RECEIVED,
                    timestamp: new Date(),
                  },
                ],
              },
            },
          }
        );
      const preparedOffer = await persistOffer({
        tenant,
        exchange,
      });

      const getSchemaNock = nockRegistrarAppSchemaName();

      const offer = await newVendorOffer({
        tenant,
        exchange,
        credentialSubjectTitle: 'foo',
      });
      const vendorNock = nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, () => true)
        .reply(200, { offers: [offer] });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          {
            ...omit(
              ['_id', 'createdAt', 'linkCode', 'updatedAt', 'contentHash'],
              preparedOffer
            ),
            credentialSubject: omit(
              ['vendorUserId'],
              preparedOffer.credentialSubject
            ),
            hash: expect.any(String),
            id: expect.stringMatching(OBJECT_ID_FORMAT),
          },
        ],
        challenge: expect.any(String),
      });
      expect(await offersRepo.count({})).toEqual(1);
      expect(getSchemaNock.isDone()).toEqual(false);
      expect(vendorNock.isDone()).toEqual(false);
    });

    it('/credential-offers should return prepared and mockvendor offers if exchange has not OFFERS_RECEIVED event', async () => {
      const preparedOffer = await persistOffer({
        tenant,
        exchange,
        credentialSubject: {
          vendorUserId: user.vendorUserId,
          company: tenant.did,
          companyName: {
            localized: {
              en: 'Velocity test',
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
      });

      const offer = await newOffer({
        tenant,
        exchange,
      });
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, () => true)
        .reply(200, { offers: [omitForVendorOffer(offer)] });

      const getSchemaNock = nockRegistrarAppSchemaName();
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['PastEmploymentPosition'],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);

      expect(response.json).toEqual({
        offers: [
          offerResponseExpectation(buildCredentialSubjectWithType(offer)),
          offerResponseExpectation(preparedOffer),
        ],
        challenge: expect.any(String),
      });
      expect(getSchemaNock.isDone()).toEqual(true);
      expect(await offersRepo.count({})).toEqual(2);
    });

    it('/credential-offers should return only offers related to exchange', async () => {
      const newExchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.IDENTIFIED,
            timestamp: new Date(),
          },
        ],
      });
      await persistOffer({
        tenant,
        exchange: newExchange,
      });
      await persistOffer({
        tenant,
        exchange: newExchange,
      });
      const offer = await persistOffer({
        tenant,
        exchange,
      });

      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, () => true)
        .reply(200, { offers: [] });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['PastEmploymentPosition'],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [offerResponseExpectation(offer)],
        challenge: expect.any(String),
      });
      expect(
        await mongoDb()
          .collection('offers')
          .countDocuments({ _id: { $exists: true } })
      ).toEqual(3);
    });

    it('/credential-offers should return only offers related to exchange when exchange has OFFERS_RECEIVED event', async () => {
      await mongoDb()
        .collection('exchanges')
        .updateOne(
          { _id: new ObjectId(exchangeId) },
          {
            $push: {
              events: {
                $each: [
                  {
                    state: ExchangeStates.OFFERS_RECEIVED,
                    timestamp: new Date(),
                  },
                ],
              },
            },
          }
        );

      const newExchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.IDENTIFIED,
            timestamp: new Date(),
          },
        ],
      });
      await persistOffer({
        tenant,
        exchange: newExchange,
      });
      await persistOffer({
        tenant,
        exchange: newExchange,
      });
      const offer = await persistOffer({
        tenant,
        exchange,
      });

      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, () => true)
        .reply(200, { offers: [] });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId,
          types: ['PastEmploymentPosition'],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [offerResponseExpectation(offer)],
        challenge: expect.any(String),
      });
      expect(
        await mongoDb()
          .collection('offers')
          .countDocuments({ _id: { $exists: true } })
      ).toEqual(3);
    });
  });

  describe('/credential-offers disclosure offer mode preloaded', () => {
    beforeEach(async () => {
      tenant = await persistTenant({
        webhookUrl: mockVendorUrl,
      });
      await persistKey({
        tenant,
        kidFragment: '#ID2',
        keyPair,
      });
      user = await persistVendorUserIdMapping({ tenant });
      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        offerMode: 'preloaded',
      });
      exchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.OFFERS_RECEIVED,
            timestamp: new Date(),
          },
        ],
      });
      exchangeId = exchange._id;
      authToken = await genAuthToken(tenant, exchange);
    });

    it('should return all offers for vendor and not filter by exchange', async () => {
      expect(disclosure.offerMode).toEqual('preloaded');
      let sentBody;
      const otherExchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.OFFERS_RECEIVED,
            timestamp: new Date(),
          },
        ],
      });
      const offer1 = await persistOffer({ tenant, exchange, user });
      const offer2 = await persistOffer({
        tenant,
        exchange: otherExchange,
        user,
        type: ['EducationDegree'],
        credentialSubject: educationDegreeCredentialSubject(user),
      });
      authToken = await genAuthToken(tenant, otherExchange);

      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, { offers: [] });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId: otherExchange._id,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json.offers.length).toEqual(2);
      expect(response.json).toEqual({
        offers: expect.arrayContaining(
          map(offerResponseExpectation, [offer2, offer1])
        ),
        challenge: expect.any(String),
      });
      expect(sentBody).toEqual(undefined);
    });
  });

  describe('/credential-offers disclosure offer mode webhook', () => {
    let getSchemaNock;
    beforeEach(async () => {
      tenant = await persistTenant({
        webhookUrl: mockVendorUrl,
      });
      exchangeRepo = initExchangeRepo(fastify)({
        log: fastify.log,
        config: fastify.config,
        tenant: { ...tenant, _id: new ObjectId(tenant._id) },
      });
      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        offerMode: 'webhook',
      });
      await persistKey({
        tenant,
        kidFragment: '#ID2',
        keyPair,
      });
      user = await persistVendorUserIdMapping({ tenant });
      getSchemaNock = nockRegistrarAppSchemaName();
    });

    it('should return offers by specific exchange and skip prepared offers if exchange has not OFFER_RECEIVED', async () => {
      let sentBody;
      exchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [{ state: ExchangeStates.NEW, timestamp: new Date() }],
      });
      exchangeId = exchange._id;
      authToken = await genAuthToken(tenant, exchange);
      await persistOffer({
        tenant,
        exchange,
        user,
        credentialSubject: {
          vendorUserId: user.vendorUserId,
          company: tenant.did,
          companyName: {
            localized: {
              en: 'TEST OTHER ORG',
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
      });
      const offer2 = await newVendorOffer({ tenant, exchange, user });
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, { offers: [offer2] });

      authToken = await genAuthToken(tenant, exchange);
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId: exchange._id,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({
            offer: offer2,
            exchange,
            tenant,
          }),
        ],
        challenge: expect.any(String),
      });

      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: [],
        vendorUserId: user.vendorUserId,
      });
    });

    it('should return a open badge v3 credential', async () => {
      exchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [{ state: ExchangeStates.NEW, timestamp: new Date() }],
      });
      exchangeId = exchange._id;
      authToken = await genAuthToken(tenant, exchange);

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

      const openBadgeCredentialOffer = omit(
        ['issuer', 'contentHash'],
        await newOffer(openBadgeCredentialExample)
      );
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint)
        .reply(200, { offers: [openBadgeCredentialOffer] });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId: exchange._id,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({
            offer: omit(['contentHash'], openBadgeCredentialOffer),
            exchange,
            tenant,
            type: 'AchievementSubject',
          }),
        ],
        challenge: expect.any(String),
      });
    });

    it('should return vendor and prepared offers if exchange has OFFER_RECEIVED', async () => {
      let sentBody;
      exchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.OFFERS_RECEIVED,
            timestamp: new Date(),
          },
        ],
      });
      exchangeId = exchange._id;
      authToken = await genAuthToken(tenant, exchange);
      const offer1 = await persistOffer({
        tenant,
        exchange,
        user,
        credentialSubject: {
          type: 'PastEmploymentPosition',
          vendorUserId: user.vendorUserId,
          company: tenant.did,
          companyName: {
            localized: {
              en: 'TEST OTHER ORG',
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
      });
      const offer2 = await newVendorOffer({ tenant, exchange, user });
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, { offers: [offer2] });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId: exchange._id,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({
            offer: offer2,
            exchange,
            tenant,
          }),
          offerResponseExpectation(offer1),
        ],
        challenge: expect.any(String),
      });

      expect(getSchemaNock.isDone()).toEqual(true);

      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: [],
        vendorUserId: user.vendorUserId,
      });
    });

    it('should return vendor offers with relatedResources if exchange has OFFER_RECEIVED', async () => {
      expect(disclosure.offerMode).toEqual('webhook');
      let sentBody;
      exchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.OFFERS_RECEIVED,
            timestamp: new Date(),
          },
        ],
      });
      exchangeId = exchange._id;
      authToken = await genAuthToken(tenant, exchange);

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

      const expectedOffer = await newVendorOffer({
        tenant,
        exchange,
        user,
        replaces,
        relatedResource,
      });
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, {
          offers: [expectedOffer],
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId: exchange._id,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({
            offer: expectedOffer,
            exchange,
            tenant,
            overrides: {
              'relatedResource.0.digestSRI': expect.any(String),
              'relatedResource.0.hint': ['PastEmploymentPosition'],
              'replaces.0.hint': ['PastEmploymentPosition'],
            },
          }),
        ],
        challenge: expect.any(String),
      });

      const offerFromDb = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(response.json.offers[0].id) });

      expect(offerFromDb).toEqual(
        offerExpectation({
          offer: expectedOffer,
          tenant,
          exchange,
          autocleanFinalizedOfferPii: false,
          overrides: {
            'credentialSubject.type': 'PastEmploymentPosition',
            replaces: [
              {
                ...replaces[0],
                hint: credentials[0].type,
              },
            ],
            relatedResource: [
              {
                ...relatedResource[0],
                hint: credentials[1].type,
                digestSRI: credentials[1].digestSRI,
              },
              relatedResource[1],
              relatedResource[2],
            ],
          },
        })
      );

      expect(getSchemaNock.isDone()).toEqual(true);

      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: [],
        vendorUserId: user.vendorUserId,
      });
    });

    it('should not return vendor offers with relatedResources if data invalid', async () => {
      expect(disclosure.offerMode).toEqual('webhook');
      let sentBody;
      exchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.OFFERS_RECEIVED,
            timestamp: new Date(),
          },
        ],
      });
      exchangeId = exchange._id;
      authToken = await genAuthToken(tenant, exchange);
      const offerWebhook = await newVendorOffer({
        tenant,
        exchange,
        user,
        relatedResource: [
          {
            type: 'VC',
          },
        ],
      });
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, {
          offers: [offerWebhook],
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId: exchange._id,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [],
      });

      const dbExchangeResult = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(exchangeId) });
      expect(dbExchangeResult.vendorOfferStatuses).toEqual({
        [offerWebhook.offerId]:
          // eslint-disable-next-line max-len
          "'$'/relatedResource/0 must have required property 'id', '$'/relatedResource/0 must have required property 'offerId', '$'/relatedResource/0 must match exactly one schema in oneOf",
      });

      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: [],
        vendorUserId: user.vendorUserId,
      });
    });

    it('should return offers from webhook with image and name in the issuer field', async () => {
      expect(disclosure.offerMode).toEqual('webhook');
      let sentBody;
      exchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [{ state: ExchangeStates.NEW, timestamp: new Date() }],
      });
      exchangeId = exchange._id;
      authToken = await genAuthToken(tenant, exchange);
      const offer1 = omit(
        [
          '_id',
          'credentialSchema',
          'contentHash',
          'credentialStatus',
          'createdAt',
          'updatedAt',
        ],
        await newOffer({
          tenant,
          exchange,
          user,
          issuer: { type: 'Brand', image: 'image', name: 'name' },
        })
      );
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, { offers: [offer1] });

      authToken = await genAuthToken(tenant, exchange);
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId: exchange._id,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          {
            ...buildCredentialSubjectWithSchemaDefaults({
              offer: offer1,
              exchange,
              tenant,
            }),
            issuer: {
              type: 'Brand',
              image: 'image',
              name: 'name',
              id: tenant.did,
            },
          },
        ],
        challenge: expect.any(String),
      });

      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: [],
        vendorUserId: user.vendorUserId,
      });
    });

    it('should return vendor offers with valid commercial entity', async () => {
      expect(disclosure.offerMode).toEqual('webhook');
      let sentBody;
      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        offerMode: 'webhook',
        commercialEntityName: 'Test Commercial Entity',
        commercialEntityLogo: 'Test Commercial Entity Logo',
      });
      exchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.OFFERS_RECEIVED,
            timestamp: new Date(),
          },
        ],
      });
      exchangeId = exchange._id;
      authToken = await genAuthToken(tenant, exchange);
      const offer2 = await newVendorOffer({
        tenant,
        exchange,
        user,
      });
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, {
          offers: [
            {
              ...offer2,
              issuer: {
                id: tenant.did,
                name: 'Test Commercial Entity',
                image: 'Test Commercial Entity Logo',
              },
            },
          ],
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId: exchange._id,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          buildCredentialSubjectWithSchemaDefaults({
            offer: offer2,
            exchange,
            tenant,
            commercialEntity: {
              name: 'Test Commercial Entity',
              image: 'Test Commercial Entity Logo',
            },
          }),
        ],
        challenge: expect.any(String),
      });

      const dbOfferResult = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(response.json.offers[0].id) });
      expect(dbOfferResult).toEqual(
        offerExpectation({
          offer: buildCredentialSubjectWithType(offer2),
          tenant,
          autocleanFinalizedOfferPii: false,
          overrides: {
            issuer: {
              id: tenant.did,
              name: 'Test Commercial Entity',
              image: 'Test Commercial Entity Logo',
            },
          },
        })
      );

      expect(getSchemaNock.isDone()).toEqual(true);

      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: [],
        vendorUserId: user.vendorUserId,
      });
    });

    it('should not return vendor offers with invalid commercial entity', async () => {
      expect(disclosure.offerMode).toEqual('webhook');
      let sentBody;
      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        offerMode: 'webhook',
        commercialEntityName: 'Test Commercial Entity',
        commercialEntityLogo: 'Test Commercial Entity Logo',
      });
      exchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.OFFERS_RECEIVED,
            timestamp: new Date(),
          },
        ],
      });
      exchangeId = exchange._id;
      authToken = await genAuthToken(tenant, exchange);
      const offer2 = await newVendorOffer({
        tenant,
        exchange,
        user,
      });
      nock(mockVendorUrl)
        .post(requestOffersFromVendorEndpoint, (body) => {
          sentBody = body;
          return true;
        })
        .reply(200, {
          offers: [
            {
              ...offer2,
              issuer: {
                id: tenant.did,
                name: 'foo',
                image: 'foo',
              },
            },
          ],
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'credential-offers'),
        payload: {
          exchangeId: exchange._id,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [],
      });

      const dbExchangeAfterResponse = await exchangeRepo.findById(
        exchange._id,
        exchangeRepoDefaultProjection
      );
      expect(dbExchangeAfterResponse).toEqual(
        exchangeExpectation({
          user,
          exchangeId,
          disclosure,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.OFFERS_RECEIVED,
            ExchangeStates.OFFERS_REQUESTED,
            ExchangeStates.OFFERS_SENT,
          ],
          overrides: {
            vendorOfferStatuses: {
              [offer2.offerId]: 'Invalid commercial entity',
            },
          },
        })
      );

      expect(getSchemaNock.isDone()).toEqual(false);

      expect(sentBody).toEqual({
        exchangeId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        types: [],
        vendorUserId: user.vendorUserId,
      });
    });
  });

  describe('/finalize-offers', () => {
    let offer0;

    const persistFinalizableOffer = (overrides = {}) =>
      persistOffer({
        tenant,
        exchange,
        linkCode: nanoid(),
        linkCodeCommitment: {
          type: 'VelocityCredentialLinkCodeCommitment2022',
          value: 'Ab1/2oe34P5',
        },
        validFrom: new Date(),
        ...overrides,
      });

    beforeEach(async () => {
      await exchangeRepo.update(exchangeId, {
        vendorUserId: user.vendorUserId,
        challenge: 'challenge',
        challengeIssuedAt: 12341,
      });
      nockCredentialTypes();
      offer0 = await persistFinalizableOffer({
        credentialSchemaContext: 'https://lib.test/contexts/education-degree',
      });
    });

    it('/finalize-offers should return 401 when not authorized', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
        },
      });
      expect(response.statusCode).toEqual(401);
    });

    it('/finalize-offers should return 401 when not authorized', async () => {
      const expiredToken =
        // eslint-disable-next-line max-len
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJqdGkiOiI2NTVlNTU0ZGIzZmMyZTAxOTY0MjM1ODgiLCJpc3MiOiJkaWQ6dmVsb2NpdHk6dTZiaDVnY3FlaWp6dzhyN2NmMTdjcWZ6bGx5NjY3OHlqbWoyZGZxbCIsImF1ZCI6ImRpZDp2ZWxvY2l0eTp1NmJoNWdjcWVpanp3OHI3Y2YxN2NxZnpsbHk2Njc4eWptajJkZnFsIiwiZXhwIjoxNzAwNjgxMDM4LCJzdWIiOiI2NTVlNTU0ZGIzZmMyZTAxOTY0MjM1ODkiLCJpYXQiOjE3MDA2ODEwMzd9.926fW24mtr-XnzfKjOB3RdADGAztMJxAP_9psaE4OYeJ-T6jD_OReNwV9JOI-5QkjJ6mmqWOGqzQIOfebOpf6A';
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });
      expect(response.statusCode).toEqual(401);
    });

    it('/finalize-offers should return 400 when no exchangeId', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {},
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(400);
    });

    it('/finalize-offers should 200 when acceptedOffers and rejectedOffers are missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual([]);
    });

    it('/finalize-offers should 400 when exchange is completed', async () => {
      const emptyExchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.COMPLETE,
            timestamp: new Date(),
          },
          {
            state: ExchangeStates.OFFERS_SENT,
            timestamp: new Date(),
          },
        ],
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId: emptyExchange._id,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'exchange_invalid',
          message: `Exchange ${emptyExchange._id} is in an invalid state`,
          statusCode: 400,
        })
      );
    });

    it('/finalize-offers should 400 when exchangeId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {},
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(400);
    });

    it('/finalize-offers should 400 when approving an offer that has already been rejected', async () => {
      const offer1 = await persistOffer({
        tenant,
        exchange,
        rejectedAt: new Date(),
      });
      const offer2 = await persistOffer({ tenant, exchange });
      await updateExchangeOffersIds(
        exchangeId,
        [offer1._id, offer2._id],
        [offer1._id]
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
          approvedOfferIds: [offer1._id],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json.message).toEqual(
        `offer ${offer1._id} has already been rejected`
      );

      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
            ExchangeStates.UNEXPECTED_ERROR,
          ],
          offerIds: [offer1._id, offer2._id],
          overrides: {
            finalizedOfferIds: mapToObjectId([offer1._id]),
            err: `offer ${offer1._id} has already been rejected`,
          },
        })
      );
    });

    it('/finalize-offers should 200 when rejecting an offer that has already been approved', async () => {
      const offer1 = await persistOffer({
        tenant,
        exchange,
        consentedAt: new Date(),
      });
      await wait(25);
      const offer2 = await persistOffer({ tenant, exchange });
      await updateExchangeOffersIds(
        exchangeId,
        [offer1._id, offer2._id],
        [offer1._id]
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
          rejectedOfferIds: [offer1._id],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual([]);

      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
          ],
          offerIds: [offer1._id, offer2._id],
          overrides: {
            finalizedOfferIds: mapToObjectId([offer1._id, offer1._id]),
          },
        })
      );
    });

    it('/finalize-offers should 404 when exchangeId is does not exist', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId: new ObjectId(),
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(404);
    });

    it('/finalize-offers should approve offer from approvedOfferIds payload array', async () => {
      await updateExchangeOffersIds(exchangeId, [offer0._id]);
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
          approvedOfferIds: [offer0._id],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toHaveLength(1);
      const vc = jwtDecode(response.json[0]);
      expect(vc).toEqual(
        jwtVcExpectation({
          tenant,
          credentialId: vc.payload.jti,
          offer: offer0,
        })
      );

      const dbOffer1Result = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(offer0._id) });

      expect(dbOffer1Result).toEqual(
        mongoify(
          offerExpectation({
            credentialId: vc.payload.jti,
            offer: offer0,
            tenant,
          })
        )
      );

      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
            ExchangeStates.COMPLETE,
          ],
          offerIds: [offer0._id],
          overrides: {
            finalizedOfferIds: mapToObjectId([offer0._id]),
          },
        })
      );
    });

    it('/finalize-offers should approve and add right @context to credentialSubject based on version of schema', async () => {
      const offer1 = await persistFinalizableOffer({
        offerContext: ['https://schema.org'],
        type: ['EmploymentCurrentV1.0'],
        credentialSchemaContext: ['https://schema.org'],
      });
      const offer2 = await persistFinalizableOffer({
        type: ['EmploymentCurrentV1.1'],
        credentialSchemaContext: ['https://schema.org'],
      });
      const offer3 = await persistFinalizableOffer({
        type: ['EmailV1.0'],
        credentialSchemaContext: ['https://schema.org'],
        credentialSubject: {
          email: 'adam@example.com',
        },
      });

      await updateExchangeOffersIds(exchangeId, [
        offer1._id,
        offer2._id,
        offer3._id,
        offer0._id,
      ]);
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
          approvedOfferIds: [offer1._id, offer2._id, offer3._id, offer0._id],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toHaveLength(4);

      const vcs = map(jwtDecode, response.json);
      expect(vcs).toEqual([
        jwtVcExpectation({
          tenant,
          credentialId: vcs[0].payload.jti,
          offer: offer0,
        }),
        jwtVcExpectation({
          tenant,
          credentialId: vcs[1].payload.jti,
          offer: offer1,
          credentialTypeContext: [
            'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.0.json',
          ],
        }),
        jwtVcExpectation({
          tenant,
          credentialId: vcs[2].payload.jti,
          offer: offer2,
        }),
        jwtVcExpectation({
          tenant,
          credentialId: vcs[3].payload.jti,
          offer: offer3,
          credentialTypeContext: [],
        }),
      ]);
    });

    it('/finalize-offers should approve and add right @context with type string', async () => {
      const offer1 = await persistFinalizableOffer({
        offerContext: ['https://schema.org'],
        type: ['EmploymentCurrentV1.0'],
        credentialSchemaContext: 'https://schema.org',
      });
      const offer2 = await persistFinalizableOffer({
        type: ['EmploymentCurrentV1.1'],
        credentialSchemaContext: 'https://schema.org',
      });
      const offer3 = await persistFinalizableOffer();
      await updateExchangeOffersIds(exchangeId, [
        offer1._id,
        offer2._id,
        offer3._id,
      ]);
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
          approvedOfferIds: [offer1._id, offer2._id, offer3._id],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toHaveLength(3);
      const vcs = map(jwtDecode, response.json);
      expect(vcs).toEqual([
        jwtVcExpectation({
          tenant,
          credentialId: vcs[0].payload.jti,
          offer: offer1,
          credentialTypeContext: [
            'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.0.json',
          ],
        }),
        jwtVcExpectation({
          tenant,
          credentialId: vcs[1].payload.jti,
          offer: offer2,
        }),
        jwtVcExpectation({
          tenant,
          credentialId: vcs[2].payload.jti,
          offer: offer3,
        }),
      ]);
    });

    it('/finalize-offers should approve offer from approvedOfferIds payload array and call triggerOffersAcceptedWebhook', async () => {
      let notificationBody;
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        triggerOffersAcceptedWebhook: true,
      });

      const offers = [
        offer0,
        await persistFinalizableOffer({ type: ['EducationDegree'] }),
      ];

      await updateExchangeOffersIds(exchangeId, map('_id', offers));

      const notificationEndpointScope = nock(mockVendorUrl)
        .post(acceptedOffersNotificationEndpoint, (body) => {
          notificationBody = body;
          return body.issuedCredentials.length === 2;
        })
        .reply(200);

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          approvedOfferIds: [offers[0]._id, offers[1]._id],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toHaveLength(2);
      const jwtVcs = map(jwtDecode, response.json);
      expect(jwtVcs).toEqual(
        mapWithIndex(
          (offer, i) =>
            jwtVcExpectation({
              tenant,
              offer,
              credentialId: jwtVcs[i].payload.jti,
            }),
          offers
        )
      );

      const expectedOffers = mapWithIndex(
        (offer, i) =>
          offerExpectation({
            credentialId: jwtVcs[i].payload.jti,
            offer,
            tenant,
          }),
        offers
      );
      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offers[0]._id) })
      ).toEqual(mongoify(expectedOffers[0]));
      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offers[1]._id) })
      ).toEqual(mongoify(expectedOffers[1]));

      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
            ExchangeStates.COMPLETE,
          ],
          offerIds: map('_id', offers),
          overrides: {
            finalizedOfferIds: mapToObjectId(map('_id', offers)),
          },
        })
      );

      notificationEndpointScope.done();

      expect(notificationBody).toEqual({
        tenantDID: tenant.did,
        tenantId: tenant._id,
        vendorOrganizationId: tenant.vendorOrganizationId,
        exchangeId,
        issuedCredentials: map(
          (expectedOffer) =>
            jsonify(
              {
                ...omit(
                  ['credentialSubject', 'did', 'tenantId', 'digestSRI'],
                  expectedOffer
                ),
                _id: expectedOffer._id.toString(),
                consentedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
                updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
                credentialSubject: {
                  vendorUserId: get(
                    'credentialSubject.vendorUserId',
                    expectedOffer
                  ),
                },
                id: expectedOffer.did,
              },
              false
            ),
          expectedOffers
        ),
      });
      fastify.resetOverrides();
    });

    it('/finalize-offers should issued credential and call triggerOffersAcceptedWebhook with the "issued" claim', async () => {
      let notificationBody;
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        triggerOffersAcceptedWebhook: true,
        vendorCredentialsIncludeIssuedClaim: true,
      });

      const offers = [
        offer0,
        await persistFinalizableOffer({ type: ['EducationDegree'] }),
      ];

      await updateExchangeOffersIds(exchangeId, map('_id', offers));

      const notificationEndpointScope = nock(mockVendorUrl)
        .post(acceptedOffersNotificationEndpoint, (body) => {
          notificationBody = body;
          return body.issuedCredentials.length === 2;
        })
        .reply(200);

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          approvedOfferIds: [offers[0]._id, offers[1]._id],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toHaveLength(2);
      const jwtVcs = map(jwtDecode, response.json);
      expect(jwtVcs).toEqual(
        mapWithIndex(
          (offer, i) =>
            jwtVcExpectation({
              tenant,
              offer,
              credentialId: jwtVcs[i].payload.jti,
            }),
          offers
        )
      );

      const expectedOffers = mapWithIndex(
        (offer, i) =>
          offerExpectation({
            credentialId: jwtVcs[i].payload.jti,
            offer,
            tenant,
          }),
        offers
      );
      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offers[0]._id) })
      ).toEqual(mongoify(expectedOffers[0]));
      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offers[1]._id) })
      ).toEqual(mongoify(expectedOffers[1]));

      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
            ExchangeStates.COMPLETE,
          ],
          offerIds: map('_id', offers),
          overrides: {
            finalizedOfferIds: mapToObjectId(map('_id', offers)),
          },
        })
      );

      notificationEndpointScope.done();

      expect(notificationBody).toEqual({
        tenantDID: tenant.did,
        tenantId: tenant._id,
        vendorOrganizationId: tenant.vendorOrganizationId,
        exchangeId,
        issuedCredentials: map(
          (expectedOffer) =>
            jsonify(
              {
                ...omit(
                  ['credentialSubject', 'did', 'tenantId', 'digestSRI'],
                  expectedOffer
                ),
                issued: expect.stringMatching(ISO_DATETIME_FORMAT),
                _id: expectedOffer._id.toString(),
                consentedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
                updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
                credentialSubject: {
                  vendorUserId: get(
                    'credentialSubject.vendorUserId',
                    expectedOffer
                  ),
                },
                id: expectedOffer.did,
              },
              false
            ),
          expectedOffers
        ),
      });
      fastify.resetOverrides();
    });

    it('/finalize-offers should approve and call triggerOffersAcceptedWebhook with related resource data', async () => {
      let notificationBody;
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        triggerOffersAcceptedWebhook: true,
      });

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

      const replaces = [
        {
          id: credentialIds[0],
          hint: credentials[0].type,
        },
      ];

      const relatedResource = [
        {
          id: credentialIds[1],
          type: 'RelatedType',
          hint: credentials[1].type,
          digestSRI: credentials[1].digestSRI,
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

      const offers = [
        await persistFinalizableOffer({
          relatedResource,
          replaces,
        }),
      ];

      await updateExchangeOffersIds(exchangeId, map('_id', offers));

      const notificationEndpointScope = nock(mockVendorUrl)
        .post(acceptedOffersNotificationEndpoint, (body) => {
          notificationBody = body;
          return body.issuedCredentials.length === 1;
        })
        .reply(200);

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          approvedOfferIds: [offers[0]._id],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toHaveLength(1);
      const jwtVcs = map(jwtDecode, response.json);
      expect(jwtVcs).toEqual(
        mapWithIndex(
          (offer, i) =>
            jwtVcExpectation({
              tenant,
              offer,
              credentialId: jwtVcs[i].payload.jti,
            }),
          offers
        )
      );

      const expectedOffers = mapWithIndex(
        (offer, i) =>
          offerExpectation({
            credentialId: jwtVcs[i].payload.jti,
            offer,
            tenant,
          }),
        offers
      );
      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offers[0]._id) })
      ).toEqual(mongoify(expectedOffers[0]));

      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
            ExchangeStates.COMPLETE,
          ],
          offerIds: map('_id', offers),
          overrides: {
            finalizedOfferIds: mapToObjectId(map('_id', offers)),
          },
        })
      );

      notificationEndpointScope.done();

      expect(notificationBody).toEqual({
        tenantDID: tenant.did,
        tenantId: tenant._id,
        vendorOrganizationId: tenant.vendorOrganizationId,
        exchangeId,
        issuedCredentials: map(
          (expectedOffer) =>
            jsonify(
              {
                ...omit(
                  ['credentialSubject', 'did', 'tenantId', 'digestSRI'],
                  expectedOffer
                ),
                _id: expectedOffer._id.toString(),
                consentedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
                updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
                credentialSubject: {
                  vendorUserId: get(
                    'credentialSubject.vendorUserId',
                    expectedOffer
                  ),
                },
                id: expectedOffer.did,
              },
              false
            ),
          expectedOffers
        ),
      });
      fastify.resetOverrides();
    }, 10000);

    it('/finalize-offers should call a custom webhook from tenant', async () => {
      const webhookUrl = 'https://customurl.com';
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        triggerOffersAcceptedWebhook: true,
      });

      await tenantRepo.update(tenant._id, { webhookUrl });

      const offers = [
        await persistOffer({ tenant, exchange }),
        await persistOffer({ tenant, exchange, type: ['EducationDegree'] }),
      ];

      await updateExchangeOffersIds(exchangeId, map('_id', offers));

      const nockWeb = nock(webhookUrl)
        .post(acceptedOffersNotificationEndpoint)
        .reply(200);

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          approvedOfferIds: [offers[0]._id, offers[1]._id],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      nockWeb.done();

      expect(response.statusCode).toEqual(200);
      expect(nockWeb.isDone()).toEqual(true);
    });

    it('/finalize-offers should not add any auth header to call a custom webhook if there is no token in config', async () => {
      const webhookUrl = 'https://customurl.com';
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        triggerOffersAcceptedWebhook: true,
        bearerToken: false,
      });

      await tenantRepo.update(tenant._id, {
        webhookUrl,
      });
      const offers = [
        await persistOffer({ tenant, exchange }),
        await persistOffer({ tenant, exchange, type: ['EducationDegree'] }),
      ];

      await updateExchangeOffersIds(exchangeId, map('_id', offers));
      let identityWebhookHeaders;

      const nockWeb = nock(webhookUrl)
        .post(acceptedOffersNotificationEndpoint)

        // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
        .reply(200, function () {
          identityWebhookHeaders = this.req.headers;
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          approvedOfferIds: [offers[0]._id, offers[1]._id],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      nockWeb.done();

      expect(response.statusCode).toEqual(200);
      expect(nockWeb.isDone()).toEqual(true);
      expect(identityWebhookHeaders.authorization).toBeUndefined();
    });

    it('/finalize-offers should call a custom webhook from tenant with custom token', async () => {
      const webhookUrl = 'https://customurl.com';
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        triggerOffersAcceptedWebhook: true,
      });

      await tenantRepo.update(tenant._id, {
        webhookUrl,
        webhookAuth: {
          type: 'bearer',
          bearerToken: 'secret',
        },
      });

      const offers = [
        await persistOffer({ tenant, exchange }),
        await persistOffer({ tenant, exchange, type: ['EducationDegree'] }),
      ];

      await updateExchangeOffersIds(exchangeId, map('_id', offers));
      let identityWebhookHeaders;

      const nockWeb = nock(webhookUrl)
        .post(acceptedOffersNotificationEndpoint)

        // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
        .reply(200, function () {
          identityWebhookHeaders = this.req.headers;
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          approvedOfferIds: [offers[0]._id, offers[1]._id],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      nockWeb.done();

      expect(response.statusCode).toEqual(200);
      expect(nockWeb.isDone()).toEqual(true);
      expect(identityWebhookHeaders.authorization).toEqual('Bearer secret');
    });

    it('/finalize-offers should approve offer from approvedOfferIds payload array and call triggerOffersAcceptedWebhook with an error', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        triggerOffersAcceptedWebhook: true,
      });

      const notificationEndpointScope = nock(mockVendorUrl)
        .post(acceptedOffersNotificationEndpoint)
        .reply(500);

      const offers = [
        offer0,
        await persistFinalizableOffer({ type: ['EducationDegree'] }),
      ];

      await updateExchangeOffersIds(exchangeId, map('_id', offers));

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          approvedOfferIds: [offers[0]._id, offers[1]._id],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toHaveLength(2);
      const jwtVcs = map(jwtDecode, response.json);
      expect(jwtVcs).toEqual(
        mapWithIndex(
          (offer, i) =>
            jwtVcExpectation({
              tenant,
              offer,
              credentialId: jwtVcs[i].payload.jti,
            }),
          offers
        )
      );

      const expectedOffers = mapWithIndex(
        (offer, i) =>
          offerExpectation({
            credentialId: jwtVcs[i].payload.jti,
            offer,
            tenant,
          }),
        offers
      );
      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offers[0]._id) })
      ).toEqual(mongoify(expectedOffers[0]));
      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offers[1]._id) })
      ).toEqual(mongoify(expectedOffers[1]));

      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
            ExchangeStates.COMPLETE,
          ],
          offerIds: map('_id', offers),
          overrides: {
            finalizedOfferIds: mapToObjectId(map('_id', offers)),
          },
        })
      );

      notificationEndpointScope.done();

      fastify.resetOverrides();
    });

    it('/finalize-offers should approve offer and encode name, image of issuer', async () => {
      const offer = await persistFinalizableOffer({
        issuer: {
          id: tenant.did,
          name: 'a name',
          image: 'a image',
        },
      });

      await updateExchangeOffersIds(exchangeId, [offer._id]);

      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          approvedOfferIds: [offer._id],
          exchangeId,
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      expect(response.statusCode).toEqual(200);
      const jwtVcs = map(jwtDecode, response.json);
      expect(jwtVcs).toEqual([
        jwtVcExpectation({
          tenant,
          offer,
          credentialId: jwtVcs[0].payload.jti,
          issuer: {
            id: tenant.did,
            name: 'a name',
            image: 'a image',
          },
        }),
      ]);

      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offer._id) })
      ).toEqual(
        mongoify(
          offerExpectation({
            credentialId: jwtVcs[0].payload.jti,
            offer,
            tenant,
          })
        )
      );

      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
            ExchangeStates.COMPLETE,
          ],
          offerIds: [new ObjectId(offer._id)],
          overrides: {
            finalizedOfferIds: [new ObjectId(offer._id)],
          },
        })
      );
    });

    it('/finalize-offers should reject offer from rejectedOfferIds payload array', async () => {
      await updateExchangeOffersIds(exchangeId, [offer0._id]);
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
          rejectedOfferIds: [offer0._id],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual([]);
      const dbOffer1Result = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(offer0._id) });
      expect(dbOffer1Result).toEqual(
        mongoify({
          ...offerExpectation({ offer: offer0, tenant }),
          rejectedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
            ExchangeStates.COMPLETE,
          ],
          offerIds: [offer0._id],
          overrides: {
            finalizedOfferIds: mapToObjectId([offer0._id]),
          },
        })
      );
    });

    it('/finalize-offers should add exchange state of CLAIMING_IN_PROGRESS if there are still offers to be approved or rejected', async () => {
      const offer2 = await persistFinalizableOffer({
        tenant,
        exchange,
      });
      await updateExchangeOffersIds(exchangeId, map('_id', [offer0, offer2]));
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
          rejectedOfferIds: [offer0._id],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);

      const dbOffer0Result = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(offer0._id) });
      expect(dbOffer0Result).toEqual(
        {
          ...offerExpectation({ offer: offer0, tenant }),
          rejectedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }
        // })
      );

      const dbOffer2Result = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(offer2._id) });
      expect(dbOffer2Result).toEqual(
        offerExpectation({
          offer: offer2,
          tenant,
          autocleanFinalizedOfferPii: false,
        })
      );
      const dbexchangesResult = await exchangeRepo.findById(exchangeId);
      expect(dbexchangesResult).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
          ],
          offerIds: mapToObjectId([offer0._id, offer2._id]),
          overrides: {
            finalizedOfferIds: mapToObjectId([offer0._id]),
          },
        })
      );
    });

    it('/finalize-offers should add exchange state of COMPLETE if there are no more offers to be approved or rejected', async () => {
      const offers = await Promise.all([
        offer0,
        persistFinalizableOffer({
          tenant,
          exchange,
        }),
        persistFinalizableOffer({
          tenant,
          exchange,
        }),
      ]);

      await updateExchangeOffersIds(exchangeId, map('_id', offers), [
        offers[0]._id,
      ]);
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
          approvedOfferIds: [offers[1]._id],
          rejectedOfferIds: [offers[2]._id],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      const [vcJwt] = map(jwtDecode, response.json);
      const dbOffer1Result = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(offers[1]._id) });
      expect(dbOffer1Result).toEqual(
        mongoify(
          offerExpectation({
            credentialId: vcJwt.payload.jti,
            offer: offers[1],
            tenant,
          })
        )
      );

      const dbOffer2Result = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(offers[2]._id) });
      expect(dbOffer2Result).toEqual({
        ...offerExpectation({ offer: offers[2], tenant }),
        rejectedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
            ExchangeStates.COMPLETE,
          ],
          offerIds: map('_id', offers),
          overrides: {
            finalizedOfferIds: mapToObjectId(map('_id', offers)),
          },
        })
      );
    });

    it('/finalize-offers should not processing offer if not includes in offer ids of exchange and return 200', async () => {
      const offer1 = await persistOffer({ tenant, exchange });
      await updateExchangeOffersIds(exchangeId, [offer1._id]);
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
          approvedOfferIds: [offer0._id],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toHaveLength(0);

      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
          ],
          offerIds: [offer1._id],
          overrides: {
            finalizedOfferIds: [],
          },
        })
      );
    });

    it('/finalize-offers should remove credentialSubject details from offer if autocleanFinalizedOfferPii is true', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        autocleanFinalizedOfferPii: true,
      });

      await updateExchangeOffersIds(exchangeId, [offer0._id]);
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
          approvedOfferIds: [offer0._id],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      const credential = jwtDecode(response.json[0]);
      expect(credential).toEqual(
        jwtVcExpectation({
          tenant,
          credentialId: credential.payload.jti,
          offer: offer0,
        })
      );

      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offer0._id) })
      ).toEqual(
        mongoify(
          offerExpectation({
            credentialId: credential.payload.jti,
            offer: offer0,
            autocleanFinalizedOfferPii: true,
            tenant,
          })
        )
      );

      fastify.resetOverrides();
    });

    it('/finalize-offers should remove credentialSubject details from offer if autocleanFinalizedOfferPii is false', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        autocleanFinalizedOfferPii: false,
      });

      await updateExchangeOffersIds(exchangeId, [offer0._id]);
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
          approvedOfferIds: [offer0._id],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const vcJwt = jwtDecode(response.json[0]);

      expect(response.statusCode).toEqual(200);
      const dbOffer1Result = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(offer0._id) });

      expect(dbOffer1Result).toEqual(
        mongoify(
          offerExpectation({
            credentialId: vcJwt.payload.jti,
            offer: offer0,
            autocleanFinalizedOfferPii: false,
            tenant,
          })
        )
      );

      fastify.resetOverrides();
    });

    it('/finalize-offers should approve offer with own tenant group', async () => {
      await persistGroup({
        dids: [tenant._id.toString()],
        did: 'did:velocity:99',
      });
      user = await persistVendorUserIdMapping({ tenant });
      authToken = await genAuthToken(tenant, exchange);
      await updateExchangeOffersIds(exchangeId, [offer0._id]);
      const response = await fastify.injectJson({
        method: 'POST',
        url: issuingUrl(tenant, 'finalize-offers'),
        payload: {
          exchangeId,
          approvedOfferIds: [offer0._id],
        },
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toHaveLength(1);
      const vc = jwtDecode(response.json[0]);
      expect(vc).toEqual(
        jwtVcExpectation({
          tenant,
          credentialId: vc.payload.jti,
          offer: offer0,
        })
      );

      const dbOffer1Result = await mongoDb()
        .collection('offers')
        .findOne({ _id: new ObjectId(offer0._id) });

      expect(dbOffer1Result).toEqual(
        mongoify(
          offerExpectation({
            credentialId: vc.payload.jti,
            offer: offer0,
            tenant,
          })
        )
      );

      expect(
        await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
      ).toEqual(
        exchangeExpectation({
          user,
          disclosure,
          exchangeId,
          states: [
            ExchangeStates.NEW,
            ExchangeStates.IDENTIFIED,
            ExchangeStates.CLAIMING_IN_PROGRESS,
            ExchangeStates.COMPLETE,
          ],
          offerIds: [offer0._id],
          overrides: {
            finalizedOfferIds: mapToObjectId([offer0._id]),
          },
        })
      );
    });

    describe('/finalize-offers issuing permissions test suite ', () => {
      it('/finalize-offers should 502 when primary is not authorized to issue career credentials for single offer', async () => {
        await updateExchangeOffersIds(exchangeId, [offer0._id]);
        mockAddCredentialMetadataEntry.mockImplementation(async () => {
          const e = new Error(
            'Permissions: mock error primary lacks permissions'
          );
          e.errorCode = 'career_issuing_not_permitted';
          return Promise.reject(e);
        });
        const response = await fastify.injectJson({
          method: 'POST',
          url: issuingUrl(tenant, 'finalize-offers'),
          payload: {
            exchangeId,
            approvedOfferIds: [offer0._id],
          },
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toEqual(502);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Gateway',
            errorCode: 'career_issuing_not_permitted',
            message: 'Permissions: mock error primary lacks permissions',
            statusCode: 502,
          })
        );

        const dbOffer1Result = await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offer0._id) });

        expect(dbOffer1Result).toEqual(
          mongoify(
            offerExpectation({
              offer: offer0,
              autocleanFinalizedOfferPii: false,
              tenant,
            })
          )
        );

        expect(
          await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
        ).toEqual(
          exchangeExpectation({
            user,
            disclosure,
            exchangeId,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.IDENTIFIED,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.UNEXPECTED_ERROR,
            ],
            offerIds: [offer0._id],
            overrides: {
              err: 'Permissions: mock error primary lacks permissions',
            },
          })
        );
      });

      it('/finalize-offers should 502 when primary is not authorized to issue credentials for one of multiple offer', async () => {
        const offer1 = await persistFinalizableOffer();
        await updateExchangeOffersIds(exchangeId, [offer0._id, offer1._id]);
        mockAddCredentialMetadataEntry.mockImplementationOnce(() => {
          return Promise.resolve(true);
        });
        mockAddCredentialMetadataEntry.mockImplementationOnce(async () => {
          const e = new Error(
            'Permissions: mock error primary lacks permissions'
          );
          e.errorCode = 'career_issuing_not_permitted';
          throw e;
        });
        const response = await fastify.injectJson({
          method: 'POST',
          url: issuingUrl(tenant, 'finalize-offers'),
          payload: {
            exchangeId,
            approvedOfferIds: [offer0._id, offer1._id],
          },
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toEqual(502);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Gateway',
            errorCode: 'career_issuing_not_permitted',
            message: 'Permissions: mock error primary lacks permissions',
            statusCode: 502,
          })
        );

        const dbOffer0Result = await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offer0._id) });

        expect(dbOffer0Result).toEqual(
          mongoify(
            offerExpectation({
              offer: offer0,
              autocleanFinalizedOfferPii: false,
              tenant,
            })
          )
        );

        const dbOffer1Result = await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offer1._id) });

        expect(dbOffer1Result).toEqual(
          mongoify(
            offerExpectation({
              offer: offer1,
              autocleanFinalizedOfferPii: false,
              tenant,
            })
          )
        );

        expect(
          await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
        ).toEqual(
          exchangeExpectation({
            user,
            disclosure,
            exchangeId,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.IDENTIFIED,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.UNEXPECTED_ERROR,
            ],
            offerIds: [offer0._id],
            overrides: {
              err: 'Permissions: mock error primary lacks permissions',
            },
          })
        );
      });

      it('/finalize-offers should 502 when primary is not authorized to identity contact credentials for single offer', async () => {
        await updateExchangeOffersIds(exchangeId, [offer0._id]);
        mockAddCredentialMetadataEntry.mockImplementation(async () => {
          const e = new Error(
            'Permissions: mock error primary lacks permissions'
          );
          e.errorCode = 'identity_issuing_not_permitted';
          throw e;
        });
        const response = await fastify.injectJson({
          method: 'POST',
          url: issuingUrl(tenant, 'finalize-offers'),
          payload: {
            exchangeId,
            approvedOfferIds: [offer0._id],
          },
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toEqual(502);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Gateway',
            errorCode: 'identity_issuing_not_permitted',
            message: 'Permissions: mock error primary lacks permissions',
            statusCode: 502,
          })
        );

        const dbOffer1Result = await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offer0._id) });

        expect(dbOffer1Result).toEqual(
          mongoify(
            offerExpectation({
              offer: offer0,
              autocleanFinalizedOfferPii: false,
              tenant,
            })
          )
        );

        expect(
          await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
        ).toEqual(
          exchangeExpectation({
            user,
            disclosure,
            exchangeId,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.IDENTIFIED,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.UNEXPECTED_ERROR,
            ],
            offerIds: [offer0._id],
            overrides: {
              err: 'Permissions: mock error primary lacks permissions',
            },
          })
        );
      });

      it('/finalize-offers should 502 when primary is not authorized to issue contact credentials for single offer', async () => {
        await updateExchangeOffersIds(exchangeId, [offer0._id]);
        mockAddCredentialMetadataEntry.mockImplementation(async () => {
          const e = new Error(
            'Permissions: mock error primary lacks permissions'
          );
          e.errorCode = 'contact_issuing_not_permitted';
          throw e;
        });
        const response = await fastify.injectJson({
          method: 'POST',
          url: issuingUrl(tenant, 'finalize-offers'),
          payload: {
            exchangeId,
            approvedOfferIds: [offer0._id],
          },
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toEqual(502);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Gateway',
            errorCode: 'contact_issuing_not_permitted',
            message: 'Permissions: mock error primary lacks permissions',
            statusCode: 502,
          })
        );

        const dbOffer1Result = await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offer0._id) });

        expect(dbOffer1Result).toEqual(
          mongoify(
            offerExpectation({
              offer: offer0,
              autocleanFinalizedOfferPii: false,
              tenant,
            })
          )
        );

        expect(
          await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
        ).toEqual(
          exchangeExpectation({
            user,
            disclosure,
            exchangeId,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.IDENTIFIED,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.UNEXPECTED_ERROR,
            ],
            offerIds: [offer0._id],
            overrides: {
              err: 'Permissions: mock error primary lacks permissions',
            },
          })
        );
      });

      it('/finalize-offers should throw unknown error when contract bubbles up an unexpected error', async () => {
        await updateExchangeOffersIds(exchangeId, [offer0._id]);
        mockAddCredentialMetadataEntry.mockImplementation(async () => {
          throw new Error('foo error');
        });
        const response = await fastify.injectJson({
          method: 'POST',
          url: issuingUrl(tenant, 'finalize-offers'),
          payload: {
            exchangeId,
            approvedOfferIds: [offer0._id],
          },
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toEqual(500);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Internal Server Error',
            errorCode: 'missing_error_code',
            message: 'foo error',
            statusCode: 500,
          })
        );

        const dbOffer1Result = await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offer0._id) });

        expect(dbOffer1Result).toEqual(
          mongoify(
            offerExpectation({
              offer: offer0,
              autocleanFinalizedOfferPii: false,
              tenant,
            })
          )
        );

        expect(
          await exchangeRepo.findById(exchangeId, exchangeRepoDefaultProjection)
        ).toEqual(
          exchangeExpectation({
            user,
            disclosure,
            exchangeId,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.IDENTIFIED,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.UNEXPECTED_ERROR,
            ],
            offerIds: [offer0._id],
            overrides: {
              err: 'foo error',
            },
          })
        );
      });
    });

    describe('ensure-tenant-primary-address-plugin', () => {
      it('ensure-tenant-primary-address-plugin should not add primaryAddress to tenant if field exists', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: issuingUrl(tenant, 'finalize-offers'),
          payload: {
            exchangeId,
            approvedOfferIds: [],
          },
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(mockLookupPrimary).toHaveBeenCalledTimes(0);
      });

      it('ensure-tenant-primary-address-plugin should add primaryAddress to tenant if field not exists', async () => {
        mockInitPermissions.mockResolvedValue({
          lookupPrimary: mockLookupPrimary,
        });
        const newTenant = await persistTenant({
          primaryAddress: '',
        });
        const disclosureNewTenant = await persistDisclosure({
          tenant: newTenant,
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        });
        const exchangeForNewTenant = await persistOfferExchange({
          tenant: newTenant,
          disclosure: disclosureNewTenant,
          events: [
            { state: ExchangeStates.NEW, timestamp: new Date() },
            {
              state: ExchangeStates.IDENTIFIED,
              timestamp: new Date(),
            },
          ],
        });
        const userForNewTenant = await persistVendorUserIdMapping({
          tenant: newTenant,
        });
        tenantKeyDatum = await persistKey({ keyPair, tenant: newTenant });
        const authTokenForNewTenant = await genAuthToken(
          newTenant,
          exchangeForNewTenant,
          userForNewTenant
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: issuingUrl(newTenant, 'finalize-offers'),
          payload: {
            exchangeId: exchangeForNewTenant._id.toString(),
            approvedOfferIds: [],
          },
          headers: {
            authorization: `Bearer ${authTokenForNewTenant}`,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(mockLookupPrimary).toHaveBeenCalledTimes(1);
        expect(mockLookupPrimary).toHaveBeenCalledWith(
          toEthereumAddress(hexFromJwk(keyPair.publicKey, false))
        );
      });

      it('ensure-tenant-primary-address-plugin should not add primaryAddress to tenant if DLT_TRANSACTION key not exist', async () => {
        mockInitPermissions.mockResolvedValue({
          lookupPrimary: mockLookupPrimary,
        });
        const newTenant = await persistTenant({
          primaryAddress: '',
        });

        const disclosureNewTenant = await persistDisclosure({
          tenant: newTenant,
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        });
        const exchangeForNewTenant = await persistOfferExchange({
          tenant: newTenant,
          disclosure: disclosureNewTenant,
          events: [
            { state: ExchangeStates.NEW, timestamp: new Date() },
            {
              state: ExchangeStates.IDENTIFIED,
              timestamp: new Date(),
            },
          ],
        });
        const userForNewTenant = await persistVendorUserIdMapping({
          tenant: newTenant,
        });
        tenantKeyDatum = await persistKey({
          keyPair,
          tenant: newTenant,
          purposes: [
            KeyPurposes.EXCHANGES,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.REVOCATIONS_FALLBACK,
            KeyPurposes.ROTATION,
            KeyPurposes.PERMISSIONING,
          ],
        });
        const authTokenForNewTenant = await genAuthToken(
          newTenant,
          exchangeForNewTenant,
          userForNewTenant
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: issuingUrl(newTenant, 'finalize-offers'),
          payload: {
            exchangeId: exchangeForNewTenant._id.toString(),
            approvedOfferIds: [],
          },
          headers: {
            authorization: `Bearer ${authTokenForNewTenant}`,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(mockLookupPrimary).toHaveBeenCalledTimes(0);
      });
    });

    describe('proof validation test suite', () => {
      let offer;
      let joseKeyPair;
      let proofKeyPair;
      let didJwk;

      const prepareData = async (challengeIssuedAt) => {
        exchange = await persistOfferExchange({
          tenant,
          disclosure,
          events: [
            { state: ExchangeStates.NEW, timestamp: new Date() },
            {
              state: ExchangeStates.IDENTIFIED,
              timestamp: new Date(),
            },
          ],
          vendorUserId: 'abcdefg123454',
          challenge: 'mockchallenge',
          challengeIssuedAt: challengeIssuedAt ?? new Date().valueOf() / 1000,
        });
        offer = offer0;
        exchangeId = exchange._id;
        await updateExchangeOffersIds(exchangeId, [offer._id]);
        authToken = await genAuthToken(tenant, exchange);
      };

      beforeEach(async () => {
        await prepareData();
        joseKeyPair = await joseGenerateKeyPair('ES256K');
        proofKeyPair = {
          privateKey: await exportJWK(joseKeyPair.privateKey),
          publicKey: await exportJWK(joseKeyPair.publicKey),
        };
        didJwk = getDidUriFromJwk(proofKeyPair.publicKey);
      });

      const postFinalizeOffers = async (payload, version = '2') =>
        fastify.injectJson({
          method: 'POST',
          url: issuingUrl(tenant, 'finalize-offers'),
          payload,
          headers: {
            authorization: `Bearer ${authToken}`,
            'x-vnf-protocol-version': version,
          },
        });

      it('should return error if proof_type invalid', async () => {
        const response = await postFinalizeOffers(
          {
            exchangeId,
            proof: {
              proof_type: 'invalid',
              jwt: 'jwt',
            },
          },
          ''
        );
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              'body/proof/proof_type must be equal to one of the allowed values',
            statusCode: 400,
          })
        );
      });
      it('should return error if proof.jwt is null', async () => {
        const response = await postFinalizeOffers({
          exchangeId,
          approvedOfferIds: [offer._id],
          proof: {
            proof_type: 'jwt',
            jwt: null,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'proof_jwt_is_required',
            message: 'proof.jwt is missing',
            statusCode: 400,
          })
        );
      });
      it('should return error if proof.jwt is invalid', async () => {
        const response = await postFinalizeOffers({
          exchangeId,
          approvedOfferIds: [offer._id],
          proof: {
            proof_type: 'jwt',
            jwt: 'abc',
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'bad_proof_jwt',
            message: 'proof.jwt is missing',
            statusCode: 400,
          })
        );
      });
      it('should return error if kid in header is missing', async () => {
        const jwt = await jwtSign({ one: '1' }, proofKeyPair.privateKey);
        const response = await postFinalizeOffers({
          exchangeId,
          approvedOfferIds: [offer._id],
          proof: {
            proof_type: 'jwt',
            jwt,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'proof_one_of_jwk_kid_required',
            message: 'proof.jwt is missing a kid',
            statusCode: 400,
          })
        );
      });
      it('should return error if kid in header is invalid', async () => {
        const jwt = await jwtSign({ one: '1' }, proofKeyPair.privateKey, {
          // eslint-disable-next-line max-len
          kid: 'did:jwk:eyJjcnYiOiJQLTI1NiIsImV4dCI6ZmFsc2UsImt0eSI6IkVDIiwieCI6IlNwM0twelBqd2NDRjA0X1cyR3ZTU2YtdkdEdnAzSXYya1FZcUFqbk1CLVkiLCJ5IjoibFptZWNUMnF1WGUwaTlmN2I0cUh2REFGRHB4czBveENvSng0dE9PcX-wrong#0',
        });
        const response = await postFinalizeOffers({
          exchangeId,
          approvedOfferIds: [offer._id],
          proof: {
            proof_type: 'jwt',
            jwt,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'proof_invalid_kid',
            message:
              'kid in the jwt does not resolve to a supported DID document. (kid should be a did:jwk)',
            statusCode: 400,
          })
        );
      });
      it('should return error if proof is invalid', async () => {
        const jwt = await jwtSign({ one: '1' }, proofKeyPair.privateKey, {
          // eslint-disable-next-line max-len
          kid: 'did:jwk:eyJjcnYiOiJQLTI1NiIsImV4dCI6ZmFsc2UsImt0eSI6IkVDIiwieCI6IlNwM0twelBqd2NDRjA0X1cyR3ZTU2YtdkdEdnAzSXYya1FZcUFqbk1CLVkiLCJ5IjoibFptZWNUMnF1WGUwaTlmN2I0cUh2REFGRHB4czBveENvSng0dE9PcX-wrong#0',
        });
        const response = await postFinalizeOffers({
          exchangeId,
          approvedOfferIds: [offer._id],
          proof: {
            proof_type: 'jwt',
            jwt,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'proof_invalid_kid',
            message:
              'kid in the jwt does not resolve to a supported DID document. (kid should be a did:jwk)',
            statusCode: 400,
          })
        );
      });
      it('should return error if jwt verification is failed', async () => {
        const jwt = await jwtSign({ one: '1' }, proofKeyPair.privateKey, {
          // eslint-disable-next-line max-len
          kid: 'did:jwk:eyJjcnYiOiJQLTI1NiIsImV4dCI6ZmFsc2UsImt0eSI6IkVDIiwieCI6IlNwM0twelBqd2NDRjA0X1cyR3ZTU2YtdkdEdnAzSXYya1FZcUFqbk1CLVkiLCJ5IjoibFptZWNUMnF1WGUwaTlmN2I0cUh2REFGRHB4czBveENvSng0dE9PcXNrcyJ9#0',
        });
        const response = await postFinalizeOffers({
          exchangeId,
          approvedOfferIds: [offer._id],
          proof: {
            proof_type: 'jwt',
            jwt,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'proof_bad_jwt',
            message: "proof.jwt isn't a jwt or signature is not correct",
            statusCode: 400,
          })
        );
      });
      it('should return error if proof audience is invalid', async () => {
        const jwt = await jwtSign(
          { aud: 'not-valid' },
          proofKeyPair.privateKey,
          {
            kid: `${getDidUriFromJwk(proofKeyPair.publicKey)}#0`,
          }
        );
        const response = await postFinalizeOffers({
          exchangeId,
          approvedOfferIds: [offer._id],
          proof: {
            proof_type: 'jwt',
            jwt,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'proof_bad_aud',
            message: 'The aud in the jwt is not correct',
            statusCode: 400,
          })
        );
      });
      it('should return error if challenge is invalid', async () => {
        const jwt = await jwtSign(
          { aud: 'http://localhost.test', nonce: 'not-valid' },
          proofKeyPair.privateKey,
          {
            kid: `${getDidUriFromJwk(proofKeyPair.publicKey)}#0`,
          }
        );
        const response = await postFinalizeOffers({
          exchangeId,
          approvedOfferIds: [offer._id],
          proof: {
            proof_type: 'jwt',
            jwt,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'proof_challenge_mismatch',
            message: 'The nonce in the jwt does not match the supplied c_nonce',
            statusCode: 400,
          })
        );
      });
      it('should return error if challenge is expired', async () => {
        await prepareData(getUnixTime(subYears(25, new Date())));
        const response = await postFinalizeOffers({
          exchangeId,
          approvedOfferIds: [offer._id],
          proof: await buildProof(didJwk, proofKeyPair, exchange.challenge),
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'proof_challenge_expired',
            message: 'The c_nonce in the jwt has expired',
            statusCode: 400,
          })
        );
      });
      it('should return 200 and approve offer ES256K alg', async () => {
        const response = await postFinalizeOffers({
          exchangeId,
          approvedOfferIds: [offer._id],
          proof: await buildProof(didJwk, proofKeyPair, exchange.challenge),
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toHaveLength(1);
        const vc = jwtDecode(response.json[0]);
        expect(vc).toEqual(
          jwtVcExpectation({
            tenant,
            credentialId: vc.payload.jti,
            offer: {
              ...offer,
              vnfProtocolVersion: VnfProtocolVersions.VNF_PROTOCOL_VERSION_2,
              credentialSubject: {
                id: didJwk,
                ...offer.credentialSubject,
              },
            },
            payload: {
              sub: didJwk,
            },
          })
        );
        const dbOffer1Result = await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offer._id) });
        expect(dbOffer1Result).toEqual(
          mongoify(
            offerExpectation({
              credentialId: vc.payload.jti,
              offer,
              tenant,
            })
          )
        );
        const dbExchangeResult = await exchangeRepo.findById(
          exchangeId,
          exchangeRepoDefaultProjection
        );
        expect(dbExchangeResult).toEqual(
          exchangeExpectation({
            user,
            disclosure,
            exchangeId,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.IDENTIFIED,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.COMPLETE,
            ],
            offerIds: [offer._id],
            overrides: {
              finalizedOfferIds: mapToObjectId([offer._id]),
              challenge: exchange.challenge,
              challengeIssuedAt: exchange.challengeIssuedAt,
              vendorUserId: exchange.vendorUserId,
            },
          })
        );
      });
      it('should return 200 and approve offer ES256', async () => {
        joseKeyPair = await joseGenerateKeyPair('ES256', { crv: 'P-256' });
        proofKeyPair = {
          privateKey: await exportJWK(joseKeyPair.privateKey),
          publicKey: await exportJWK(joseKeyPair.publicKey),
        };
        didJwk = getDidUriFromJwk(proofKeyPair.publicKey);
        const response = await postFinalizeOffers({
          exchangeId,
          approvedOfferIds: [offer._id],
          proof: await buildProof(didJwk, proofKeyPair, exchange.challenge),
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toHaveLength(1);
        const vc = jwtDecode(response.json[0]);
        expect(vc).toEqual(
          jwtVcExpectation({
            tenant,
            credentialId: vc.payload.jti,
            offer: {
              ...offer,
              vnfProtocolVersion: VnfProtocolVersions.VNF_PROTOCOL_VERSION_2,
              credentialSubject: {
                id: didJwk,
                ...offer.credentialSubject,
              },
            },
            payload: {
              sub: didJwk,
            },
          })
        );
        const dbOffer1Result = await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offer._id) });
        expect(dbOffer1Result).toEqual(
          mongoify(
            offerExpectation({
              credentialId: vc.payload.jti,
              offer,
              tenant,
            })
          )
        );
        const dbExchangeResult = await exchangeRepo.findById(
          exchangeId,
          exchangeRepoDefaultProjection
        );
        expect(dbExchangeResult).toEqual(
          exchangeExpectation({
            user,
            disclosure,
            exchangeId,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.IDENTIFIED,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.COMPLETE,
            ],
            offerIds: [offer._id],
            overrides: {
              finalizedOfferIds: mapToObjectId([offer._id]),
              challenge: exchange.challenge,
              challengeIssuedAt: exchange.challengeIssuedAt,
              vendorUserId: exchange.vendorUserId,
            },
          })
        );
      });
      it('should return 200 and approve offer with credential subject id jwkThumbprint format', async () => {
        const response = await postFinalizeOffers({
          exchangeId,
          approvedOfferIds: [offer._id],
          proof: await buildProof(
            didJwk,
            proofKeyPair,
            exchange.challenge,
            false
          ),
        });
        const didJwkThumbprint = await jwkThumbprint(proofKeyPair.publicKey);
        expect(response.statusCode).toEqual(200);
        expect(response.json).toHaveLength(1);
        const vc = jwtDecode(response.json[0]);
        expect(vc).toEqual(
          jwtVcExpectation({
            tenant,
            credentialId: vc.payload.jti,
            offer: {
              ...offer,
              vnfProtocolVersion: VnfProtocolVersions.VNF_PROTOCOL_VERSION_2,
              credentialSubject: {
                id: didJwkThumbprint,
                ...offer.credentialSubject,
              },
            },
            payload: {
              sub: didJwkThumbprint,
            },
          })
        );
        const dbOffer1Result = await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(offer._id) });
        expect(dbOffer1Result).toEqual(
          mongoify(
            offerExpectation({
              credentialId: vc.payload.jti,
              offer,
              tenant,
            })
          )
        );
        const dbExchangeResult = await exchangeRepo.findById(
          exchangeId,
          exchangeRepoDefaultProjection
        );
        expect(dbExchangeResult).toEqual(
          exchangeExpectation({
            user,
            disclosure,
            exchangeId,
            states: [
              ExchangeStates.NEW,
              ExchangeStates.IDENTIFIED,
              ExchangeStates.CLAIMING_IN_PROGRESS,
              ExchangeStates.COMPLETE,
            ],
            offerIds: [offer._id],
            overrides: {
              finalizedOfferIds: mapToObjectId([offer._id]),
              challenge: exchange.challenge,
              challengeIssuedAt: exchange.challengeIssuedAt,
              vendorUserId: exchange.vendorUserId,
            },
          })
        );
      });
    });
  });
});

const jsonOfferExpectation = ({ offer, tenant }) => {
  const baseOffer = baseOfferExpectation({ offer, tenant });
  baseOffer.id = expect.stringMatching(OBJECT_ID_FORMAT);
  baseOffer.hash = baseOffer.contentHash.value;

  if (!isEmpty(baseOffer.linkedCredentials)) {
    baseOffer.linkedCredentials = [
      {
        linkCode: expect.any(String),
        linkType: baseOffer.linkedCredentials[0].linkType,
      },
    ];
  }
  return jsonify(
    omit(['credentialSubject.vendorUserId', 'contentHash'], baseOffer)
  );
};

const offerExpectation = ({
  credentialId,
  offer,
  credentialTypeContext = [
    'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
  ],
  autocleanFinalizedOfferPii = true,
  tenant,
  overrides,
}) => {
  const baseOffer = baseOfferExpectation({ offer, tenant, overrides });
  baseOffer.tenantId = new ObjectId(tenant._id);
  baseOffer.createdAt = expect.any(Date);
  baseOffer.updatedAt = expect.any(Date);

  baseOffer.linkCode = expect.any(String);
  baseOffer.linkCodeCommitment = {
    type: 'VelocityCredentialLinkCodeCommitment2022',
    value: expect.stringMatching(BASE64_FORMAT),
  };

  if (baseOffer._id == null) {
    baseOffer._id = expect.any(ObjectId);
  }

  if (autocleanFinalizedOfferPii) {
    baseOffer.credentialSubject = {
      vendorUserId: offer.credentialSubject.vendorUserId,
    };
  }

  if (credentialId == null) {
    return mongoify(baseOffer);
  }

  return mongoify({
    ...baseOffer,
    '@context': uniq(
      compact([
        'https://www.w3.org/2018/credentials/v1',
        ...credentialTypeContext,
        'https://lib.test/contexts/credential-extensions-2022.jsonld.json',
        ...castArray(offer['@context']),
      ])
    ),
    type: [
      'VerifiableCredential',
      first(offer.type),
      'VelocityNetworkLayer1Credential',
    ],
    credentialSchema: {
      id: credentialTypeMetadata[first(offer.type)].schemaUrl,
      type: 'JsonSchemaValidator2018',
    },
    credentialStatus: {
      id: expect.stringMatching(
        '^ethereum:0x[0-9a-fA-F]+/getRevokedStatus\\?address=0x[0-9a-z]+&listId=\\d+&index=\\d+$'
      ),
      type: VelocityRevocationListType,
    },
    did: credentialId,
    digestSRI: expect.any(String),
    issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
    consentedAt: expect.any(Date),
    createdAt: offer.createdAt,
    updatedAt: expect.any(Date),
  });
};

const baseOfferExpectation = ({ offer, tenant, overrides = {} }) => {
  let baseOffer = {
    issuer: {
      id: tenant.did,
    },
    ...offer,
  };

  for (const [k, v] of Object.entries(overrides)) {
    baseOffer = set(k, v, baseOffer);
  }

  baseOffer.contentHash = {
    type: 'VelocityContentHash2020',
    value: hashOffer(baseOffer),
  };

  return baseOffer;
};

const educationDegreeCredentialSubject = (user) => ({
  vendorUserId: user.vendorUserId,
  school: 'did:ethr:iamanissuer9876543210',
  schoolName: {
    localized: {
      en: 'BASE Univerity',
    },
  },
  degreeName: {
    localized: {
      en: 'Bachelor',
    },
  },
  program: {
    localized: {
      en: 'Computer Science',
    },
  },
  startMonthYear: {
    month: 9,
    year: 2002,
  },
  endMonthYear: {
    month: 5,
    year: 2005,
  },
});

const offerResponseExpectation = (o) => ({
  ...omit(
    [
      '_id',
      'createdAt',
      'updatedAt',
      'contentHash',
      'issuer.vendorOrganizationId',
      'credentialSubject.vendorUserId',
      'exchangeId',
      'relatedResource',
      'replaces',
    ],
    o
  ),
  exchangeId: o.exchangeId.toString(),
  hash: hashOffer(o),
  id: expect.stringMatching(OBJECT_ID_FORMAT),
});

const exchangeExpectation = ({
  user,
  exchangeId,
  disclosure,
  offerIds,
  states = [
    ExchangeStates.NEW,
    ExchangeStates.IDENTIFIED,
    ExchangeStates.CLAIMING_IN_PROGRESS,
    ExchangeStates.COMPLETE,
  ],
  overrides = {},
  omitList = [],
}) =>
  omit(omitList, {
    _id: new ObjectId(exchangeId),
    disclosureId: new ObjectId(disclosure._id),
    type: ExchangeTypes.ISSUING,
    events: map((state) => ({ state, timestamp: expect.any(Date) }), states),
    offerHashes: [],
    offerIds: expect.arrayContaining(mapToObjectId(offerIds)),
    vendorUserId: user?.vendorUserId,
    challenge: expect.any(String),
    challengeIssuedAt: expect.any(Number),
    ...credentialTypesObject,
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
    ...overrides,
  });

const mapToObjectId = map((v) => new ObjectId(v));

const buildCredentialSubjectWithSchemaDefaults = ({
  offer,
  exchange,
  tenant,
  type = 'PastEmploymentPosition',
  commercialEntity = {},
  overrides,
}) => {
  const credentialSubject = omit(['vendorUserId'], {
    ...offer.credentialSubject,
    type,
  });
  let expectation = {
    ...offer,
    credentialSubject,
    id: expect.stringMatching(OBJECT_ID_FORMAT),
    exchangeId: exchange._id,
    issuer: { id: tenant.did, ...commercialEntity },
    hash: hashOffer({
      ...offer,
      credentialSubject: {
        ...credentialSubject,
        vendorUserId: offer.credentialSubject.vendorUserId,
      },
    }),
  };

  for (const [key, value] of entries(overrides)) {
    expectation = set(key, value, expectation);
  }
  return expectation;
};

const buildCredentialSubjectWithType = (offer) => ({
  ...offer,
  credentialSubject: {
    ...offer.credentialSubject,
    type: 'PastEmploymentPosition',
  },
});

const buildProof = async (didJwk, keyPair, challenge, useKid = true) => {
  const options = {
    jwk: keyPair.publicKey,
    alg: keyPair.publicKey.crv === 'P-256' ? 'ES256' : 'ES256K',
  };
  if (useKid) options.kid = `${didJwk}#0`;
  const jwt = await jwtSign(
    {
      aud: 'http://localhost.test',
      nonce: challenge,
      iss: didJwk,
    },
    keyPair.privateKey,
    options
  );
  return {
    proof_type: 'jwt',
    jwt,
  };
};
