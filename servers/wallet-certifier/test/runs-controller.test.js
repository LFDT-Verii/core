const { once } = require('node:events');
const { createServer } = require('node:http');
const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { MongoClient } = require('mongodb');
const { buildServer } = require('../src/build-server');
const { createHubClient } = require('../src/adapters/hub-client');
const { createRegistrarClient } = require('../src/adapters/registrar-client');
const { closeMongo, initMongo } = require('../src/repositories/mongodb');
const { RunStates } = require('../src/domain/states');

const mongoConnectionString =
  process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const databaseName = 'test-wallet-certifier-runs';
const now = new Date('2026-07-21T01:00:00.000Z');

const wallets = [
  {
    id: 'did:web:vn-wallet.example',
    name: 'VN Wallet Company',
    service: [
      {
        id: 'did:web:vn-wallet.example#wallet-1',
        name: 'VN Wallet',
        supportedExchangeProtocols: ['VN_API'],
      },
    ],
  },
  {
    id: 'did:web:openid-wallet.example',
    name: 'OpenID Wallet Company',
    service: [
      {
        id: 'did:web:openid-wallet.example#wallet-1',
        name: 'OpenID Wallet',
        supportedExchangeProtocols: ['OPENID4VC'],
      },
    ],
  },
];

const injectRepeatedly = async (api, request, attempts, statusCodes = []) => {
  if (attempts === 0) {
    return statusCodes;
  }
  const response = await api.inject(request);
  return injectRepeatedly(api, request, attempts - 1, [
    ...statusCodes,
    response.statusCode,
  ]);
};

