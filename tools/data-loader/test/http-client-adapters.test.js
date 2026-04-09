const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const nock = require('nock');

const { initFetchers } = require('../src/batch-issuing/fetchers');
const {
  initExecuteUpdate,
} = require('../src/vendor-credentials/execute-update');

describe('data-loader http client adapters', () => {
  before(() => {
    nock.cleanAll();
  });

  after(() => {
    nock.cleanAll();
    nock.restore();
  });

  it('should send the disclosure payload directly', async () => {
    const endpoint = 'https://exampleurl';
    const disclosureRequest = {
      configurationType: 'issuing',
      vendorEndpoint: 'integrated-issuing-identification',
    };
    const responseBody = { id: 'disclosure-id' };

    nock(endpoint, {
      reqheaders: { Authorization: 'Bearer fakeToken' },
    })
      .post(
        '/operator-api/v0.8/tenants/tenant-id/disclosures',
        disclosureRequest,
      )
      .reply(200, responseBody);

    const fetchers = initFetchers({
      endpoint,
      authToken: 'fakeToken',
      tenant: 'tenant-id',
    });

    await expect(fetchers.createDisclosure(disclosureRequest)).resolves.toEqual(
      responseBody,
    );
    expect(nock.isDone()).toBe(true);
  });

  it('should send exchange and offer payloads directly', async () => {
    const endpoint = 'https://exampleurl';
    const newExchange = {
      type: 'ISSUING',
      identityMatcherValues: ['joan.lee@sap.com'],
      disclosureId: 'disclosure-id',
    };
    const exchange = { id: 'exchange-id' };
    const newOffer = {
      offerId: 'offer-id',
      credentialSubject: {
        vendorUserId: 'joan.lee@sap.com',
        email: 'joan.lee@sap.com',
      },
    };
    const offer = { id: 'offer-id' };

    nock(endpoint, {
      reqheaders: { Authorization: 'Bearer fakeToken' },
    })
      .post('/operator-api/v0.8/tenants/tenant-id/exchanges', newExchange)
      .reply(200, exchange)
      .post(
        '/operator-api/v0.8/tenants/tenant-id/exchanges/exchange-id/offers',
        newOffer,
      )
      .reply(200, offer);

    const fetchers = initFetchers({
      endpoint,
      authToken: 'fakeToken',
      tenant: 'tenant-id',
    });

    await expect(fetchers.createOfferExchange(newExchange)).resolves.toEqual(
      exchange,
    );
    await expect(fetchers.createOffer(exchange, newOffer)).resolves.toEqual(
      offer,
    );
    expect(nock.isDone()).toBe(true);
  });

  it('should send vendor credential payloads directly', async () => {
    const endpoint = 'https://vendor.example';
    const person = {
      emails: [{ email: 'joan.lee@sap.com' }],
      firstName: { localized: { en: 'Joan' } },
    };
    const offer = {
      type: ['OpenBadgeV1.0'],
      credentialSubject: {
        vendorUserId: 'joan.lee@sap.com',
      },
    };

    nock(endpoint, {
      reqheaders: { Authorization: 'Bearer fakeToken' },
    })
      .post('/api/users', person)
      .reply(200, { id: 'person-id' })
      .post('/api/offers', offer)
      .reply(200, { id: 'offer-id' });

    const executeUpdate = initExecuteUpdate({
      endpoint,
      authToken: 'fakeToken',
    });

    await expect(executeUpdate({ person, offer })).resolves.toBeUndefined();
    expect(nock.isDone()).toBe(true);
  });
});
