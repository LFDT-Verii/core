const { MongoClient } = require('mongodb');

const connections = new Map();

const createIndexes = async (db) => {
  await Promise.all([
    db.collection('certificationRuns').createIndexes([
      { key: { runId: 1 }, name: 'runId_unique', unique: true },
      {
        key: { state: 1, nextCheckAt: 1, leaseUntil: 1 },
        name: 'active_runs_due',
      },
      { key: { purgeAt: 1 }, name: 'runs_ttl', expireAfterSeconds: 0 },
    ]),
    db.collection('runEvidence').createIndexes([
      { key: { runId: 1 }, name: 'runId_unique', unique: true },
      { key: { purgeAt: 1 }, name: 'evidence_ttl', expireAfterSeconds: 0 },
    ]),
    db.collection('notificationJobs').createIndexes([
      { key: { jobId: 1 }, name: 'jobId_unique', unique: true },
      {
        key: { status: 1, nextAttemptAt: 1, leaseUntil: 1 },
        name: 'notification_jobs_due',
      },
      {
        key: { purgeAt: 1 },
        name: 'notification_jobs_ttl',
        expireAfterSeconds: 0,
      },
    ]),
  ]);
};

const initMongo = async (connectionString, databaseName) => {
  const key = `${connectionString}/${databaseName}`;
  if (!connections.has(key)) {
    const client = new MongoClient(connectionString);
    const connection = client.connect().then(async () => {
      const db = client.db(databaseName);
      await createIndexes(db);
      return { client, db };
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

module.exports = { closeMongo, createIndexes, initMongo };
