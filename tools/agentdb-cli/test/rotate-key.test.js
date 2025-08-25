const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { buildMongoConnection } = require('@verii/tests-helpers');
const { ObjectId } = require('mongodb');
const { decryptCollection, encryptCollection } = require('@verii/crypto');
const { initMongoClient } = require('../src/helpers/init-mongo-client');
const {
  reencryptCollectionField,
} = require('../src/rotate-key/reencrypt-collection-field');
const { reencrypt } = require('../src/rotate-key/reencrypt');

const decryptedKey = 'TEST-KEY';
const decryptedFoo = 'TEST-FOO';
const decryptedTenant = 'TEST-TENANT';
const oldKey = '11111111111111111111111111111';
const newKey = '22222222222222222222222222222';

const persistKeyFactory =
  (db) =>
  async (encryptionKey = oldKey) => {
    const result = await db.collection('keys').insertOne({
      purposes: ['DLT_TRANSACTIONS'],
      algorithm: 'SECP256K1',
      encoding: 'hex',
      kidFragment: '#eth-account-key-1',
      key: encryptCollection(decryptedKey, encryptionKey),
      tenantId: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return db.collection('keys').findOne(result.insertedId);
  };

const persistTenantFactory =
  (db) =>
  async (encryptionKey = oldKey) => {
    const result = await db.collection('tenants').insertOne({
      webhookAuth: {
        type: 'bearer',
        bearerToken: encryptCollection(decryptedTenant, encryptionKey),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return db.collection('tenants').findOne(result.insertedId);
  };

const persistFooFactory =
  (db) =>
  async (encryptionKey = oldKey) => {
    const result = await db.collection('foos').insertOne({
      foo: encryptCollection(decryptedFoo, encryptionKey),
      bar: 'bar',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return db.collection('foos').findOne(result.insertedId);
  };

describe('rotate-key test suite', () => {
  let client;
  let db;
  let persistKey;
  let persistFoo;
  let persistTenant;
  let testOptions;

  before(async () => {
    client = await initMongoClient(
      buildMongoConnection('test-credentialagent')
    );
    db = client.db();
    persistKey = persistKeyFactory(db);
    persistFoo = persistFooFactory(db);
    persistTenant = persistTenantFactory(db);
  });

  after(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await db.collection('tenants').deleteMany({});
    await db.collection('keys').deleteMany({});
    await db.collection('foos').deleteMany({});
    testOptions = {
      collection: 'keys',
      secretProp: 'key',
    };
  });

  it('Should handle no entries ', async () => {
    await reencryptCollectionField(
      oldKey,
      newKey,
      testOptions.collection,
      testOptions.secretProp,
      { db, ...testOptions }
    );
  });

  it('Should update encrypted key if old key is correct', async () => {
    const key = await persistKey();
    await reencryptCollectionField(
      oldKey,
      newKey,
      testOptions.collection,
      testOptions.secretProp,
      { db, ...testOptions }
    );
    const updatedKey = await db.collection('keys').findOne(key._id);
    expect(decryptCollection(updatedKey.key, newKey)).toEqual(decryptedKey);
  });

  it('Should not update database during dry run', async () => {
    const key = await persistKey();
    await reencryptCollectionField(
      oldKey,
      newKey,
      testOptions.collection,
      testOptions.secretProp,
      {
        db,
        ...testOptions,
        dryRun: true,
      }
    );
    const updatedKey = await db.collection('keys').findOne(key._id);
    expect(updatedKey.key).toEqual(key.key);
  });

  it('Should update encrypted foo if old key is correct', async () => {
    const foo = await persistFoo();
    testOptions = {
      collection: 'foos',
      secretProp: 'foo',
    };

    await reencryptCollectionField(
      oldKey,
      newKey,
      testOptions.collection,
      testOptions.secretProp,
      { db, ...testOptions }
    );

    const updatedFoo = await db.collection('foos').findOne(foo._id);

    expect(decryptCollection(updatedFoo.foo, newKey)).toEqual(decryptedFoo);
  });

  it('Should update encrypted nested field without rewriting whole object', async () => {
    testOptions = {
      collection: 'tenants',
      secretProp: 'webhookAuth.bearerToken',
    };

    const tenant = await persistTenant();

    await reencryptCollectionField(
      oldKey,
      newKey,
      testOptions.collection,
      testOptions.secretProp,
      { db, ...testOptions }
    );

    const updatedTenant = await db.collection('tenants').findOne(tenant._id);
    expect(
      decryptCollection(updatedTenant.webhookAuth.bearerToken, newKey)
    ).toEqual(decryptedTenant);

    expect(updatedTenant.webhookAuth).toEqual({
      bearerToken: expect.any(String),
      type: 'bearer',
    });
  });

  it('Should fail if old key is incorrect', async () => {
    await persistKey();
    const exec = () =>
      reencryptCollectionField(
        'WRONG-KEY',
        newKey,
        testOptions.collection,
        testOptions.secretProp,
        { db, ...testOptions }
      );
    await expect(exec).rejects.toThrowError(
      'Unsupported state or unable to authenticate data'
    );
  });

  it('Should run additional reencryptCollectionField with default params', async () => {
    const key = await persistKey();
    const tenant = await persistTenant();

    await reencrypt(oldKey, newKey, undefined, undefined, { db });

    const updatedTenant = await db.collection('tenants').findOne(tenant._id);
    const updatedKey = await db.collection('keys').findOne(key._id);

    expect(decryptCollection(updatedKey.key, newKey)).toEqual(decryptedKey);

    expect(
      decryptCollection(updatedTenant.webhookAuth.bearerToken, newKey)
    ).toEqual(decryptedTenant);

    expect(updatedTenant.webhookAuth).toEqual({
      bearerToken: expect.any(String),
      type: 'bearer',
    });
  });

  describe('Reencrypt test suite', () => {
    it('Should run reencryptCollectionField on keys and tenants', async () => {
      const tenant = await persistTenant();
      const key = await persistKey();

      await reencrypt(oldKey, newKey, undefined, undefined, {
        db,
      });

      const updatedTenant = await db.collection('tenants').findOne(tenant._id);
      const updatedKey = await db.collection('keys').findOne(key._id);

      expect(decryptCollection(updatedKey.key, newKey)).toEqual(decryptedKey);

      expect(
        decryptCollection(updatedTenant.webhookAuth.bearerToken, newKey)
      ).toEqual(decryptedTenant);

      expect(updatedTenant.webhookAuth).toEqual({
        bearerToken: expect.any(String),
        type: 'bearer',
      });
    });

    it('Should run reencrypt only on tenants', async () => {
      const tenant = await persistTenant();
      const key = await persistKey();

      await reencrypt(oldKey, newKey, 'tenants', 'webhookAuth.bearerToken', {
        db,
      });

      const updatedTenant = await db.collection('tenants').findOne(tenant._id);
      const sameKey = await db.collection('keys').findOne(key._id);

      expect(decryptCollection(sameKey.key, oldKey)).toEqual(decryptedKey);

      expect(
        decryptCollection(updatedTenant.webhookAuth.bearerToken, newKey)
      ).toEqual(decryptedTenant);
    });

    it('Should pass default options from reencrypt to reencryptCollectionField if collection was not provided', async () => {
      const tenant = await persistTenant();
      const key = await persistKey();

      await reencrypt(oldKey, newKey, undefined, 'key', {
        db,
      });

      const sameTenant = await db.collection('tenants').findOne(tenant._id);
      const updatedKey = await db.collection('keys').findOne(key._id);

      expect(decryptCollection(updatedKey.key, newKey)).toEqual(decryptedKey);
      expect(
        decryptCollection(sameTenant.webhookAuth.bearerToken, oldKey)
      ).toEqual(decryptedTenant);
    });

    it('Should pass default options from reencrypt to reencryptCollectionField if secretProp was not provided', async () => {
      const tenant = await persistTenant();
      const key = await persistKey();

      await reencrypt(oldKey, newKey, 'keys', undefined, {
        db,
      });

      const sameTenant = await db.collection('tenants').findOne(tenant._id);
      const updatedKey = await db.collection('keys').findOne(key._id);

      expect(decryptCollection(updatedKey.key, newKey)).toEqual(decryptedKey);
      expect(
        decryptCollection(sameTenant.webhookAuth.bearerToken, oldKey)
      ).toEqual(decryptedTenant);
    });
  });
});
