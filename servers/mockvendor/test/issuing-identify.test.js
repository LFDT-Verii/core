const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const buildFastify = require('./helpers/mockvendor-build-fastify');
const initUserFactory = require('./factories/users.factory');
const legacyAdamSmithIdentity = require('./helpers/legacy-Adam-Smith.json');
const v1AdamSmithIdentity = require('./helpers/latest-Adam-Smith.json');

describe('issuing/identify webhook test suite', () => {
  let fastify;
  let persistUser;
  let user1;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistUser } = initUserFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('users').deleteMany({});
    await mongoDb().collection('identifications').deleteMany({});

    [user1] = await Promise.all([
      persistUser(),
      persistUser({ emails: ['maria.williams@example.com'] }),
    ]);
  });

  after(async () => {
    await fastify.close();
  });

  it('should be able to identify a matching user', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/issuing/identify',
      payload: {
        ...legacyAdamSmithIdentity,
        exchangeId: new ObjectId(),
        tenantDID: 'MY_ID',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      vendorUserId: user1.emails[0],
    });
  });

  it('should be able to identify an simple user', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/issuing/identify',
      payload: {
        emails: ['adam.smith@example.com'],
        exchangeId: new ObjectId(),
        tenantDID: 'MY_ID',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      vendorUserId: user1.emails[0],
    });
  });

  it('should be able to identify a v1.0 user', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/issuing/identify',
      payload: {
        ...v1AdamSmithIdentity,
        exchangeId: new ObjectId(),
        tenantDID: 'MY_ID',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      vendorUserId: user1.emails[0],
    });
  });

  it('should be able to identify a v1.0 user with a uppercase email address', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/issuing/identify',
      payload: {
        ...v1AdamSmithIdentity,
        emails: ['ADAM.SMITH@example.com'],
        exchangeId: new ObjectId(),
        tenantDID: 'MY_ID',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      vendorUserId: user1.emails[0],
    });
  });

  it('should be able to identify using the vendorOriginContext', async () => {
    await persistUser({
      token: 'foo',
      emails: ['foo@example.com'],
    });

    const response = await fastify.injectJson({
      method: 'POST',
      url: '/issuing/identify',
      payload: {
        phoneCredentials: [],
        emailCredentials: [],
        idDocumentCredentials: [],
        emails: [],
        phones: [],
        exchangeId: new ObjectId(),
        tenantDID: 'MY_ID',
        vendorOriginContext: 'foo',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      vendorUserId: 'foo@example.com',
    });
  });

  it('should be able to 404 on a user not found', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/issuing/identify',
      payload: {
        ...legacyAdamSmithIdentity,
        emails: ['unknown.user@example.com'],
        exchangeId: new ObjectId(),
        tenantDID: 'MY_ID',
      },
    });
    expect(response.statusCode).toEqual(404);
  });
});
