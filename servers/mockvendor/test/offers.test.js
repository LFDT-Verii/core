const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const { mongoify } = require('@verii/tests-helpers');
const { castArray, map, omit, first } = require('lodash/fp');
const buildFastify = require('./helpers/mockvendor-build-fastify');
const initOfferFactory = require('./factories/offers.factory');
const initAcceptedOffersFactory = require('./factories/accepted-offers.factory');
const offersIO = require('../src/controllers/api/issuing-exchanges/fetchers');

jest.mock('../src/controllers/api/issuing-exchanges/fetchers');

describe('Offer routes', () => {
  let fastify;
  let newOffer;
  let persistOffer;
  let acceptedOffers;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ newOffer, persistOffer } = initOfferFactory(fastify));
    initAcceptedOffersFactory(fastify);
    acceptedOffers = mongoDb().collection('acceptedOffers');
  });

  beforeEach(async () => {
    await mongoDb().collection('offers').deleteMany({});
    await mongoDb().collection('acceptedOffers').deleteMany({});
  });

  afterAll(async () => {
    await fastify.close();
  });

  describe('offer management', () => {
    it('should be able to create a offer', async () => {
      const offer = await newOffer({ label: 'x-label' });
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/offers',
        payload: offer,
      });
      expect(response.statusCode).toEqual(200);
      expect(first(response.json)).toEqual({
        ...expectedOffer(offer),
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        _id: expect.stringMatching(OBJECT_ID_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(first(response.json)._id) })
      ).toEqual({
        _id: new ObjectId(first(response.json)._id),
        ...mongoify(offer),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
    it('should be able to create a offer with resource references', async () => {
      const offer = await newOffer({
        label: 'x-label',
        replaces: [
          {
            id: 'did:ion:123',
            type: ['MockType-1'],
          },
        ],
        relatedResource: [
          {
            id: 'http://www.223.com',
          },
          {
            id: 'scheme:whatever;12312312',
            type: 'MockType-3',
          },
        ],
      });
      const expectedOfferObj = expectedOffer(offer, {
        relatedResource: map(expectedRelatedResource, offer.relatedResource),
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/offers',
        payload: offer,
      });
      expect(response.statusCode).toEqual(200);
      expect(first(response.json)).toEqual({
        ...expectedOfferObj,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        _id: expect.stringMatching(OBJECT_ID_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(first(response.json)._id) })
      ).toEqual({
        _id: new ObjectId(first(response.json)._id),
        ...mongoify(expectedOfferObj),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
    it('should be able to create a offer with issuer.name', async () => {
      const offer = await newOffer({ label: 'x-label' });
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/offers',
        payload: {
          ...offer,
          issuer: { name: 'x', bla: 'o' },
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(first(response.json)).toEqual({
        ...expectedOffer({
          ...offer,
          issuer: { bla: 'o', name: 'x' },
        }),
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        _id: expect.stringMatching(OBJECT_ID_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        await mongoDb()
          .collection('offers')
          .findOne({ _id: new ObjectId(first(response.json)._id) })
      ).toEqual(
        mongoify({
          _id: new ObjectId(first(response.json)._id),
          ...offer,
          issuer: { name: 'x', bla: 'o' },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });
    it('should be able to create an offer', async () => {
      const offer = await newOffer({ label: 'x-label' });
      const offer2 = await newOffer();
      offersIO.submitOffer.mockResolvedValue(Promise.resolve());
      offersIO.completeSubmitOffer.mockResolvedValue(Promise.resolve());
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/offers',
        payload: [offer, offer2],
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual(
        expect.arrayContaining([
          {
            ...expectedOffer(offer),
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            _id: expect.stringMatching(OBJECT_ID_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          {
            ...expectedOffer(offer2),
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            _id: expect.stringMatching(OBJECT_ID_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
        ])
      );
    });
    it('should be able to get a offer', async () => {
      const offer = await persistOffer();
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/offers/${offer._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...offer,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        _id: expect.stringMatching(OBJECT_ID_FORMAT),
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
    });
    it('should exist linkedCredentials in an offer', async () => {
      const offer = await persistOffer({
        linkedCredentials: [{ linkType: 'REPLACE', linkedCredentialId: '' }],
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/offers/${offer._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...offer,
        linkedCredentials: [{ linkType: 'REPLACE', linkedCredentialId: '' }],
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        _id: expect.stringMatching(OBJECT_ID_FORMAT),
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
    });
    it('should be able to get all offers', async () => {
      const [offer1, offer2] = await Promise.all([
        persistOffer(),
        persistOffer(),
      ]);
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/api/offers',
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual(
        expect.arrayContaining([
          {
            ...offer1,
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            _id: expect.stringMatching(OBJECT_ID_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          {
            ...offer2,
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            _id: expect.stringMatching(OBJECT_ID_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
        ])
      );
    });
    it('should be able to update a offer', async () => {
      const [offer1] = await Promise.all([persistOffer(), persistOffer()]);
      const response = await fastify.injectJson({
        method: 'PUT',
        url: `/api/offers/${offer1._id}`,
        payload: expectedOffer(offer1),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...offer1,
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
    });
    it('should be able to delete a offer', async () => {
      const [, offer2] = await Promise.all([persistOffer(), persistOffer()]);
      const getResponsePre = await fastify.injectJson({
        method: 'GET',
        url: '/api/offers',
      });
      expect(getResponsePre.json).toEqual(
        expect.arrayContaining([
          { ...offer2, id: expect.stringMatching(OBJECT_ID_FORMAT) },
        ])
      );
      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `/api/offers/${offer2._id}`,
      });
      expect(response.statusCode).toEqual(200);
      const getResponsePost = await fastify.injectJson({
        method: 'GET',
        url: '/api/offers',
      });
      expect(getResponsePost.json).not.toEqual(
        expect.arrayContaining([
          { ...offer2, id: expect.stringMatching(OBJECT_ID_FORMAT) },
        ])
      );
    });
  });

  describe('generate offers', () => {
    let offers;
    beforeEach(async () => {
      fastify.resetOverrides();
      offers = await Promise.all([
        persistOffer(),
        persistOffer({ type: ['CurrentEmploymentPosition'] }),
        persistOffer({ type: ['Badge'] }),
        persistOffer({
          credentialSubject: { vendorUserId: 'maria.williams@example.com' },
        }),
        persistOffer({
          credentialSubject: { vendorUserId: 'maria.williams2@example.com' },
          exchangeId: '123', // should be ignored
        }),
        persistOffer({ issuer: { vendorOrganizationId: '123' } }),
        persistOffer({ issuer: { id: '123' } }),
      ]);
    });

    it('should generate offers for a specific user, type, and tenantDID', async () => {
      const payload = {
        vendorUserId: 'maria.williams@example.com',
        types: ['Course'],
        tenantDID: offers[0].issuer.id,
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [expectedOffer(offers[3])],
      });
    });

    it('should generate offers with issuer.logo and issuer.name', async () => {
      const offer = await persistOffer({
        issuer: {
          id: 'uniq-1',
          name: 'uniq-1',
          image: 'uniq-1',
        },
      });
      const payload = {
        vendorUserId: 'adam.smith@example.com',
        types: ['Course'],
        tenantDID: offer.issuer.id,
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          expectedOffer(offer, {
            issuer: {
              id: 'uniq-1',
              name: 'uniq-1',
              image: 'uniq-1',
            },
          }),
        ],
      });
    });

    it('should generate offers and stript not needed properties', async () => {
      const offer = await persistOffer({
        issuer: {
          id: 'uniq-1',
          name: 'uniq-1',
          bla: 'uniq-1',
        },
      });
      const payload = {
        vendorUserId: 'adam.smith@example.com',
        types: ['Course'],
        tenantDID: offer.issuer.id,
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [
          expectedOffer(offer, {
            issuer: {
              id: 'uniq-1',
              name: 'uniq-1',
              bla: 'uniq-1',
            },
          }),
        ],
      });
    });

    it('should return 200 with empty array if no offer and config noOffers200 turn on', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        noOffers200: true,
      });
      const payload = {
        vendorUserId: 'no-vendor@example.com',
        types: ['NO-TYPES'],
        tenantDID: offers[0].issuer.id,
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [],
      });
    });

    it('should generate offers without offerId if omitOfferId config is true', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        omitOfferId: true,
      });
      const payload = {
        vendorUserId: 'maria.williams@example.com',
        types: ['Course'],
        tenantDID: offers[0].issuer.id,
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [omit(['offerId'], expectedOffer(offers[3]))],
      });
    });

    it('should generate offers for a specific user, and vendorOrganizationId', async () => {
      const payload = {
        vendorUserId: 'adam.smith@example.com',
        types: [],
        vendorOrganizationId: offers[5].issuer.vendorOrganizationId,
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [expectedOffer(offers[5])],
      });
    });

    it('should generate offers for a specific user, and vendorOrganizationId or tenantDID', async () => {
      const payload = {
        vendorUserId: 'adam.smith@example.com',
        types: ['Course'],
        tenantDID: offers[0].issuer.id,
        vendorOrganizationId: offers[5].issuer.vendorOrganizationId,
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: expect.arrayContaining([
          expectedOffer(offers[0]),
          expectedOffer(offers[5]),
        ]),
      });

      expect(response.json.offers).toHaveLength(2);
    });

    it('should reply with 202', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        noOffers200: false,
      });
      const payload = {
        vendorUserId: 'maria.williams@example.com',
        types: ['CurrentEmploymentPosition'],
        tenantDID: '123',
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(202);
      expect(response.json).toEqual({});
    });

    it('should reply with 200 with delay', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        noOffers200: true,
        generateOffersDelaySec: 3000,
      });
      const startTimestamp = Date.now().valueOf();
      const payload = {
        vendorUserId: 'maria.williams@example.com',
        types: ['CurrentEmploymentPosition'],
        tenantDID: '123',
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [],
      });
      expect(Date.now().valueOf() - startTimestamp).toBeGreaterThanOrEqual(
        3000
      );
    });

    it('should reply with 202 based on vendorOrganizationId', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        noOffers200: false,
      });
      const payload = {
        vendorUserId: 'maria.williams@example.com',
        types: ['CurrentEmploymentPosition'],
        vendorOrganizationId: '123',
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(202);
      expect(response.json).toEqual({});
    });

    it('should reply with 202 based on tenantDID', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        noOffers200: false,
      });
      const payload = {
        vendorUserId: 'maria.williams@example.com',
        types: ['CurrentEmploymentPosition'],
        tenantDID: '123',
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(202);
      expect(response.json).toEqual({});
    });

    it('should generate offers for a specific user, many types, and tenantDID', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        noOffers200: false,
      });
      const payload = {
        vendorUserId: 'adam.smith@example.com',
        tenantDID: offers[0].issuer.id,
        types: ['Course', 'Badge'],
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: expect.arrayContaining(
          map(expectedOffer, [offers[0], offers[2]])
        ),
      });
    });

    it('should generate offers for a specific user, many types, and tenantDID and no vendorOrganizationId', async () => {
      const payload = {
        vendorUserId: 'adam.smith@example.com',
        tenantDID: offers[0].issuer.id,
        types: ['Course', 'Badge'],
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: expect.arrayContaining(
          map(expectedOffer, [offers[0], offers[2]])
        ),
      });
      expect(response.json.offers).toHaveLength(2);
    });

    it('should generate offers with resource reference data', async () => {
      const offer = await persistOffer({
        type: ['CourseTest'],
        credentialSubject: { vendorUserId: 'maria.williams@example.com' },
        replaces: [
          {
            id: 'did:ion:123',
            type: 'MockType-1',
          },
        ],
        relatedResource: [
          {
            id: 'http://www.223.com',
            type: 'MockType-2',
          },
          {
            id: 'scheme:whatever;12312312',
            type: 'MockType-3',
          },
        ],
      });
      const payload = {
        vendorUserId: 'maria.williams@example.com',
        types: ['CourseTest'],
        tenantDID: offer.issuer.id,
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/generate-offers',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        offers: [expectedOffer(offer)],
      });
    });

    it('should insert accepted offers', async () => {
      const payload = {
        offerIds: [offers[0].offerId],
        exchangeId: new ObjectId(),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/issuing/receive-issued-credentials',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      const exchangeDBResult = await acceptedOffers.findOne({
        exchangeId: payload.exchangeId.toString(),
      });
      expect(exchangeDBResult).toEqual({
        _id: expect.any(ObjectId),
        createdAt: expect.any(Date),
        exchangeId: payload.exchangeId.toString(),
        offerIds: [offers[0].offerId],
        updatedAt: expect.any(Date),
      });
    });
  });
});

const expectedOffer = (payload, overrides = {}) =>
  omit(['_id', 'createdAt', 'exchangeId', 'updatedAt'], {
    ...payload,
    ...overrides,
  });

const expectedRelatedResource = (relatedResource) => {
  if (relatedResource.type == null) {
    return relatedResource;
  }

  return {
    ...relatedResource,
    type: castArray(relatedResource.type),
  };
};
