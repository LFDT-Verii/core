const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { MongoClient } = require('mongodb');
const { createMonitorHandler } = require('../src/lambda-monitor');
const { RunStates } = require('../src/domain/states');
const { closeMongo, initMongo } = require('../src/repositories/mongo');

const mongoConnectionString =
  process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const databaseName = 'test-wallet-certifier-monitor';

describe('scheduled run monitor', () => {
  let mongo;
  const nowValue = new Date('2026-07-21T01:05:00.000Z');
  const config = {
    senderEmail: 'certifier@velocitynetwork.foundation',
    supportEmail: 'support@velocitynetwork.foundation',
  };

  before(async () => {
    const cleanupClient = new MongoClient(mongoConnectionString);
    await cleanupClient.connect();
    await cleanupClient.db(databaseName).dropDatabase();
    await cleanupClient.close();
    mongo = await initMongo(mongoConnectionString, databaseName);
  });

  beforeEach(async () => {
    await Promise.all([
      mongo.db.collection('certificationRuns').deleteMany({}),
      mongo.db.collection('runEvidence').deleteMany({}),
      mongo.db.collection('notificationJobs').deleteMany({}),
    ]);
  });

  after(async () => {
    await mongo.db.dropDatabase();
    await closeMongo();
  });

  const seedRun = (runId, nextCheckAt, setupCredentialId = 'credential-1') =>
    mongo.db.collection('certificationRuns').insertOne({
      runId,
      capability: 'ISSUING',
      state: RunStates.ISSUING,
      setupCredentialId,
      depotId: `depot-${runId}`,
      actionDeadline: new Date('2026-07-21T01:10:00.000Z'),
      absoluteDeadline: new Date('2026-07-21T01:15:00.000Z'),
      nextCheckAt,
      revision: 1,
      reconcileFailures: 0,
      journal: [],
      updatedAt: new Date('2026-07-21T01:00:00.000Z'),
    });

  it('reconciles only due runs and delivers notifications in the same invocation', async () => {
    await Promise.all([
      seedRun('due-run', new Date('2026-07-21T01:04:00.000Z')),
      seedRun('future-run', new Date('2026-07-21T01:06:00.000Z')),
      mongo.db.collection('notificationJobs').insertOne({
        jobId: 'completed-run:APPLICANT',
        runId: 'completed-run',
        role: 'APPLICANT',
        recipient: 'alex@example.com',
        subject: 'Certification complete',
        message: 'View the result',
        status: 'PENDING',
        attemptCount: 0,
        nextAttemptAt: new Date('2026-07-21T01:04:00.000Z'),
      }),
    ]);
    const sent = [];
    const handler = createMonitorHandler({
      config,
      db: mongo.db,
      hubClient: {
        getCredential: async () => ({ id: 'credential-1' }),
        getExchange: async () => ({ state: 'NEW', events: [] }),
      },
      sendEmail: async (message) => {
        sent.push(message);
        return { MessageId: 'provider-1' };
      },
      now: () => nowValue,
    });

    const result = await handler({ source: 'aws.events' });

    expect(result).toEqual({
      reconciled: 1,
      notificationsProcessed: 1,
      failures: 0,
    });
    expect(sent).toHaveLength(1);
    const due = await mongo.db.collection('certificationRuns').findOne({
      runId: 'due-run',
    });
    const future = await mongo.db.collection('certificationRuns').findOne({
      runId: 'future-run',
    });
    expect(due.nextCheckAt).toEqual(new Date('2026-07-21T01:05:03.000Z'));
    expect(future.nextCheckAt).toEqual(new Date('2026-07-21T01:06:00.000Z'));
  });

  it('isolates one unexpected reconciliation failure', async () => {
    await Promise.all([
      seedRun(
        'broken-run',
        new Date('2026-07-21T01:04:00.000Z'),
        'broken-credential',
      ),
      seedRun('healthy-run', new Date('2026-07-21T01:04:00.000Z')),
    ]);
    const handler = createMonitorHandler({
      config,
      db: mongo.db,
      hubClient: {
        getCredential: async (credentialId) => {
          if (credentialId === 'broken-credential') {
            throw new Error('unexpected private upstream failure');
          }
          return { id: credentialId };
        },
        getExchange: async () => ({ state: 'NEW', events: [] }),
      },
      sendEmail: async () => ({}),
      now: () => nowValue,
    });

    const result = await handler({ source: 'aws.events' });

    expect(result).toEqual({
      reconciled: 1,
      notificationsProcessed: 0,
      failures: 1,
    });
  });
});
