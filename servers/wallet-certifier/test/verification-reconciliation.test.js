const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { MongoClient } = require('mongodb');
const { buildServer } = require('../src/build-server');
const { hashCapability } = require('../src/domain/capabilities');
const { fingerprintJwt } = require('../src/domain/evidence');
const { RunStates } = require('../src/domain/states');
const { closeMongo, initMongo } = require('../src/repositories/mongo');

const mongoConnectionString =
  process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const databaseName = 'test-wallet-certifier-verification';
const interactionToken = 'verification-interaction-token';
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
const makeJwt = (vc) =>
  `${encode({ alg: 'ES256' })}.${encode({ vc })}.signature`;

const passingCredential = (jwt, overrides = {}) => ({
  format: 'JWT_VC',
  credential: jwt,
  w3cCredential: { type: ['VerifiableCredential'] },
  verified: true,
  tamperCheck: 'PASS',
  trustedIssuerCheck: 'PASS',
  trustedHolderCheck: 'PASS',
  revocationCheck: 'PASS',
  expiryCheck: 'PASS',
  ...overrides,
});

describe('verification reconciliation', () => {
  let api;
  let mongo;
  let config;
  let nowValue;
  let hubCredential;
  let hubExchange;
  let hubPresentations;
  let hubVerification;
  let verifyCalls;
  let refreshPresentationCalls;

  before(async () => {
    const cleanupClient = new MongoClient(mongoConnectionString);
    await cleanupClient.connect();
    await cleanupClient.db(databaseName).dropDatabase();
    await cleanupClient.close();
    mongo = await initMongo(mongoConnectionString, databaseName);
    config = {
      brandName: 'Velocity Network Foundation',
      environmentName: 'devnet',
      registrationUrl: 'https://example.test/register-wallet',
      registrarUrl: 'https://registrar.example.test',
      hubUrl: 'https://hub.example.test',
      capabilityPepper: 'verification-pepper',
      publicAppUrl: 'https://certifier.example.test',
      supportEmail: 'support@velocitynetwork.foundation',
      senderEmail: 'certifier@velocitynetwork.foundation',
      relyingPartyServiceId: 'rp-service-1',
      logSeverity: 'fatal',
      bodyLimit: 64 * 1024,
    };
    const hubClient = {
      getCredential: async () => hubCredential,
      getExchange: async () => hubExchange,
      refreshPresentationLink: async () => {
        refreshPresentationCalls += 1;
        return {
          redirectUrl:
            'https://hub.example.test/app-redirect?openid4vc_uri=remove',
          vnProtocolLink: 'velocity-network://inspect/request-1',
        };
      },
      getPresentations: async () => hubPresentations,
      verifyPresentation: async () => {
        verifyCalls += 1;
        return { verification: hubVerification };
      },
    };
    api = await buildServer({
      config,
      db: mongo.db,
      registrarClient: { searchWallets: async () => [] },
      hubClient,
      now: () => nowValue,
      tokenFactory: () => 'verification-result-token',
      sendEmail: async () => ({ MessageId: 'message-1' }),
    });
    await api.ready();
  });

  beforeEach(async () => {
    nowValue = new Date('2026-07-21T01:05:00.000Z');
    hubCredential = { id: 'credential-1' };
    hubExchange = {
      id: 'exchange-2',
      state: 'NEW',
      events: [{ state: 'NEW', timestamp: '2026-07-21T01:00:01.000Z' }],
      presentationIds: [],
    };
    hubPresentations = [];
    hubVerification = undefined;
    verifyCalls = 0;
    refreshPresentationCalls = 0;
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

  const seedRun = async (overrides = {}, evidenceOverrides = {}) => {
    const runId = overrides.runId ?? 'run-1';
    const setupJwt =
      evidenceOverrides.setupJwt ??
      makeJwt({
        type: ['OpenBadgeCredential'],
      });
    const run = {
      runId,
      capability: 'VERIFICATION',
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
      setupJwt,
      createdAt: new Date('2026-07-21T01:00:00.000Z'),
      updatedAt: new Date('2026-07-21T01:00:00.000Z'),
      purgeAt: new Date('2026-08-20T01:00:00.000Z'),
      ...evidenceOverrides,
    };
    delete evidence.setupJwt;
    await mongo.db.collection('certificationRuns').insertOne(run);
    await mongo.db.collection('runEvidence').insertOne(evidence);
    return { runId, setupJwt };
  };

  const status = (runId = 'run-1') =>
    api.inject({
      method: 'GET',
      url: `/api/runs/${runId}`,
      headers: { authorization: `Bearer ${interactionToken}` },
    });

  const start = (runId = 'run-1') =>
    api.inject({
      method: 'POST',
      url: `/api/runs/${runId}/start`,
      headers: { authorization: `Bearer ${interactionToken}` },
    });

  it('retains the issued setup badge and waits for explicit disclosure start', async () => {
    const jwt = makeJwt({ type: ['OpenBadgeCredential'] });
    hubCredential = {
      id: 'credential-1',
      acceptedAt: '2026-07-21T01:04:30.000Z',
      jwtVc: jwt,
    };
    await seedRun();

    const response = await status();

    expect(response.json()).toEqual(
      expect.objectContaining({
        state: RunStates.PREPARING_DISCLOSURE,
        setupCredential: expect.objectContaining({ jwt }),
      }),
    );
    const run = await mongo.db
      .collection('certificationRuns')
      .findOne({ runId: 'run-1' });
    expect(run.setupCredentialFingerprint).toEqual(fingerprintJwt(jwt));
    expect(
      await mongo.db.collection('notificationJobs').countDocuments(),
    ).toEqual(0);
  });

  it('creates one VN-only disclosure interaction on explicit start', async () => {
    const { setupJwt } = await seedRun(
      {
        state: RunStates.PREPARING_DISCLOSURE,
        setupCredentialFingerprint: fingerprintJwt(
          makeJwt({ type: ['OpenBadgeCredential'] }),
        ),
        nextCheckAt: null,
      },
      { issuedCredential: { jwt: makeJwt({ type: ['OpenBadgeCredential'] }) } },
    );
    await mongo.db
      .collection('certificationRuns')
      .updateOne(
        { runId: 'run-1' },
        { $set: { setupCredentialFingerprint: fingerprintJwt(setupJwt) } },
      );

    const first = await start();
    const second = await start();

    expect(first.json()).toEqual(
      expect.objectContaining({
        state: RunStates.DISCLOSING,
        qrValue: 'velocity-network://inspect/request-1',
        redirectUrl: expect.stringContaining(
          'wallet=did%3Aweb%3Awallet.example%23wallet-1',
        ),
      }),
    );
    expect(first.json().redirectUrl).not.toContain('openid4vc_uri');
    expect(second.json()).toEqual(first.json());
    expect(refreshPresentationCalls).toEqual(1);
  });

  const seedDisclosure = async () => {
    const setupJwt = makeJwt({ type: ['OpenBadgeCredential'] });
    await seedRun(
      {
        state: RunStates.DISCLOSING,
        setupCredentialFingerprint: fingerprintJwt(setupJwt),
      },
      {
        issuedCredential: {
          issuedAt: '2026-07-21T01:04:30.000Z',
          jwt: setupJwt,
        },
      },
    );
    return setupJwt;
  };

  it('keeps waiting while no presentation has been disclosed', async () => {
    await seedDisclosure();

    const response = await status();

    expect(response.json().state).toEqual(RunStates.DISCLOSING);
    expect(verifyCalls).toEqual(0);
  });

  it('passes a verified presentation containing the exact setup badge and other credentials', async () => {
    const setupJwt = await seedDisclosure();
    const otherJwt = makeJwt({ type: ['EmploymentCredential'] });
    hubExchange.presentationIds = ['presentation-1'];
    hubPresentations = [{ id: 'presentation-1', verifications: [] }];
    hubVerification = {
      verified: true,
      tamperCheck: 'PASS',
      credentials: [
        passingCredential(setupJwt, {
          w3cCredential: { type: ['OpenBadgeCredential'] },
        }),
        passingCredential(otherJwt, {
          w3cCredential: { type: ['EmploymentCredential'] },
        }),
      ],
    };

    const response = await status();
    const repeated = await status();

    expect(response.json()).toEqual(
      expect.objectContaining({
        state: RunStates.PASSED,
        result: expect.objectContaining({
          passed: true,
          presentation: { verified: true, checks: { tamper: 'PASS' } },
          credentials: expect.arrayContaining([
            expect.objectContaining({ jwt: setupJwt, verified: true }),
            expect.objectContaining({ jwt: otherJwt, verified: true }),
          ]),
        }),
      }),
    );
    expect(repeated.json()).toEqual(response.json());
    expect(verifyCalls).toEqual(1);
    const run = await mongo.db
      .collection('certificationRuns')
      .findOne({ runId: 'run-1' });
    expect(JSON.stringify(run)).not.toContain(setupJwt);
    expect(
      await mongo.db.collection('notificationJobs').countDocuments(),
    ).toEqual(2);
  });

  it('fails when the exact setup badge is absent', async () => {
    await seedDisclosure();
    const otherJwt = makeJwt({
      id: 'different-badge',
      type: ['OpenBadgeCredential'],
    });
    hubExchange.presentationIds = ['presentation-1'];
    hubPresentations = [{ id: 'presentation-1', verifications: [] }];
    hubVerification = {
      verified: true,
      tamperCheck: 'PASS',
      credentials: [passingCredential(otherJwt)],
    };

    const response = await status();

    expect(response.json()).toEqual(
      expect.objectContaining({
        state: RunStates.FAILED,
        result: expect.objectContaining({
          passed: false,
          setupBadgePresent: false,
        }),
      }),
    );
  });

  it('fails when an additional disclosed credential check fails', async () => {
    const setupJwt = await seedDisclosure();
    hubExchange.presentationIds = ['presentation-1'];
    hubPresentations = [{ id: 'presentation-1', verifications: [] }];
    hubVerification = {
      verified: true,
      tamperCheck: 'PASS',
      credentials: [
        passingCredential(setupJwt),
        passingCredential(makeJwt({ type: ['OtherCredential'] }), {
          verified: false,
          tamperCheck: 'FAIL',
        }),
      ],
    };

    const response = await status();

    expect(response.json().state).toEqual(RunStates.FAILED);
    expect(response.json().result.setupBadgePresent).toEqual(true);
    expect(response.json().result.credentials[1].checks.tamper).toEqual('FAIL');
  });

  it('returns disclosure exchange errors and enforces both deadlines', async () => {
    await seedDisclosure();
    hubExchange.error = {
      code: 'client_error',
      message: 'The wallet reported a protocol error.',
    };
    const errored = await status();
    expect(errored.json()).toEqual(
      expect.objectContaining({
        state: RunStates.ERROR,
        failure: hubExchange.error,
      }),
    );

    await mongo.db.collection('certificationRuns').deleteMany({});
    await mongo.db.collection('runEvidence').deleteMany({});
    hubExchange.error = undefined;
    nowValue = new Date('2026-07-21T01:10:00.000Z');
    await seedDisclosure();
    const timedOut = await status();
    expect(timedOut.json().state).toEqual(RunStates.TIMED_OUT);
    expect(timedOut.json().failure.code).toEqual('wallet_action_timeout');
  });
});
