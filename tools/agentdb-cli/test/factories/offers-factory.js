const { ObjectId } = require('mongodb');

const persistOfferFactory =
  (db) =>
  async (overrides = {}) => {
    const result = await db.collection('offers').insertOne({
      type: ['PastEmploymentPosition'],
      issuer: {
        id: 'issuerId',
      },
      credentialSubject,
      offerCreationDate: new Date('2020-08-04T21:13:32.019Z'),
      offerExpirationDate: new Date('2050-08-04T21:13:32.019Z'),
      offerId: 'offerId',
      exchangeId: new ObjectId(),
      updatedAt: new Date(),
      ...overrides,
    });
    return db.collection('offers').findOne(result.insertedId);
  };

const credentialSubject = {
  vendorUserId: 'vendorUserId',
  company: 'company',
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
};

module.exports = { persistOfferFactory, credentialSubject };