describe('certification run creation and start', () => {
  let api;
  let dependencyServer;
  let dependencyUrl;
  let mongo;
  let hubRequests;

  before(async () => {
    const cleanupClient = new MongoClient(mongoConnectionString);
    await cleanupClient.connect();
    await cleanupClient.db(databaseName).dropDatabase();
    await cleanupClient.close();

    dependencyServer = createServer(async (request, response) => {
      const url = new URL(request.url, 'http://dependencies.test');
      if (url.pathname.endsWith('/search-profiles')) {
        const query = url.searchParams.get('q');
        const result = wallets.filter((organization) =>
          organization.service.some(({ id }) => id === query),
        );
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ result }));
        return;
      }

      let body = {};
      for await (const chunk of request) {
        body = JSON.parse(chunk.toString());
      }
      hubRequests.push({
        path: url.pathname,
        body,
        authorization: request.headers.authorization,
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      if (url.pathname === '/operator/depots/create') {
        response.end(JSON.stringify({ depot: { id: 'depot-1' } }));
        return;
      }
      if (url.pathname === '/operator/credentials/create') {
        response.end(JSON.stringify({ credential: { id: 'credential-1' } }));
        return;
      }
      if (url.pathname === '/operator/issue-links/refresh') {
        response.end(
          JSON.stringify({
            redirectUrl:
              'https://hub.example.test/app-redirect?openid4vc_uri=private-offer&deeplink=old',
            vnProtocolLink: 'velocity-network-devnet://issue',
            openidCredentialOffer: 'openid-credential-offer://private',
          }),
        );
        return;
      }
      response.writeHead(404).end();
    });
    dependencyServer.listen(0, '127.0.0.1');
    await once(dependencyServer, 'listening');
    const address = dependencyServer.address();
    dependencyUrl = `http://127.0.0.1:${address.port}`;

    mongo = await initMongo(mongoConnectionString, databaseName);
    const config = {
      brandName: 'Velocity Network Foundation',
      logoUrl: undefined,
      registrationUrl: 'https://example.test/register-wallet',
      environmentName: 'devnet',
      registrarUrl: dependencyUrl,
      hubUrl: dependencyUrl,
      tenantId: 'tenant-1',
      issuerServiceId: 'issuer-service-1',
      relyingPartyServiceId: 'relying-party-service-1',
      achievementId: 'https://example.test/achievements/wallet-certifier',
      badgeImageUrl: 'https://example.test/badge.png',
      badgeCriteriaUrl: 'https://example.test/criteria',
      capabilityPepper: 'test-pepper',
      logSeverity: 'fatal',
      bodyLimit: 64 * 1024,
    };
    api = await buildServer({
      config,
      repositories: mongo.repositories,
      registrarClient: createRegistrarClient({ baseUrl: dependencyUrl }),
      hubClient: createHubClient({
        baseUrl: dependencyUrl,
        operatorToken: 'operator-secret',
        tenantId: config.tenantId,
      }),
      now: () => now,
      tokenFactory: () => 'test-interaction-token',
    });
    await api.ready();
  });

  beforeEach(async () => {
    hubRequests = [];
    await Promise.all([
      mongo.db.collection('certificationRuns').deleteMany({}),
      mongo.db.collection('runEvidence').deleteMany({}),
    ]);
  });

  after(async () => {
    await api.close();
    await new Promise((resolve) => {
      dependencyServer.close(resolve);
    });
    await mongo.db.dropDatabase();
    await closeMongo();
  });

  const createRun = (overrides = {}) =>
    api.inject({
      method: 'POST',
      url: '/api/runs',
      payload: {
        walletId: 'did:web:vn-wallet.example#wallet-1',
        applicantName: 'Alex Example',
        applicantEmail: 'alex@example.com',
        capability: 'ISSUING',
        ...overrides,
      },
    });

  it('validates applicant and capability input', async () => {
    const response = await createRun({
      applicantName: '',
      applicantEmail: 'not-an-email',
      capability: 'UNKNOWN',
    });

    expect(response.statusCode).toEqual(400);
    expect(
      await mongo.db.collection('certificationRuns').countDocuments(),
    ).toEqual(0);
  });

  it('revalidates the selected wallet and rejects unsupported wallets', async () => {
    const missing = await createRun({ walletId: 'did:web:missing#wallet' });
    const unsupported = await createRun({
      walletId: 'did:web:openid-wallet.example#wallet-1',
    });

    expect(missing.statusCode).toEqual(400);
    expect(missing.json().error).toEqual('wallet_not_found');
    expect(unsupported.statusCode).toEqual(400);
    expect(unsupported.json().error).toEqual('wallet_not_supported');
  });

  it('stores only sanitized run data and expiring PII evidence', async () => {
    const response = await createRun();

    expect(response.statusCode).toEqual(201);
    expect(response.json()).toEqual({
      runId: expect.any(String),
      interactionToken: 'test-interaction-token',
      capabilityExpiresAt: '2026-07-21T02:00:00.000Z',
    });
    const run = await mongo.db
      .collection('certificationRuns')
      .findOne({ runId: response.json().runId });
    const evidence = await mongo.db
      .collection('runEvidence')
      .findOne({ runId: response.json().runId });

    expect(run).toEqual(
      expect.objectContaining({
        capability: 'ISSUING',
        state: RunStates.CREATED,
        walletId: 'did:web:vn-wallet.example#wallet-1',
        walletName: 'VN Wallet',
        interactionCapabilityHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        revision: 0,
      }),
    );
    expect(JSON.stringify(run)).not.toContain('Alex Example');
    expect(JSON.stringify(run)).not.toContain('alex@example.com');
    expect(JSON.stringify(run)).not.toContain('test-interaction-token');
    expect(evidence).toEqual(
      expect.objectContaining({
        applicantName: 'Alex Example',
        applicantEmail: 'alex@example.com',
        purgeAt: new Date('2026-08-20T01:00:00.000Z'),
      }),
    );
    expect(run.purgeAt).toEqual(new Date('2027-07-21T01:00:00.000Z'));
  });

  it('rejects wrong and expired interaction capabilities', async () => {
    const created = await createRun();
    const { runId } = created.json();

    const wrong = await api.inject({
      method: 'POST',
      url: `/api/runs/${runId}/start`,
      headers: { authorization: 'Bearer wrong-token' },
    });
    await mongo.db
      .collection('certificationRuns')
      .updateOne(
        { runId },
        { $set: { capabilityExpiresAt: new Date('2026-07-21T00:59:59.000Z') } },
      );
    const expired = await api.inject({
      method: 'POST',
      url: `/api/runs/${runId}/start`,
      headers: { authorization: 'Bearer test-interaction-token' },
    });

    expect(wrong.statusCode).toEqual(401);
    expect(expired.statusCode).toEqual(401);
    expect(hubRequests).toHaveLength(0);
  });

  it('rate limits repeated capability authorization attempts', async () => {
    const created = await createRun();
    const { runId } = created.json();
    const statusCodes = await injectRepeatedly(
      api,
      {
        method: 'GET',
        url: `/api/runs/${runId}`,
        headers: { authorization: 'Bearer wrong-token' },
      },
      121,
    );

    expect(statusCodes.filter((statusCode) => statusCode === 401)).toHaveLength(
      120,
    );
    expect(statusCodes.filter((statusCode) => statusCode === 429)).toHaveLength(
      1,
    );
  });

  it('creates the depot, personalized badge, and VN-only issue redirect once', async () => {
    const created = await createRun();
    const { runId } = created.json();
    const request = {
      method: 'POST',
      url: `/api/runs/${runId}/start`,
      headers: { authorization: 'Bearer test-interaction-token' },
    };

    const started = await api.inject(request);
    const repeated = await api.inject(request);

    expect(started.statusCode).toEqual(200);
    expect(repeated.json()).toEqual(started.json());
    const redirect = new URL(started.json().redirectUrl);
    expect(redirect.searchParams.get('wallet')).toEqual(
      'did:web:vn-wallet.example#wallet-1',
    );
    expect(redirect.searchParams.get('deeplink')).toEqual(
      'velocity-network-devnet://issue',
    );
    expect(redirect.searchParams.has('openid4vc_uri')).toEqual(false);
    expect(started.json()).toEqual(
      expect.objectContaining({
        state: RunStates.ISSUING,
        qrValue: 'velocity-network-devnet://issue',
        actionDeadline: '2026-07-21T01:10:00.000Z',
        absoluteDeadline: '2026-07-21T01:15:00.000Z',
      }),
    );
    expect(hubRequests.map(({ path }) => path)).toEqual([
      '/operator/depots/create',
      '/operator/credentials/create',
      '/operator/issue-links/refresh',
    ]);
    expect(
      hubRequests.every(
        ({ authorization }) => authorization === 'Bearer operator-secret',
      ),
    ).toEqual(true);
    expect(hubRequests[1].body.credential.content).toEqual(
      expect.objectContaining({
        name: 'VN Wallet certification setup badge',
        credentialSubject: expect.objectContaining({
          identifier: [
            expect.objectContaining({ identityHash: 'alex@example.com' }),
          ],
          achievement: expect.objectContaining({
            description: expect.stringContaining('Alex Example'),
          }),
        }),
      }),
    );
    const run = await mongo.db
      .collection('certificationRuns')
      .findOne({ runId });
    const evidence = await mongo.db
      .collection('runEvidence')
      .findOne({ runId });
    expect(run).toEqual(
      expect.objectContaining({
        depotId: 'depot-1',
        setupCredentialId: 'credential-1',
        state: RunStates.ISSUING,
      }),
    );
    expect(JSON.stringify(run)).not.toContain(
      'velocity-network-devnet://issue',
    );
    expect(evidence.issueInteraction).toEqual(started.json());
  });

  it('uses the same setup issuance for verification certification', async () => {
    const created = await createRun({ capability: 'VERIFICATION' });
    const started = await api.inject({
      method: 'POST',
      url: `/api/runs/${created.json().runId}/start`,
      headers: { authorization: 'Bearer test-interaction-token' },
    });

    expect(started.statusCode).toEqual(200);
    expect(started.json().state).toEqual(RunStates.ISSUING);
    const run = await mongo.db.collection('certificationRuns').findOne({
      runId: created.json().runId,
    });
    expect(run.capability).toEqual('VERIFICATION');
    expect(hubRequests.map(({ path }) => path)).toEqual([
      '/operator/depots/create',
      '/operator/credentials/create',
      '/operator/issue-links/refresh',
    ]);
  });
});
