const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { ObjectId } = require('mongodb');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { update, map, flow } = require('lodash/fp');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const { initOfferFactory, initTenantFactory } = require('../../src/entities');

const buildUrl = (tenant, startDate, endDate, optionalParams = {}) => {
  const searchParams = new URLSearchParams();
  if (startDate) {
    searchParams.set('StartDate', startDate);
  }
  if (endDate) {
    searchParams.set('EndDate', endDate);
  }
  if (optionalParams.claimed) {
    searchParams.set('claimed', optionalParams.claimed);
  }
  return `/operator-api/v0.8/tenants/${tenant._id}/offer-data?${searchParams}`;
};

const buildCsvResponse = (offers) => {
  if (offers.length === 0) {
    return '';
  }

  let csv =
    // eslint-disable-next-line max-len
    '"1. Offer Accepted","2. User","3. Offer ID","4. Credential Type","5. Offer Creation Date","6. Offer Claim Date","7. Revocation Status","8. Issuer ID"';

  offers.forEach((offer) => {
    csv += `\r\n"${offer.did || '-'}","${
      offer.credentialSubject?.vendorUserId || '-'
    }","${offer.offerId}","${offer.type[0]}","${offer.createdAt}","${
      offer.consentedAt || '-'
    }","${offer.credentialStatus?.revokedAt || '-'}","${offer.issuer?.id}"`;
  });

  return csv;
};

const dateToIso = (date) => date && new Date(date).toISOString();

const orgDid = 'did:velocity:0xc257274276a4e539741ca11b590b9447b26a8051';

describe('Get Offers Data controller Test Suit', () => {
  let fastify;
  let persistTenant;
  let persistOffer;
  let tenant;
  let offer1;
  let offer2;
  let offer3;
  let offer4;
  let offer5;
  let offer6;

  const persistOfferWithData = async (offerData) => {
    const offer = await persistOffer(offerData);
    if (offerData.createdAt) {
      await mongoDb()
        .collection('offers')
        .updateOne(
          { _id: new ObjectId(offer._id) },
          { $set: { createdAt: offerData.createdAt } }
        );
    }
    return offer;
  };

  before(async () => {
    fastify = await buildFastify();

    ({ persistOffer } = initOfferFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));
  });

  after(async () => {
    await fastify.close();
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('offers').deleteMany({});

    tenant = await persistTenant({
      did: orgDid,
      serviceIds: [`${orgDid}#issuer-1`],
    });

    await Promise.all([
      await persistOfferWithData({
        tenant,
        createdAt: new Date('2020-08-04'),
      }),
      await persistOfferWithData({
        tenant,
        did: 'test_user_did_1',
        consentedAt: new Date('2020-10-11'),
        createdAt: new Date('2020-08-05'),
      }),
      await persistOfferWithData({
        tenant,
        createdAt: new Date('2020-08-06'),
      }),
      await persistOfferWithData({
        tenant,
        did: 'test_user_did_2',
        consentedAt: new Date('2020-10-07'),
        createdAt: new Date('2020-08-06'),
      }),
      await persistOfferWithData({
        tenant,
        did: 'test_user_did_3',
        consentedAt: new Date('2020-11-07'),
        credentialStatus: {
          revokedAt: new Date('2020-11-11'),
        },
        createdAt: new Date('2020-08-07'),
      }),
      await persistOfferWithData({
        tenant,
        createdAt: new Date('2020-08-08'),
      }),
    ]);

    [offer1, offer2, offer3, offer4, offer5, offer6] = await mongoDb()
      .collection('offers')
      .find({})
      .sort({ createdAt: 1 })
      .toArray()
      .then(
        map(
          flow(
            update('createdAt', dateToIso),
            update('consentedAt', dateToIso),
            update('credentialStatus.revokedAt', dateToIso)
          )
        )
      );
  });

  it('should return 200 and all test offers when request from 2020-08-04 to 2020-08-08', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: buildUrl(tenant, '2020-08-04', '2020-08-08'),
    });

    expect(response.statusCode).toEqual(200);

    expect(response.body).toEqual(
      buildCsvResponse([offer1, offer2, offer3, offer4, offer5, offer6])
    );

    expect(response.headers['content-disposition']).toEqual(
      'attachment; filename=get-offers.csv'
    );
    expect(response.headers['content-type']).toEqual('text/csv');
  });

  it('should 200 and return all only claimed offers when claimed=true', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: buildUrl(tenant, '2020-08-04', '2020-08-08', { claimed: true }),
    });

    expect(response.statusCode).toEqual(200);

    expect(response.body).toEqual(buildCsvResponse([offer2, offer4, offer5]));

    expect(response.headers['content-disposition']).toEqual(
      'attachment; filename=get-offers.csv'
    );
    expect(response.headers['content-type']).toEqual('text/csv');
  });

  it('should return 200 and only offer1 when request from 2020-08-04 to 2020-08-04', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: buildUrl(tenant, '2020-08-04', '2020-08-04'),
    });

    expect(response.statusCode).toEqual(200);

    expect(response.body).toEqual(buildCsvResponse([offer1]));
  });

  it('should return 200 and offers 1-4 when request from 2020-08-05 to 2020-08-07', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: buildUrl(tenant, '2020-08-05', '2020-08-07'),
    });

    expect(response.statusCode).toEqual(200);

    expect(response.body).toEqual(
      buildCsvResponse([offer2, offer3, offer4, offer5])
    );
  });

  it('should return 200 and offers 3,4 when request from 2020-08-06 to 2020-08-06', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: buildUrl(tenant, '2020-08-06', '2020-08-06'),
    });

    expect(response.statusCode).toEqual(200);

    expect(response.body).toEqual(buildCsvResponse([offer3, offer4]));
  });

  it('should return empty response when no offers found', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: buildUrl(tenant, '2020-08-09', '2020-08-10'),
    });

    expect(response.statusCode).toEqual(200);

    expect(response.body).toEqual('');
  });

  it('should return 400 when StartDate is incorrect', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: buildUrl(tenant, '2020-08-40', '2020-08-04'),
    });

    expect(response.statusCode).toEqual(400);

    expect(response.json()).toEqual({
      code: 'FST_ERR_VALIDATION',
      statusCode: 400,
      error: 'Bad Request',
      message: 'querystring/StartDate must match format "date"',
    });
  });

  it('should return 400 when EndDate is incorrect', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: buildUrl(tenant, '2020-08-10', '2020-48-4'),
    });

    expect(response.statusCode).toEqual(400);

    expect(response.json()).toEqual({
      code: 'FST_ERR_VALIDATION',
      statusCode: 400,
      error: 'Bad Request',
      message: 'querystring/EndDate must match format "date"',
    });
  });
});
