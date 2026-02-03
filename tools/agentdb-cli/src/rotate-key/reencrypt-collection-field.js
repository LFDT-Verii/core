const { map, flow, get, size, each } = require('lodash/fp');
const { decryptCollection, encryptCollection } = require('@verii/crypto');
const { printInfo } = require('../helpers/common');

const updateProp = (id, secretProp, encryptedKey, currentTime) => ({
  updateOne: {
    filter: {
      _id: id,
    },
    update: {
      $set: {
        [secretProp]: encryptedKey,
        updatedAt: currentTime,
      },
    },
  },
});

const decryptField = ({ encryptedField, oldKey, entry }, options) => {
  try {
    return decryptCollection(encryptedField, oldKey);
  } catch (e) {
    printInfo(
      `Error decrypting '${options.secretProp}' field of _id: ${entry._id}`,
    );
    throw e;
  }
};
const reencryptCollectionField = async (
  oldKey,
  newKey,
  _collection,
  secretProp,
  { db, ...options },
) => {
  const currentTime = new Date();

  const collection = db.collection(_collection);
  const secretPropKey = secretProp;
  const entries = await collection
    .find({ [secretPropKey]: { $exists: true } })
    .toArray();
  if (!size(entries)) {
    printInfo('No documents found');
    return;
  }
  const updatedFields = map(
    (entry) =>
      flow(
        get(secretPropKey),
        (encryptedField) =>
          decryptField({ encryptedField, oldKey, entry }, options),
        (decryptedField) => encryptCollection(decryptedField, newKey),
        (encryptedField) =>
          updateProp(entry._id, secretPropKey, encryptedField, currentTime),
      )(entry),
    entries,
  );
  const printEntries = () => {
    each((eW) => printInfo(`${get('_id', eW)}`), entries);
  };
  if (options.dryRun) {
    printInfo('Dry Run: not actually rotating:');
    printEntries();
    printInfo(
      `Dry Run: would have rotated encryption of ${size(entries)} ${
        options.collection
      }`,
    );
    return;
  }
  await collection.bulkWrite(updatedFields);
  printInfo('Rotated encryption of:');
  printEntries();
  printInfo(
    `Rotated encryption of ${size(entries)} '${secretPropKey}' fields in ${
      options.collection
    }`,
  );
};

module.exports = { reencryptCollectionField };
