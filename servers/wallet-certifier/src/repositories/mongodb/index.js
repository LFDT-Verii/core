const { MongoClient } = require('mongodb');
const {
  createCertificationRunsRepository,
} = require('./certification-runs-repository');
const { createRunEvidenceRepository } = require('./run-evidence-repository');
const {
  createNotificationJobsRepository,
} = require('./notification-jobs-repository');
const { certificationRunsEntity } = require('./entities/certification-runs');
const { runEvidenceMongoEntity } = require('./entities/run-evidence');
const { notificationJobsEntity } = require('./entities/notification-jobs');

const connections = new Map();
const entities = Object.freeze([
  certificationRunsEntity,
  runEvidenceMongoEntity,
  notificationJobsEntity,
]);

/** @param {import('mongodb').Db} db */
const createIndexes = async (db) => {
  await Promise.all(
    entities.map((entity) =>
      db.collection(entity.collectionName).createIndexes([...entity.indexes]),
    ),
  );
};

/**
 * @param {import('mongodb').Db} db
 * @returns {import('../contracts').Repositories}
 */
const createMongoRepositories = (db) => ({
  certificationRuns: createCertificationRunsRepository(db),
  runEvidence: createRunEvidenceRepository(db),
  notificationJobs: createNotificationJobsRepository(db),
  ping: async () => {
    await db.command({ ping: 1 });
  },
});

const initMongo = async (connectionString, databaseName) => {
  const key = `${connectionString}/${databaseName}`;
  if (!connections.has(key)) {
    const client = new MongoClient(connectionString);
    const connection = client.connect().then(async () => {
      const db = client.db(databaseName);
      await createIndexes(db);
      return { client, db, repositories: createMongoRepositories(db) };
    });
    connections.set(key, connection);
  }
  return connections.get(key);
};

const closeMongo = async () => {
  const activeConnections = await Promise.all(connections.values());
  await Promise.all(activeConnections.map(({ client }) => client.close()));
  connections.clear();
};

module.exports = {
  closeMongo,
  createIndexes,
  createMongoRepositories,
  initMongo,
};
