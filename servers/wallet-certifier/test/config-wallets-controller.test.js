const { once } = require('node:events');
const { createServer } = require('node:http');
const { Writable } = require('node:stream');
const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const { MongoClient } = require('mongodb');
const { buildServer } = require('../src/build-server');
const { closeMongo, initMongo } = require('../src/repositories/mongodb');

const mongoConnectionString =
  process.env.MONGO_URI ?? 'mongodb://localhost:27017';
const databaseName = 'test-wallet-certifier-config-wallets';

const registrarResults = [
  {
    id: 'did:web:vn-wallet.example',
    name: 'VN Wallet Company',
    logo: 'https://example.test/vn-company.png',
    service: [
      {
        id: 'did:web:vn-wallet.example#wallet-1',
        name: 'VN Wallet',
        logoUrl: 'https://example.test/vn-wallet.png',
        supportedExchangeProtocols: ['VN_API'],
        appleAppStoreUrl: 'https://apps.example.test/vn',
        playStoreUrl: 'https://play.example.test/vn',
      },
    ],
  },
  {
    id: 'did:web:dual-wallet.example',
    name: 'Dual Wallet Company',
    service: [
      {
        id: 'did:web:dual-wallet.example#wallet-1',
        name: 'Dual Wallet',
        supportedExchangeProtocols: ['VN_API', 'OPENID4VC'],
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

describe('configuration, health, and wallet search endpoints', () => {
  let api;
  let registrar;
  let registrarUrl;
  let mongo;
  let logs = '';
  const loggerStream = new Writable({
    write: (chunk, encoding, callback) => {
      logs += chunk.toString();
      callback();
    },
  });

  before(async () => {
    const cleanupClient = new MongoClient(mongoConnectionString);
    await cleanupClient.connect();
    await cleanupClient.db(databaseName).dropDatabase();
    await cleanupClient.close();

    registrar = createServer((request, response) => {
      const url = new URL(request.url, 'http://registrar.test');
      if (url.searchParams.get('q') === 'failure') {
        response.writeHead(503, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'registrar unavailable' }));
        return;
      }
      if (url.searchParams.get('q') === 'unexpected') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{');
        return;
      }
      expect(url.pathname).toEqual('/api/v0.6/organizations/search-profiles');
      expect(url.searchParams.get('filter.serviceTypes')).toEqual(
        'HolderAppProvider',
      );
      expect(url.searchParams.get('page.size')).toEqual('20');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ result: registrarResults }));
    });
    registrar.listen(0, '127.0.0.1');
    await once(registrar, 'listening');
    const address = registrar.address();
    registrarUrl = `http://127.0.0.1:${address.port}`;

    mongo = await initMongo(mongoConnectionString, databaseName);
    api = await buildServer({
      config: {
        brandName: 'Velocity Network Foundation',
        logoUrl: 'https://example.test/vnf.svg',
        registrationUrl: 'https://example.test/register-wallet',
        environmentName: 'testnet',
        registrarUrl,
        logSeverity: 'info',
        bodyLimit: 64 * 1024,
      },
      repositories: mongo.repositories,
      loggerStream,
    });
    await api.ready();
  });

  after(async () => {
    await api.close();
    await new Promise((resolve) => {
      registrar.close(resolve);
    });
    await mongo.db.dropDatabase();
    await closeMongo();
  });

  it('returns only public application configuration', async () => {
    const response = await api.inject({ method: 'GET', url: '/api/config' });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({
      brandName: 'Velocity Network Foundation',
      logoUrl: 'https://example.test/vnf.svg',
      registrationUrl: 'https://example.test/register-wallet',
      environmentName: 'testnet',
    });
    expect(response.body).not.toContain('token');
    expect(response.body).not.toContain('mongo');
  });

  it('reports health after pinging Mongo', async () => {
    const response = await api.inject({ method: 'GET', url: '/api/' });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('creates the run, evidence, and notification indexes', async () => {
    const indexNames = async (collectionName) =>
      (await mongo.db.collection(collectionName).indexes()).map(
        ({ name }) => name,
      );

    await expect(indexNames('certificationRuns')).resolves.toEqual(
      expect.arrayContaining(['runId_unique', 'active_runs_due', 'runs_ttl']),
    );
    await expect(indexNames('runEvidence')).resolves.toEqual(
      expect.arrayContaining(['runId_unique', 'evidence_ttl']),
    );
    await expect(indexNames('notificationJobs')).resolves.toEqual(
      expect.arrayContaining([
        'jobId_unique',
        'notification_jobs_due',
        'notification_jobs_ttl',
      ]),
    );
  });

  it('maps VN, dual-protocol, and OpenID-only wallets', async () => {
    const response = await api.inject({
      method: 'GET',
      url: '/api/wallets?q=wallet',
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({
      wallets: [
        {
          id: 'did:web:vn-wallet.example#wallet-1',
          organizationId: 'did:web:vn-wallet.example',
          name: 'VN Wallet',
          organizationName: 'VN Wallet Company',
          logoUrl: 'https://example.test/vn-wallet.png',
          protocols: ['VN_API'],
          eligible: true,
          appleAppStoreUrl: 'https://apps.example.test/vn',
          playStoreUrl: 'https://play.example.test/vn',
        },
        {
          id: 'did:web:dual-wallet.example#wallet-1',
          organizationId: 'did:web:dual-wallet.example',
          name: 'Dual Wallet',
          organizationName: 'Dual Wallet Company',
          protocols: ['VN_API', 'OPENID4VC'],
          eligible: true,
        },
        {
          id: 'did:web:openid-wallet.example#wallet-1',
          organizationId: 'did:web:openid-wallet.example',
          name: 'OpenID Wallet',
          organizationName: 'OpenID Wallet Company',
          protocols: ['OPENID4VC'],
          eligible: false,
          disabledReason: 'Phase one requires Velocity Network support.',
        },
      ],
    });
    expect(response.headers['content-security-policy']).toBeTruthy();
    expect(response.headers['x-content-type-options']).toEqual('nosniff');
  });

  it('bounds wallet search input', async () => {
    const tooShort = await api.inject({
      method: 'GET',
      url: '/api/wallets?q=x',
    });
    const whitespaceOnly = await api.inject({
      method: 'GET',
      url: '/api/wallets?q=%20%20',
    });
    const paddedTooShort = await api.inject({
      method: 'GET',
      url: '/api/wallets?q=%20x%20',
    });
    const tooLong = await api.inject({
      method: 'GET',
      url: `/api/wallets?q=${'x'.repeat(81)}`,
    });

    expect(tooShort.statusCode).toEqual(400);
    expect(whitespaceOnly.statusCode).toEqual(400);
    expect(paddedTooShort.statusCode).toEqual(400);
    expect(tooLong.statusCode).toEqual(400);
  });

  it('maps Registrar failures without exposing the upstream body', async () => {
    const response = await api.inject({
      method: 'GET',
      url: '/api/wallets?q=failure',
    });

    expect(response.statusCode).toEqual(502);
    expect(response.json()).toEqual({
      error: 'wallet_search_unavailable',
      message: 'Wallet search is temporarily unavailable.',
    });
    expect(response.body).not.toContain('registrar unavailable');
  });

  it('logs unexpected errors while returning a sanitized response', async () => {
    const logsBefore = logs.length;

    const response = await api.inject({
      method: 'GET',
      url: '/api/wallets?q=unexpected',
    });

    expect(response.statusCode).toEqual(500);
    expect(response.json()).toEqual({
      error: 'internal_error',
      message: 'The request could not be completed.',
    });
    expect(response.body).not.toContain('SyntaxError');
    expect(logs.slice(logsBefore)).toContain('SyntaxError');
  });

  it('does not write wallet search terms to logs', async () => {
    await api.inject({
      method: 'GET',
      url: '/api/wallets?q=sensitive%40example.com',
    });

    expect(logs).not.toContain('sensitive@example.com');
    expect(logs).not.toContain('sensitive%40example.com');
  });
});
