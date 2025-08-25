const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { buildMongoConnection } = require('@verii/tests-helpers');
const {
  removePiiFromFinalizedOffers,
} = require('../src/pii-purge/remove-pii-from-finalized-offers');
const { initMongoClient } = require('../src/helpers/init-mongo-client');
const {
  persistOfferFactory,
  credentialSubject,
} = require('./factories/offers-factory');

describe('pii-purge test suite', () => {
  let client;
  let db;
  let persistOffer;
  before(async () => {
    client = await initMongoClient(
      buildMongoConnection('test-credentialagent')
    );
    db = client.db();
    persistOffer = persistOfferFactory(db);
  });
  after(async () => {
    await client.close();
  });
  beforeEach(async () => {
    await db.collection('offers').deleteMany({});
  });

  it('should remove pii from offers which have consentedAt or rejectedAt', async () => {
    const offer1 = await persistOffer({
      consentedAt: new Date('2020-08-04T21:13:32.019Z'),
      credentialSubject: {
        ...credentialSubject,
        vendorUserId: 'vendorUserId_1',
      },
    });
    const offer2 = await persistOffer({
      rejectedAt: new Date('2020-08-04T21:13:32.019Z'),
      credentialSubject: {
        ...credentialSubject,
        vendorUserId: 'vendorUserId_2',
      },
    });
    const offer3 = await persistOffer({
      credentialSubject: {
        ...credentialSubject,
        vendorUserId: 'vendorUserId_3',
      },
    });
    const offer4 = await persistOffer({
      credentialSubject: {
        ...credentialSubject,
        vendorUserId: 'vendorUserId_4',
      },
      offerExpirationDate: new Date('2020-08-04T21:13:32.019Z'),
    });

    await removePiiFromFinalizedOffers({ db });

    const updatedOffers = await db
      .collection('offers')
      .find({})
      .sort({ _id: 1 })
      .toArray();
    expect(updatedOffers).toEqual([
      {
        ...offer1,
        credentialSubject: {
          vendorUserId: offer1.credentialSubject.vendorUserId,
        },
        updatedAt: expect.any(Date),
      },
      {
        ...offer2,
        credentialSubject: {
          vendorUserId: offer2.credentialSubject.vendorUserId,
        },
        updatedAt: expect.any(Date),
      },
      offer3,
      {
        ...offer4,
        credentialSubject: {
          vendorUserId: offer4.credentialSubject.vendorUserId,
        },
        updatedAt: expect.any(Date),
      },
    ]);
  });

  it('should not remove pii if offers active', async () => {
    const offers = await Promise.all([
      persistOffer({
        credentialSubject: {
          ...credentialSubject,
          vendorUserId: 'vendorUserId_1',
        },
      }),
      persistOffer({
        credentialSubject: {
          ...credentialSubject,
          vendorUserId: 'vendorUserId_2',
        },
      }),
    ]);

    await removePiiFromFinalizedOffers({ db });

    const updatedOffers = await db.collection('offers').find({}).toArray();
    expect(updatedOffers).toEqual(offers);
  });
});
