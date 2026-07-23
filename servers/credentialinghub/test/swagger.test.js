const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const packageJson = require('../package.json');
const buildFastify = require('./helpers/create-test-fastify');

const DOCUMENTS = {
  operator: '/documentation/json',
  openid4vc: '/documentation/openid4vc.json',
  vnApi: '/documentation/vn-api.json',
};

const OPERATOR_SECURITY = [{ operatorBearer: [] }];
const OPENID4VC_SECURITY = [{ openid4vcAccessToken: [] }];
const VN_API_SECURITY = [{ vnApiAccessToken: [] }];

const EXPECTED_OPERATION_METADATA = {
  'GET /': ['Utilities', 'getServiceStatus'],
  'POST /operator/credentials/create': [
    'Credentials',
    'createCredential',
    OPERATOR_SECURITY,
  ],
  'POST /operator/credentials/create-many': [
    'Credentials',
    'createCredentials',
    OPERATOR_SECURITY,
  ],
  'GET /operator/credentials/get': [
    'Credentials',
    'getCredentials',
    OPERATOR_SECURITY,
  ],
  'POST /operator/credentials/revoke': [
    'Credentials',
    'revokeCredential',
    OPERATOR_SECURITY,
  ],
  'POST /operator/credentials/delete': [
    'Credentials',
    'deleteCredentials',
    OPERATOR_SECURITY,
  ],
  'POST /operator/depots/create': ['Depots', 'createDepot', OPERATOR_SECURITY],
  'GET /operator/depots/get': ['Depots', 'getDepots', OPERATOR_SECURITY],
  'POST /operator/depots/delete': ['Depots', 'deleteDepot', OPERATOR_SECURITY],
  'GET /operator/exchanges/get': [
    'Exchanges',
    'getExchange',
    OPERATOR_SECURITY,
  ],
  'POST /operator/issue-links/refresh': [
    'Issue Links',
    'refreshIssueLinks',
    OPERATOR_SECURITY,
  ],
  'POST /operator/issuer-services/create': [
    'Issuer Services',
    'createIssuerService',
    OPERATOR_SECURITY,
  ],
  'GET /operator/issuer-services/get': [
    'Issuer Services',
    'getIssuerServices',
    OPERATOR_SECURITY,
  ],
  'POST /operator/issuer-services/update': [
    'Issuer Services',
    'updateIssuerService',
    OPERATOR_SECURITY,
  ],
  'POST /operator/issuer-services/delete': [
    'Issuer Services',
    'deleteIssuerService',
    OPERATOR_SECURITY,
  ],
  'POST /operator/presentation-links/refresh': [
    'Presentation Links',
    'refreshPresentationLinks',
    OPERATOR_SECURITY,
  ],
  'GET /operator/presentations/get': [
    'Presentations',
    'getPresentations',
    OPERATOR_SECURITY,
  ],
  'POST /operator/presentations/verify': [
    'Presentations',
    'verifyPresentation',
    OPERATOR_SECURITY,
  ],
  'POST /operator/relying-party-services/create': [
    'Relying Party Services',
    'createRelyingPartyService',
    OPERATOR_SECURITY,
  ],
  'GET /operator/relying-party-services/get': [
    'Relying Party Services',
    'getRelyingPartyServices',
    OPERATOR_SECURITY,
  ],
  'POST /operator/relying-party-services/update': [
    'Relying Party Services',
    'updateRelyingPartyService',
    OPERATOR_SECURITY,
  ],
  'POST /operator/relying-party-services/delete': [
    'Relying Party Services',
    'deleteRelyingPartyService',
    OPERATOR_SECURITY,
  ],
  'POST /operator/tenants/create': [
    'Tenants',
    'createTenant',
    OPERATOR_SECURITY,
  ],
  'GET /operator/tenants/get': ['Tenants', 'getTenants', OPERATOR_SECURITY],
  'POST /operator/tenants/delete': [
    'Tenants',
    'deleteTenant',
    OPERATOR_SECURITY,
  ],
  'GET /.well-known/oauth-authorization-server/r/{tenantId}': [
    'Metadata & OAuth',
    'getOpenid4vcAuthorizationServerMetadata',
  ],
  'GET /.well-known/openid-credential-issuer/r/{tenantId}': [
    'Metadata & OAuth',
    'getOpenid4vcCredentialIssuerMetadata',
  ],
  'POST /r/{tenantId}/oauth/token': [
    'Metadata & OAuth',
    'createOpenid4vcAccessToken',
  ],
  'POST /r/{tenantId}/openid4vc/credential': [
    'OpenID4VCI',
    'createOpenid4vcCredential',
    OPENID4VC_SECURITY,
  ],
  'POST /r/{tenantId}/openid4vc/nonce': ['OpenID4VCI', 'createOpenid4vcNonce'],
  'POST /r/{tenantId}/openid4vc/notification': [
    'OpenID4VCI',
    'submitOpenid4vcNotification',
    OPENID4VC_SECURITY,
  ],
  'POST /r/{tenantId}/openid4vp/authorization-request/{requestId}': [
    'OpenID4VP',
    'createOpenid4vpAuthorizationRequest',
  ],
  'POST /r/{tenantId}/openid4vp/direct-post': [
    'OpenID4VP',
    'submitOpenid4vpAuthorizationResponse',
  ],
  'POST /vn-api/r/{tenantId}/authenticate': [
    'Issuing',
    'authenticateVnApiWallet',
  ],
  'POST /vn-api/r/{tenantId}/credential-offers': [
    'Issuing',
    'getVnApiCredentialOffers',
    VN_API_SECURITY,
  ],
  'GET /vn-api/r/{tenantId}/get-credential-manifest': [
    'Issuing',
    'getVnApiCredentialManifest',
  ],
  'GET /vn-api/r/{tenantId}/get-presentation-request': [
    'Presentation',
    'getVnApiPresentationRequest',
  ],
  'POST /vn-api/r/{tenantId}/issue-credentials': [
    'Issuing',
    'issueVnApiCredentials',
    VN_API_SECURITY,
  ],
  'POST /vn-api/r/{tenantId}/presentation': [
    'Presentation',
    'submitVnApiPresentation',
  ],
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

const getOperationEntries = (document) =>
  Object.entries(document.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => [
      `${method.toUpperCase()} ${path}`,
      operation,
    ]),
  );

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

  it('describes and secures every operation with stable metadata', () => {
    const operationIds = [];

    for (const document of Object.values(documents)) {
      for (const [operationKey, operation] of getOperationEntries(document)) {
        const [tag, operationId, security] =
          EXPECTED_OPERATION_METADATA[operationKey];

        expect(operation.tags).toEqual([tag]);
        expect(operation.summary).toEqual(expect.stringMatching(/\S/));
        expect(operation.operationId).toEqual(operationId);
        expect(operation.security).toEqual(security);
        operationIds.push(operation.operationId);
      }
    }

    expect(operationIds).toHaveLength(
      Object.keys(EXPECTED_OPERATION_METADATA).length,
    );
    expect(new Set(operationIds).size).toEqual(operationIds.length);
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
