const persistTenantFactory =
  (db) =>
  async (overrides = {}) => {
    const result = await db.collection('tenants').insertOne({
      did: 'did:foo:bar',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    return db.collection('tenants').findOne(result.insertedId);
  };

module.exports = { persistTenantFactory };
