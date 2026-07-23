const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const packageJson = require('../package.json');
const buildFastify = require('./helpers/create-test-fastify');

const DOCUMENTS = {
  operator: '/documentation/json',
  openid4vc: '/documentation/openid4vc.json',
  vnApi: '/documentation/vn-api.json',
};

const EXPECTED_DOCUMENTS = {
  operator: {
    title: 'Velocity Credentialing Hub — Operator API',
    tags: [
      'Tenants',
      'Issuer Services',
      'Relying Party Services',
      'Depots',
      'Credentials',
      'Presentations',
      'Issue Links',
      'Presentation Links',
      'Exchanges',
      'Utilities',
    ],
    operations: [
      'GET /',
      'POST /operator/credentials/create',
      'POST /operator/credentials/create-many',
      'GET /operator/credentials/get',
      'POST /operator/credentials/revoke',
      'POST /operator/credentials/delete',
      'POST /operator/depots/create',
      'GET /operator/depots/get',
      'POST /operator/depots/delete',
      'GET /operator/exchanges/get',
      'POST /operator/issue-links/refresh',
      'POST /operator/issuer-services/create',
      'GET /operator/issuer-services/get',
      'POST /operator/issuer-services/update',
      'POST /operator/issuer-services/delete',
      'POST /operator/presentation-links/refresh',
      'GET /operator/presentations/get',
      'POST /operator/presentations/verify',
      'POST /operator/relying-party-services/create',
      'GET /operator/relying-party-services/get',
      'POST /operator/relying-party-services/update',
      'POST /operator/relying-party-services/delete',
      'POST /operator/tenants/create',
      'GET /operator/tenants/get',
      'POST /operator/tenants/delete',
    ],
  },
  openid4vc: {
    title: 'Velocity Credentialing Hub — OpenID4VC Wallet API',
    tags: ['OpenID4VCI', 'OpenID4VP', 'Metadata & OAuth'],
    operations: [
      'GET /.well-known/oauth-authorization-server/r/{tenantId}',
      'GET /.well-known/openid-credential-issuer/r/{tenantId}',
      'POST /r/{tenantId}/oauth/token',
      'POST /r/{tenantId}/openid4vc/credential',
      'POST /r/{tenantId}/openid4vc/nonce',
      'POST /r/{tenantId}/openid4vc/notification',
      'POST /r/{tenantId}/openid4vp/authorization-request/{requestId}',
      'POST /r/{tenantId}/openid4vp/direct-post',
    ],
  },
  vnApi: {
    title: 'Velocity Credentialing Hub — VN-API Wallet API',
    tags: ['Issuing', 'Presentation'],
    operations: [
      'POST /vn-api/r/{tenantId}/authenticate',
      'POST /vn-api/r/{tenantId}/credential-offers',
      'GET /vn-api/r/{tenantId}/get-credential-manifest',
      'GET /vn-api/r/{tenantId}/get-presentation-request',
      'POST /vn-api/r/{tenantId}/issue-credentials',
      'POST /vn-api/r/{tenantId}/presentation',
    ],
  },
};

const getOperations = (document) =>
  Object.entries(document.paths)
    .flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
    )
    .sort();

describe('swagger documents', () => {
  let fastify;
  let documents;

  before(async () => {
    fastify = buildFastify();
    documents = Object.fromEntries(
      await Promise.all(
        Object.entries(DOCUMENTS).map(async ([audience, url]) => {
          const result = await fastify.injectJson({ method: 'GET', url });
          expect(result.statusCode).toEqual(200);
          return [audience, result.json];
        }),
      ),
    );
  });

  after(async () => {
    await fastify.close();
  });

  it('partitions every documented operation into its audience document', () => {
    const operationSets = [];

    for (const [audience, expected] of Object.entries(EXPECTED_DOCUMENTS)) {
      const document = documents[audience];
      const operations = getOperations(document);
      operationSets.push(operations);

      expect(document.info.title).toEqual(expected.title);
      expect(document.info.version).toEqual(packageJson.version);
      expect(document.tags.map(({ name }) => name)).toEqual(expected.tags);
      expect(operations).toEqual([...expected.operations].sort());
      expect(operations).not.toContain('GET /app-redirect');
      expect(
        operations.every((operation) => !operation.includes('/documentation')),
      ).toBe(true);
    }

    const allOperations = operationSets.flat();
    expect(new Set(allOperations).size).toEqual(allOperations.length);
  });

  it('offers all documents in Swagger UI with Operator API selected', async () => {
    const result = await fastify.inject({
      method: 'GET',
      url: '/documentation/static/swagger-initializer.js',
    });

    expect(result.statusCode).toEqual(200);
    expect(result.body).toContain('Operator API');
    expect(result.body).toContain(DOCUMENTS.operator);
    expect(result.body).toContain('OpenID4VC Wallet API');
    expect(result.body).toContain(DOCUMENTS.openid4vc);
    expect(result.body).toContain('VN-API Wallet API');
    expect(result.body).toContain(DOCUMENTS.vnApi);
    expect(result.body).toContain('"urls.primaryName":"Operator API"');
  });
});
