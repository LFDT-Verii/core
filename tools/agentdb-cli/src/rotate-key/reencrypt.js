const { DEFAULT_COLLECTION, DEFAULT_SECRET_PROP } = require('./constants');
const { reencryptCollectionField } = require('./reencrypt-collection-field');

const reencrypt = async (
  oldKey,
  newKey,
  collection,
  secretProp,
  { db, ...options }
) => {
  await reencryptCollectionField(
    oldKey,
    newKey,
    collection || DEFAULT_COLLECTION,
    secretProp || DEFAULT_SECRET_PROP,
    {
      db,
      ...options,
    }
  );

  if (!collection && !secretProp) {
    await reencryptCollectionField(
      oldKey,
      newKey,
      'tenants',
      'webhookAuth.bearerToken',
      {
        db,
        ...options,
      }
    );
  }
};

module.exports = { reencrypt };
