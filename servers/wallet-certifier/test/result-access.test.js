const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { MongoClient } = require('mongodb');
const { buildServer } = require('../src/build-server');
const { hashCapability } = require('../src/domain/capabilities');
const { RunStates } = require('../src/domain/states');
const { closeMongo, initMongo } = require('../src/repositories/mongo');

const mongoConnectionString =
  process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const databaseName = 'test-wallet-certifier-result-access';

describe('result sessions and support diagnostics', () => {
  let api;
  let mongo;
  let logs;
  const config = {
    brandName: 'Velocity Network Foundation',
    environmentName: 'devnet',
    registrationUrl: 'https://example.test/register-wallet',
    registrarUrl: 'https://registrar.example.test',
    hubUrl: 'https://hub.example.test',
    capabilityPepper: 'result-pepper',
    publicAppUrl: 'https://certifier.example.test',
    supportEmail: 'support@velocitynetwork.foundation',
    senderEmail: 'certifier@velocitynetwork.foundation',
    logSeverity: 'info',
    bodyLimit: 64 * 1024,
    nodeEnv: 'production',
  };

  before(async () => {
    const cleanupClient = new MongoClient(mongoConnectionString);
    await cleanupClient.connect();
    await cleanupClient.db(databaseName).dropDatabase();
    await cleanupClient.close();
    mongo = await initMongo(mongoConnectionString, databaseName);
    logs = [];
    api = await buildServer({
      config,
      db: mongo.db,
      registrarClient: { searchWallets: async () => [] },
      hubClient: {},
      sendEmail: async () => ({}),
      loggerStream: { write: (line) => logs.push(line) },
    });
    await api.ready();
  });

  beforeEach(async () => {
    logs.length = 0;
    await Promise.all([
      mongo.db.collection('certificationRuns').deleteMany({}),
      mongo.db.collection('runEvidence').deleteMany({}),
      mongo.db.collection('notificationJobs').deleteMany({}),
    ]);
    await mongo.db.collection('certificationRuns').insertOne({
      runId: 'run-1',
      capability: 'ISSUING',
      state: RunStates.PASSED,
      walletId: 'wallet-service-1',
      walletName: 'Example Wallet',
      walletOrganizationId: 'did:web:wallet.example',
      walletOrganizationName: 'Wallet Company',
      applicantResultCapabilityHash: hashCapability(
        'applicant-result-token',
        config.capabilityPepper,
      ),
      supportResultCapabilityHash: hashCapability(
        'support-result-token',
        config.capabilityPepper,
      ),
      resultCapabilityExpiresAt: new Date('2026-07-28T01:00:00.000Z'),
      completedAt: new Date('2026-07-21T01:00:00.000Z'),
      revision: 4,
      reconcileFailures: 1,
      lastReconcileErrorCode: 'hub_unavailable',
      journal: [
        { state: RunStates.ISSUING, at: new Date('2026-07-21T00:55:00.000Z') },
        { state: RunStates.PASSED, at: new Date('2026-07-21T01:00:00.000Z') },
      ],
      createdAt: new Date('2026-07-21T00:55:00.000Z'),
      updatedAt: new Date('2026-07-21T01:00:00.000Z'),
      purgeAt: new Date('2027-07-21T01:00:00.000Z'),
    });
    await mongo.db.collection('runEvidence').insertOne({
      runId: 'run-1',
      applicantName: 'Alex Example',
      applicantEmail: 'alex@example.com',
      issuedCredential: {
        issuedAt: '2026-07-21T00:59:00.000Z',
        json: { type: ['OpenBadgeCredential'] },
        jwt: 'private.jwt.value',
      },
    });
    await mongo.db.collection('notificationJobs').insertMany([
      {
        jobId: 'run-1:APPLICANT',
        runId: 'run-1',
        role: 'APPLICANT',
        recipient: 'alex@example.com',
        message: 'private applicant link',
        status: 'SENT',
        attemptCount: 1,
        providerMessageId: 'provider-1',
      },
      {
        jobId: 'run-1:SUPPORT',
        runId: 'run-1',
        role: 'SUPPORT',
        recipient: 'support@velocitynetwork.foundation',
        message: 'private support link',
        status: 'PENDING',
        attemptCount: 0,
      },
    ]);
  });

  after(async () => {
    await api.close();
    await mongo.db.dropDatabase();
    await closeMongo();
  });

  it('exchanges an applicant fragment token for a narrowly scoped secure cookie', async () => {
    const response = await api.inject({
      method: 'POST',
      url: '/api/result-sessions',
      payload: { runId: 'run-1', token: 'applicant-result-token' },
    });

    expect(response.statusCode).toEqual(204);
    expect(response.headers['set-cookie']).toContain('wc_result_run-1=');
    expect(response.headers['set-cookie']).toContain('Path=/api/runs/run-1');
    expect(response.headers['set-cookie']).toContain('HttpOnly');
    expect(response.headers['set-cookie']).toContain('Secure');
    expect(response.headers['set-cookie']).toContain('SameSite=Strict');
    expect(response.body).not.toContain('applicant-result-token');
    expect(logs.join('')).not.toContain('applicant-result-token');
  });

  it('reads terminal evidence with an applicant result cookie', async () => {
    const session = await api.inject({
      method: 'POST',
      url: '/api/result-sessions',
      payload: { runId: 'run-1', token: 'applicant-result-token' },
    });
    const cookie = session.headers['set-cookie'].split(';')[0];

    const response = await api.inject({
      method: 'GET',
      url: '/api/runs/run-1',
      headers: { cookie },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json().result.credential.jwt).toEqual('private.jwt.value');
  });

  it('rejects wrong and expired result capabilities', async () => {
    const wrong = await api.inject({
      method: 'POST',
      url: '/api/result-sessions',
      payload: { runId: 'run-1', token: 'wrong-token-with-valid-length' },
    });
    await mongo.db.collection('certificationRuns').updateOne(
      { runId: 'run-1' },
      {
        $set: {
          resultCapabilityExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
        },
      },
    );
    const expired = await api.inject({
      method: 'POST',
      url: '/api/result-sessions',
      payload: { runId: 'run-1', token: 'applicant-result-token' },
    });

    expect(wrong.statusCode).toEqual(401);
    expect(expired.statusCode).toEqual(401);
  });

  it('recognizes a separate support capability', async () => {
    const response = await api.inject({
      method: 'POST',
      url: '/api/result-sessions',
      payload: { runId: 'run-1', token: 'support-result-token' },
    });

    expect(response.statusCode).toEqual(204);
    expect(response.headers['set-cookie']).toContain('wc_support_run-1=');
    expect(response.headers['set-cookie']).toContain('Path=/api/runs/run-1');
  });

  it('returns sanitized diagnostics with a support result cookie', async () => {
    const session = await api.inject({
      method: 'POST',
      url: '/api/result-sessions',
      payload: { runId: 'run-1', token: 'support-result-token' },
    });
    const cookie = session.headers['set-cookie'].split(';')[0];

    const response = await api.inject({
      method: 'GET',
      url: '/api/runs/run-1',
      headers: { cookie },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        audience: 'SUPPORT',
        runId: 'run-1',
        state: RunStates.PASSED,
        notifications: [
          expect.objectContaining({ role: 'APPLICANT', status: 'SENT' }),
          expect.objectContaining({ role: 'SUPPORT', status: 'PENDING' }),
        ],
      }),
    );
    expect(response.body).not.toContain('alex@example.com');
    expect(response.body).not.toContain('private.jwt.value');
    expect(response.body).not.toContain('private applicant link');
  });

  it('returns sanitized IAM-perimeter support diagnostics', async () => {
    const response = await api.inject({
      method: 'GET',
      url: '/api/support/runs/run-1',
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        runId: 'run-1',
        state: RunStates.PASSED,
        revision: 4,
        reconcileFailures: 1,
        notifications: [
          expect.objectContaining({ role: 'APPLICANT', status: 'SENT' }),
          expect.objectContaining({ role: 'SUPPORT', status: 'PENDING' }),
        ],
      }),
    );
    const serialized = response.body;
    expect(serialized).not.toContain('alex@example.com');
    expect(serialized).not.toContain('private.jwt.value');
    expect(serialized).not.toContain('private applicant link');
  });
});
