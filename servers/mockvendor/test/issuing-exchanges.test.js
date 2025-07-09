const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const { testAuthToken } = require('@verii/tests-helpers');
const { first } = require('lodash/fp');
const nock = require('nock');
const { nanoid } = require('nanoid/non-secure');
const buildFastify = require('./helpers/mockvendor-build-fastify');
const initOfferFactory = require('./factories/offers.factory');
const initissuingExchangeFactory = require('./factories/delayed-offer.factory');

describe('Issuing Exchanges routes', () => {
  let fastify;
  let newOffer;
  let persistIssuingExchanges;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ newOffer } = initOfferFactory(fastify));
    ({ persistIssuingExchanges } = initissuingExchangeFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('offers').deleteMany({});
    await mongoDb().collection('issuingExchanges').deleteMany({});
  });

  afterAll(async () => {
    await mongoDb().collection('offers').deleteMany({});
    await mongoDb().collection('issuingExchanges').deleteMany({});
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  describe('issuing exchanges management', () => {
    describe('getting delayed offer exchanges', () => {
      it('should be able to get a delayed offer by exchangeId', async () => {
        const issuingExchange = await persistIssuingExchanges();
        const {
          issuer: { id: tenantDID },
        } = issuingExchange;
        const response = await fastify.injectJson({
          method: 'GET',
          url: `/api/issuing-exchanges/${tenantDID}?exchangeId=${issuingExchange.exchangeId}`,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(
          expect.arrayContaining([
            {
              id: expect.stringMatching(OBJECT_ID_FORMAT),
              _id: expect.stringMatching(OBJECT_ID_FORMAT),
              createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
              exchangeId: issuingExchange.exchangeId,
              updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
              issuer: { id: tenantDID },
              vendorUserId: issuingExchange.vendorUserId,
            },
          ])
        );
      });
      it('should be able to get a delayed offer by issuer', async () => {
        const issuingExchange = await persistIssuingExchanges();
        const {
          issuer: { id: tenantDID },
        } = issuingExchange;
        const response = await fastify.injectJson({
          method: 'GET',
          url: `/api/issuing-exchanges/${tenantDID}?issuer=${issuingExchange.issuer}`,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(
          expect.arrayContaining([
            {
              id: expect.stringMatching(OBJECT_ID_FORMAT),
              _id: expect.stringMatching(OBJECT_ID_FORMAT),
              createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
              exchangeId: issuingExchange.exchangeId,
              updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
              issuer: { id: tenantDID },
              vendorUserId: issuingExchange.vendorUserId,
            },
          ])
        );
      });
      it('should be able to get a delayed offer by vendorUserId', async () => {
        const issuingExchange = await persistIssuingExchanges();
        const {
          issuer: { id: tenantDID },
        } = issuingExchange;
        const response = await fastify.injectJson({
          method: 'GET',
          url: `/api/issuing-exchanges/${tenantDID}?vendorUserId=${issuingExchange.vendorUserId}`,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(
          expect.arrayContaining([
            {
              id: expect.stringMatching(OBJECT_ID_FORMAT),
              _id: expect.stringMatching(OBJECT_ID_FORMAT),
              createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
              exchangeId: issuingExchange.exchangeId,
              updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
              issuer: { id: tenantDID },
              vendorUserId: issuingExchange.vendorUserId,
            },
          ])
        );
      });
    });

    describe('creating a delayed offer exchange', () => {
      const imageBytes = Buffer.from([137, 80, 78, 71]);

      it('should be able create a set of offers and get a qr code', async () => {
        const offer = await newOffer();
        const exchangeId = nanoid();
        const offerId = nanoid();
        const tenant = { did: offer.issuer.id };
        nock('http://credentialagent.localhost.test')
          .post(`/operator-api/v0.8/tenants/${tenant.did}/exchanges`)
          .reply(200, {
            id: exchangeId,
          });

        nock('http://credentialagent.localhost.test')
          .post(
            `/operator-api/v0.8/tenants/${tenant.did}/exchanges/${exchangeId}/offers`
          )
          .reply(200, {
            ...offer,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            id: offerId,
          });

        nock('http://credentialagent.localhost.test')
          .post(
            `/operator-api/v0.8/tenants/${tenant.did}/exchanges/${exchangeId}/offers/complete`
          )
          .reply(200, { offerIds: [offerId] });

        nock('http://credentialagent.localhost.test')
          .get(
            `/operator-api/v0.8/tenants/${tenant.did}/exchanges/${exchangeId}/qrcode.png`
          )
          .reply(200, imageBytes, { 'Content-Type': 'image/png' });

        const response = await fastify.inject({
          method: 'POST',
          url: `/api/issuing-exchanges/${tenant.did}/create-qrcode`,
          payload: { offer },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.headers['content-type']).toEqual('image/png');
        expect(response.statusCode).toEqual(200);
        expect(Buffer.byteLength(response.rawPayload)).toEqual(4);
        expect(
          await mongoDb().collection('issuingExchanges').findOne({})
        ).toEqual({
          exchangeId,
          tenantDID: tenant.did,
          _id: expect.any(ObjectId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(await mongoDb().collection('offers').findOne({})).toEqual({
          ...offer,
          exchangeId,
          _id: expect.any(ObjectId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });

      it('should be able create a set of offers and get a qr code with a vendorOriginContext', async () => {
        const offer = await newOffer();
        const exchangeId = nanoid();
        const offerId = nanoid();
        const tenant = { did: offer.issuer.id };
        nock('http://credentialagent.localhost.test')
          .post(`/operator-api/v0.8/tenants/${tenant.did}/exchanges`)
          .reply(200, {
            id: exchangeId,
          });

        nock('http://credentialagent.localhost.test')
          .post(
            `/operator-api/v0.8/tenants/${tenant.did}/exchanges/${exchangeId}/offers`
          )
          .reply(200, {
            ...offer,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            id: offerId,
          });

        nock('http://credentialagent.localhost.test')
          .post(
            `/operator-api/v0.8/tenants/${tenant.did}/exchanges/${exchangeId}/offers/complete`
          )
          .reply(200, { offerIds: [offerId] });

        nock('http://credentialagent.localhost.test')
          .get(
            `/operator-api/v0.8/tenants/${tenant.did}/exchanges/${exchangeId}/qrcode.png?vendorOriginContext=123`
          )
          .reply(200, imageBytes, { 'Content-Type': 'image/png' });

        const response = await fastify.inject({
          method: 'POST',
          url: `/api/issuing-exchanges/${tenant.did}/create-qrcode`,
          payload: { offer, vendorOriginContext: '123' },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.headers['content-type']).toEqual('image/png');
        expect(response.statusCode).toEqual(200);
        expect(Buffer.byteLength(response.rawPayload)).toEqual(4);
        expect(
          await mongoDb().collection('issuingExchanges').findOne({})
        ).toEqual({
          exchangeId,
          tenantDID: tenant.did,
          _id: expect.any(ObjectId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(await mongoDb().collection('offers').findOne({})).toEqual({
          ...offer,
          exchangeId,
          _id: expect.any(ObjectId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });

      it('should properly filter issuingExchanges based on did', async () => {
        const dids = [`did:ion:${nanoid()}`, `did:ion:${nanoid()}`];
        await persistIssuingExchanges({
          issuer: { id: dids[0] },
        });
        await persistIssuingExchanges({
          issuer: { id: dids[1] },
        });

        const response = await fastify.inject({
          method: 'GET',
          url: `/api/issuing-exchanges/${dids[0]}`,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json()).toHaveLength(1);
      });
    });

    describe('pushing offers for a previously created delayed offer exchange', () => {
      let offer;
      let issuingExchange;
      let tenant;
      let offerId;

      beforeEach(async () => {
        offerId = nanoid();
        offer = await newOffer();
        issuingExchange = await persistIssuingExchanges({
          issuer: { id: offer.issuer.id },
        });
        tenant = {
          did: issuingExchange.issuer.id,
        };

        nock('http://credentialagent.localhost.test')
          .post(
            `/operator-api/v0.8/tenants/${tenant.did}/exchanges/${issuingExchange.exchangeId}/offers`
          )
          .reply(200, {
            ...offer,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            id: offerId,
          });

        nock('http://credentialagent.localhost.test')
          .post(
            `/operator-api/v0.8/tenants/${tenant.did}/exchanges/${issuingExchange.exchangeId}/offers/complete`
          )
          .reply(200, { offerIds: [offerId] });
      });
      it('should be able to push-offers for existing exchange', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `/api/issuing-exchanges/${tenant.did}/${issuingExchange.exchangeId}/push-offers`,
          payload: { offer },
        });
        expect(response.statusCode).toEqual(200);
        expect(first(response.json)).toEqual({
          ...offer,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          _id: expect.stringMatching(OBJECT_ID_FORMAT),
          exchangeId: issuingExchange.exchangeId,
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });
      it('should be able to create a push-offer when an array is passed', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `/api/issuing-exchanges/${tenant.did}/${issuingExchange.exchangeId}/push-offers`,
          payload: { offer: [offer] },
        });
        expect(response.statusCode).toEqual(200);
        expect(first(response.json)).toEqual({
          ...offer,
          exchangeId: issuingExchange.exchangeId,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          _id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });
    });
  });
});
