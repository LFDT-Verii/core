const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { MongoClient } = require('mongodb');
const { buildServer } = require('../src/build-server');
const { HubUnavailableError } = require('../src/adapters/hub-client');
const { hashCapability } = require('../src/domain/capabilities');
const { RunStates } = require('../src/domain/states');
const {
  processNotificationJobs,
} = require('../src/services/process-notifications');
const { closeMongo, initMongo } = require('../src/repositories/mongo');

const mongoConnectionString =
  process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const databaseName = 'test-wallet-certifier-issuance';
const interactionToken = 'issuance-interaction-token';

const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
const makeJwt = (vc) =>
  `${encode({ alg: 'ES256' })}.${encode({ vc })}.signature`;

describe('issuance reconciliation and notifications', () => {
  let api;
  let mongo;
  let nowValue;
  let hubCredential;
  let hubExchange;
  let hubFailure;
  let getCredentialCalls;
  let deferredCredential;
  let sentEmails;
  let config;
  let sendEmail;

  before(async () => {
    const cleanupClient = new MongoClient(mongoConnectionString);
    await cleanupClient.connect();
    await cleanupClient.db(databaseName).dropDatabase();
    await cleanupClient.close();
    mongo = await initMongo(mongoConnectionString, databaseName);

    config = {
      brandName: 'Velocity Network Foundation',
      registrationUrl: 'https://example.test/register-wallet',
      environmentName: 'devnet',
      registrarUrl: 'https://registrar.example.test',
      hubUrl: 'https://hub.example.test',
      capabilityPepper: 'issuance-pepper',
      publicAppUrl: 'https://certifier.example.test',
      supportEmail: 'support@velocitynetwork.foundation',
      senderEmail: 'certifier@velocitynetwork.foundation',
      logSeverity: 'fatal',
      bodyLimit: 64 * 1024,
    };
    sendEmail = async (message) => {
      sentEmails.push(message);
      return { MessageId: `message-${sentEmails.length}` };
    };
    const hubClient = {
      getCredential: async () => {
        getCredentialCalls += 1;
        if (hubFailure) {
          throw new HubUnavailableError();
        }
        if (deferredCredential) {
          return deferredCredential.promise;
        }
        return hubCredential;
      },
      getExchange: async () => hubExchange,
    };
    api = await buildServer({
      config,
      db: mongo.db,
      registrarClient: { searchWallets: async () => [] },
      hubClient,
      now: () => nowValue,
      tokenFactory: () => 'emailed-result-token',
      sendEmail,
    });
    await api.ready();
  });

  beforeEach(async () => {
    nowValue = new Date('2026-07-21T01:05:00.000Z');
    hubCredential = { id: 'credential-1' };
    hubExchange = {
      id: 'exchange-1',
      state: 'NEW',
      events: [{ state: 'NEW', timestamp: '2026-07-21T01:00:01.000Z' }],
    };
    hubFailure = false;
    getCredentialCalls = 0;
    deferredCredential = undefined;
    sentEmails = [];
    await Promise.all([
      mongo.db.collection('certificationRuns').deleteMany({}),
      mongo.db.collection('runEvidence').deleteMany({}),
      mongo.db.collection('notificationJobs').deleteMany({}),
    ]);
  });

  after(async () => {
    await api.close();
    await mongo.db.dropDatabase();
    await closeMongo();
  });

  const seedRun = async (overrides = {}) => {
    const runId = overrides.runId ?? 'run-1';
    const run = {
      runId,
      capability: 'ISSUING',
      state: RunStates.ISSUING,
      walletId: 'did:web:wallet.example#wallet-1',
      walletName: 'Example Wallet',
      walletOrganizationId: 'did:web:wallet.example',
      walletOrganizationName: 'Example Wallet Company',
      interactionCapabilityHash: hashCapability(
        interactionToken,
        config.capabilityPepper,
      ),
      capabilityExpiresAt: new Date('2026-07-21T02:00:00.000Z'),
      depotId: 'depot-1',
      setupCredentialId: 'credential-1',
      actionDeadline: new Date('2026-07-21T01:10:00.000Z'),
      absoluteDeadline: new Date('2026-07-21T01:15:00.000Z'),
      nextCheckAt: new Date('2026-07-21T01:00:00.000Z'),
      revision: 1,
      reconcileFailures: 0,
      journal: [
        { state: RunStates.ISSUING, at: new Date('2026-07-21T01:00:00.000Z') },
      ],
      createdAt: new Date('2026-07-21T01:00:00.000Z'),
      updatedAt: new Date('2026-07-21T01:00:00.000Z'),
      purgeAt: new Date('2027-07-21T01:00:00.000Z'),
      ...overrides,
    };
    const evidence = {
      runId,
      applicantName: 'Alex Example',
      applicantEmail: 'alex@example.com',
      createdAt: new Date('2026-07-21T01:00:00.000Z'),
      updatedAt: new Date('2026-07-21T01:00:00.000Z'),
      purgeAt: new Date('2026-08-20T01:00:00.000Z'),
    };
    await mongo.db.collection('certificationRuns').insertOne(run);
    await mongo.db.collection('runEvidence').insertOne(evidence);
    return runId;
  };

  const getRun = (runId = 'run-1') =>
    api.inject({
      method: 'GET',
      url: `/api/runs/${runId}`,
      headers: { authorization: `Bearer ${interactionToken}` },
    });

  it('returns pending progress and schedules another check', async () => {
    await seedRun();

    const response = await getRun();

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        runId: 'run-1',
        state: RunStates.ISSUING,
        capability: 'ISSUING',
      }),
    );
    expect(
      await mongo.db.collection('notificationJobs').countDocuments(),
    ).toEqual(0);
    const run = await mongo.db
      .collection('certificationRuns')
      .findOne({ runId: 'run-1' });
    expect(run.nextCheckAt).toEqual(new Date('2026-07-21T01:05:03.000Z'));
  });

  it('stores issued evidence, returns it, and creates two safe notification jobs', async () => {
    const jwt = makeJwt({
      type: ['OpenBadgeCredential'],
      credentialSubject: { achievement: { name: 'Setup badge' } },
    });
    hubCredential = {
      id: 'credential-1',
      acceptedAt: '2026-07-21T01:04:30.000Z',
      jwtVc: jwt,
    };
    await seedRun();

    const response = await getRun();

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        state: RunStates.PASSED,
        result: {
          passed: true,
          completedAt: '2026-07-21T01:05:00.000Z',
          credential: {
            issuedAt: '2026-07-21T01:04:30.000Z',
            json: {
              type: ['OpenBadgeCredential'],
              credentialSubject: { achievement: { name: 'Setup badge' } },
            },
            jwt,
          },
        },
      }),
    );
    const run = await mongo.db
      .collection('certificationRuns')
      .findOne({ runId: 'run-1' });
    const evidence = await mongo.db
      .collection('runEvidence')
      .findOne({ runId: 'run-1' });
    const jobs = await mongo.db
      .collection('notificationJobs')
      .find({ runId: 'run-1' })
      .sort({ role: 1 })
      .toArray();
    expect(run).toEqual(
      expect.objectContaining({
        state: RunStates.PASSED,
        setupCredentialFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        resultCapabilityHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(JSON.stringify(run)).not.toContain(jwt);
    expect(evidence.issuedCredential).toEqual(
      response.json().result.credential,
    );
    expect(jobs).toHaveLength(2);
    expect(jobs.map(({ recipient }) => recipient).sort()).toEqual([
      'alex@example.com',
      'support@velocitynetwork.foundation',
    ]);
    expect(jobs.every(({ message }) => !message.includes(jwt))).toEqual(true);
    expect(jobs.find(({ role }) => role === 'APPLICANT').message).toContain(
      'https://certifier.example.test/results/run-1#token=emailed-result-token',
    );
  });

  it('marks a wallet-rejected credential as rejected', async () => {
    hubCredential = {
      id: 'credential-1',
      rejectedAt: '2026-07-21T01:04:00.000Z',
      rejectedReason: 'declined',
    };
    await seedRun();

    const response = await getRun();

    expect(response.json()).toEqual(
      expect.objectContaining({
        state: RunStates.REJECTED,
        failure: {
          code: 'credential_rejected',
          message: 'The credential was rejected by the wallet user.',
        },
      }),
    );
  });

  it('returns the Hub safe exchange error', async () => {
    hubExchange = {
      id: 'exchange-1',
      state: 'UNEXPECTED_ERROR',
      error: {
        code: 'unexpected_error',
        message: 'The exchange ended unexpectedly.',
      },
      events: [
        { state: 'NEW', timestamp: '2026-07-21T01:00:01.000Z' },
        { state: 'UNEXPECTED_ERROR', timestamp: '2026-07-21T01:04:00.000Z' },
      ],
    };
    await seedRun();

    const response = await getRun();

    expect(response.json()).toEqual(
      expect.objectContaining({
        state: RunStates.ERROR,
        failure: hubExchange.error,
      }),
    );
  });

  it('times out after ten minutes without wallet activity', async () => {
    nowValue = new Date('2026-07-21T01:10:00.000Z');
    await seedRun();

    const response = await getRun();

    expect(response.json()).toEqual(
      expect.objectContaining({
        state: RunStates.TIMED_OUT,
        failure: {
          code: 'wallet_action_timeout',
          message:
            'The wallet interaction was not completed within 10 minutes.',
        },
      }),
    );
  });

  it('allows timely wallet activity to finalize until the hard deadline', async () => {
    nowValue = new Date('2026-07-21T01:12:00.000Z');
    hubExchange.events.push({
      state: 'CLAIMING_IN_PROGRESS',
      timestamp: '2026-07-21T01:09:59.000Z',
    });
    hubExchange.state = 'CLAIMING_IN_PROGRESS';
    await seedRun();

    const finalizing = await getRun();
    nowValue = new Date('2026-07-21T01:15:00.000Z');
    const timedOut = await getRun();

    expect(finalizing.json().state).toEqual(RunStates.FINALIZING);
    expect(timedOut.json().state).toEqual(RunStates.TIMED_OUT);
    expect(timedOut.json().failure.code).toEqual('finalization_timeout');
  });

  it('keeps the run retryable after a transient Hub failure', async () => {
    hubFailure = true;
    await seedRun();

    const response = await getRun();

    expect(response.statusCode).toEqual(200);
    expect(response.json().state).toEqual(RunStates.ISSUING);
    const run = await mongo.db
      .collection('certificationRuns')
      .findOne({ runId: 'run-1' });
    expect(run.reconcileFailures).toEqual(1);
    expect(run.lastReconcileErrorCode).toEqual('hub_unavailable');
    expect(run.leaseUntil).toEqual(null);
  });

  it('leases reconciliation so concurrent status reads make one Hub request', async () => {
    await seedRun();
    let resolveCredential;
    deferredCredential = {
      promise: new Promise((resolve) => {
        resolveCredential = resolve;
      }),
    };

    const first = getRun();
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    const second = getRun();
    resolveCredential({ id: 'credential-1' });
    await Promise.all([first, second]);

    expect(getCredentialCalls).toEqual(1);
  });

  it('does not reconcile or alter a terminal result twice', async () => {
    const jwt = makeJwt({ type: ['OpenBadgeCredential'] });
    hubCredential = {
      id: 'credential-1',
      acceptedAt: '2026-07-21T01:04:30.000Z',
      jwtVc: jwt,
    };
    await seedRun();
    await getRun();
    const callsAfterCompletion = getCredentialCalls;
    hubCredential = { id: 'credential-1', rejectedAt: nowValue.toISOString() };

    const response = await getRun();

    expect(response.json().state).toEqual(RunStates.PASSED);
    expect(getCredentialCalls).toEqual(callsAfterCompletion);
    expect(
      await mongo.db.collection('notificationJobs').countDocuments(),
    ).toEqual(2);
  });

  it('delivers pending notification jobs with provider message IDs', async () => {
    const jwt = makeJwt({ type: ['OpenBadgeCredential'] });
    hubCredential = {
      id: 'credential-1',
      acceptedAt: '2026-07-21T01:04:30.000Z',
      jwtVc: jwt,
    };
    await seedRun();
    await getRun();

    const result = await processNotificationJobs({
      config,
      db: mongo.db,
      now: () => nowValue,
      sendEmail,
    });

    expect(result).toEqual({ processed: 2, sent: 2, failed: 0 });
    expect(sentEmails).toHaveLength(2);
    const jobs = await mongo.db
      .collection('notificationJobs')
      .find({})
      .toArray();
    expect(jobs.every(({ status }) => status === 'SENT')).toEqual(true);
    expect(
      jobs.map(({ providerMessageId }) => providerMessageId).sort(),
    ).toEqual(['message-1', 'message-2']);
  });
});
