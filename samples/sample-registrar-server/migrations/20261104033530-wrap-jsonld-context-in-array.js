// Databases seeded before jsonldContext was stored as an array hold strings,
// which the credential-type response schema can't serialise.
// The filter uses $expr because { $type: 'string' } also matches arrays of strings.
module.exports = {
  up: async (db) => {
    await db
      .collection('credentialSchemas')
      .updateMany({ $expr: { $eq: [{ $type: '$jsonldContext' }, 'string'] } }, [
        { $set: { jsonldContext: ['$jsonldContext'] } },
      ]);
  },
  down: async () => {},
};
