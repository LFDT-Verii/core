const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { buildMongoConnection } = require('@verii/tests-helpers');
const { getMetrics } = require('../src/metrics/get-metrics');
const { initMongoClient } = require('../src/helpers/init-mongo-client');
const { persistOfferFactory } = require('./factories/offers-factory');

describe('metrics test suite', () => {
  let client;
  let db;
  let persistOffer;

  before(async () => {
    client = await initMongoClient(
      buildMongoConnection('test-credentialagent'),
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

  it('should get empty metrics', async () => {
    const start = new Date('2020-05-20T00:00:00.000Z');
    const end = new Date('2025-05-20T00:00:00.000Z');
    const did = 'did:ion:1';
    const { total, unique } = await getMetrics({ start, end, did }, { db });

    expect(total).toEqual(0);
    expect(unique).toEqual(0);
  });

  it('should get metrics by filter', async () => {
    const start = new Date('2020-05-20T00:00:00.000Z');
    const end = new Date('2025-05-20T00:00:00.000Z');
    const did = 'did:ion:123654';

    await persistOffer({
      consentedAt: new Date(1686225410000),
      issuer: { id: did },
      credentialSubject: {
        vendorUserId: 'vendorUserId1',
      },
      did: 'mock',
    });
    await persistOffer({
      consentedAt: new Date(1686484610000),
      issuer: { id: did },
      credentialSubject: {
        vendorUserId: 'vendorUserId2',
      },
      did: 'mock',
    });
    await persistOffer({
      consentedAt: new Date(1686484610000),
      issuer: { id: did },
      credentialSubject: {
        vendorUserId: 'vendorUserId2',
      },
      did: 'mock',
    });
    await persistOffer({
      type: ['IdDocument'],
      consentedAt: new Date(1686484610000),
      issuer: { id: did },
      credentialSubject: {
        vendorUserId: 'vendorUserId2',
      },
      did: 'mock',
    });
    await persistOffer({
      consentedAt: new Date(1686484610000),
      issuer: { id: 'did:no:1' },
      credentialSubject: {
        vendorUserId: 'vendorUserId3',
      },
      did: 'mock',
    });
    await persistOffer({
      consentedAt: new Date(1670763410000),
      issuer: did,
      credentialSubject: {
        vendorUserId: 'vendorUserId4',
      },
      did: 'mock',
    });
    await persistOffer({});
    const { total, unique } = await getMetrics({ start, end, did }, { db });

    expect(total).toEqual(3);
    expect(unique).toEqual(2);
  });
});
