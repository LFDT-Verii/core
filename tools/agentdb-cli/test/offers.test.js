const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { buildMongoConnection } = require('@verii/tests-helpers');
const {
  updateOfferExpirationDates,
} = require('../src/offers/update-offer-expiration-dates');
const { initMongoClient } = require('../src/helpers/init-mongo-client');
const { persistOfferFactory } = require('./factories/offers-factory');

describe('offers test suite', () => {
  let client;
  let db;
  let persistOffer;
  before(async () => {
    client = await initMongoClient(buildMongoConnection('test-mockvendor'));
    db = client.db();
    persistOffer = persistOfferFactory(db);
  });
  after(async () => {
    await client.close();
  });
  beforeEach(async () => {
    await db.collection('offers').deleteMany({});
  });

  it('should handle empty set', async () => {
    await updateOfferExpirationDates({ db });

    const updatedOffers = await db.collection('offers').find({}).toArray();
    expect(updatedOffers).toEqual([]);
  });

  it('should update offerExpirationDate on offers', async () => {
    const offer1 = await persistOffer({
      offerExpirationDate: new Date('2020-08-04T21:13:32.019Z'),
    });
    const offer2 = await persistOffer({});

    await updateOfferExpirationDates({ db });

    const updatedOffers = await db.collection('offers').find({}).toArray();
    expect(updatedOffers).toEqual([
      {
        ...offer1,
        offerExpirationDate: new Date('2030-01-01T00:00:00.000Z'),
        updatedAt: expect.any(Date),
      },
      {
        ...offer2,
        offerExpirationDate: new Date('2030-01-01T00:00:00.000Z'),
        updatedAt: expect.any(Date),
      },
    ]);
    expect(updatedOffers[0].updatedAt.getTime()).toBeGreaterThan(
      offer1.updatedAt.getTime(),
    );
    expect(updatedOffers[1].updatedAt.getTime()).toBeGreaterThan(
      offer2.updatedAt.getTime(),
    );
  });

  it('should respect the dids filter on offers', async () => {
    const offer1 = await persistOffer({
      offerExpirationDate: new Date('2020-08-04T21:13:32.019Z'),
      issuer: {
        id: 'foo',
      },
    });
    const offer2 = await persistOffer({
      offerExpirationDate: new Date('2020-08-04T21:13:32.019Z'),
    });

    await updateOfferExpirationDates({ db, dids: ['foo'] });

    const updatedOffers = await db
      .collection('offers')
      .find({})
      .sort({ _id: 1 })
      .toArray();
    expect(updatedOffers).toEqual([
      {
        ...offer1,
        offerExpirationDate: new Date('2030-01-01T00:00:00.000Z'),
        updatedAt: expect.any(Date),
      },
      {
        ...offer2,
        offerExpirationDate: new Date('2020-08-04T21:13:32.019Z'),
        updatedAt: expect.any(Date),
      },
    ]);
    expect(updatedOffers[0].updatedAt.getTime()).toBeGreaterThan(
      offer1.updatedAt.getTime(),
    );
    expect(updatedOffers[1].updatedAt.getTime()).toEqual(
      offer2.updatedAt.getTime(),
    );
  });
});
