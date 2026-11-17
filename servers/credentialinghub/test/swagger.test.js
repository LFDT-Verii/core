const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const fp = require('fastify-plugin');
const {
  compact,
  defaultTo,
  filter,
  find,
  flatMap,
  flow,
  get: getPath,
  includes,
  isPlainObject,
  keyBy,
  keys,
  map,
  mapValues,
  overSome,
  reject,
  startsWith,
  uniq,
  values,
} = require('lodash/fp');
const { buildMongoConnection } = require('@verii/tests-helpers');
const packageJson = require('../package.json');
const buildFastify = require('./helpers/create-test-fastify');
const { createAppServer } = require('../src');

const DOCUMENTS = {
  operator: '/documentation/json',
  openid4vc: '/documentation/openid4vc.json',
  vnApi: '/documentation/vn-api.json',
};

const OPERATOR_SECURITY = [{ operatorAuth: [] }];
const OPENID4VCI_SECURITY = [{ openid4vciAccessToken: [] }];
const VN_API_SECURITY = [{ vnApiAccessToken: [] }];

const EXPECTED_OPENID4VCI_SUMMARIES = {
  'GET /.well-known/oauth-authorization-server/r/{tenantId}':
    'Get OpenID4VCI authorization server metadata',
  'GET /.well-known/openid-credential-issuer/r/{tenantId}':
    'Get OpenID4VCI credential issuer metadata',
  'POST /r/{tenantId}/oauth/token': 'Create an OpenID4VCI access token',
  'POST /r/{tenantId}/openid4vc/credential': 'Create an OpenID4VCI credential',
  'POST /r/{tenantId}/openid4vc/deferred_credential':
    'Create an OpenID4VCI deferred credential',
  'POST /r/{tenantId}/openid4vc/nonce': 'Create an OpenID4VCI nonce',
  'POST /r/{tenantId}/openid4vc/notification':
    'Submit an OpenID4VCI notification',
};

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
  'POST /operator/depots/get': ['Depots', 'findDepots', OPERATOR_SECURITY],
  'POST /operator/depots/delete': ['Depots', 'deleteDepot', OPERATOR_SECURITY],
  'POST /operator/depots/resolve-deferred-credentials': [
    'Depots',
    'resolveDeferredCredentials',
    OPERATOR_SECURITY,
  ],
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
  'POST /operator/presentations/delete': [
    'Presentations',
    'deletePresentations',
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
  'POST /operator/tenants/update': [
    'Tenants',
    'updateTenant',
    OPERATOR_SECURITY,
  ],
  'GET /.well-known/oauth-authorization-server/r/{tenantId}': [
    'OpenID4VCI',
    'getOpenid4vciAuthorizationServerMetadata',
  ],
  'GET /.well-known/openid-credential-issuer/r/{tenantId}': [
    'OpenID4VCI',
    'getOpenid4vciCredentialIssuerMetadata',
  ],
  'POST /r/{tenantId}/oauth/token': [
    'OpenID4VCI',
    'createOpenid4vciAccessToken',
  ],
  'POST /r/{tenantId}/openid4vc/credential': [
    'OpenID4VCI',
    'createOpenid4vciCredential',
    OPENID4VCI_SECURITY,
  ],
  'POST /r/{tenantId}/openid4vc/deferred_credential': [
    'OpenID4VCI',
    'createOpenid4vciDeferredCredential',
    OPENID4VCI_SECURITY,
  ],
  'POST /r/{tenantId}/openid4vc/nonce': ['OpenID4VCI', 'createOpenid4vciNonce'],
  'POST /r/{tenantId}/openid4vc/notification': [
    'OpenID4VCI',
    'submitOpenid4vciNotification',
    OPENID4VCI_SECURITY,
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
  'POST /vn-api/r/{tenantId}/decline-presentation': [
    'Presentation',
    'declineVnApiPresentation',
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
    securitySchemes: ['operatorAuth'],
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
      'POST /operator/depots/get',
      'POST /operator/depots/delete',
      'POST /operator/depots/resolve-deferred-credentials',
      'GET /operator/exchanges/get',
      'POST /operator/issue-links/refresh',
      'POST /operator/issuer-services/create',
      'GET /operator/issuer-services/get',
      'POST /operator/issuer-services/update',
      'POST /operator/issuer-services/delete',
      'POST /operator/presentation-links/refresh',
      'GET /operator/presentations/get',
      'POST /operator/presentations/verify',
      'POST /operator/presentations/delete',
      'POST /operator/relying-party-services/create',
      'GET /operator/relying-party-services/get',
      'POST /operator/relying-party-services/update',
      'POST /operator/relying-party-services/delete',
      'POST /operator/tenants/create',
      'GET /operator/tenants/get',
      'POST /operator/tenants/delete',
      'POST /operator/tenants/update',
    ],
  },
  openid4vc: {
    title: 'Velocity Credentialing Hub — OpenID4VC Wallet API',
    securitySchemes: ['openid4vciAccessToken'],
    tags: ['OpenID4VCI', 'OpenID4VP'],
    operations: [
      'GET /.well-known/oauth-authorization-server/r/{tenantId}',
      'GET /.well-known/openid-credential-issuer/r/{tenantId}',
      'POST /r/{tenantId}/oauth/token',
      'POST /r/{tenantId}/openid4vc/credential',
      'POST /r/{tenantId}/openid4vc/deferred_credential',
      'POST /r/{tenantId}/openid4vc/nonce',
      'POST /r/{tenantId}/openid4vc/notification',
      'POST /r/{tenantId}/openid4vp/authorization-request/{requestId}',
      'POST /r/{tenantId}/openid4vp/direct-post',
    ],
  },
  vnApi: {
    title: 'Velocity Credentialing Hub — VN-API Wallet API',
    securitySchemes: ['vnApiAccessToken'],
    tags: ['Issuing', 'Presentation'],
    operations: [
      'POST /vn-api/r/{tenantId}/authenticate',
      'POST /vn-api/r/{tenantId}/credential-offers',
      'POST /vn-api/r/{tenantId}/decline-presentation',
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

const SCHEMA_REFERENCE_PREFIX = '#/components/schemas/';

const isUnvisitedObject = (value, seen) =>
  value != null && typeof value === 'object' && !seen.has(value);

const getSchemaReference = (value) =>
  typeof value.$ref === 'string' &&
  value.$ref.startsWith(SCHEMA_REFERENCE_PREFIX)
    ? value.$ref.slice(SCHEMA_REFERENCE_PREFIX.length)
    : null;

const getSchemaReferences = (value, seen = new WeakSet()) => {
  if (!isUnvisitedObject(value, seen)) {
    return new Set();
  }

  seen.add(value);
  const references = new Set();
  const schemaReference = getSchemaReference(value);
  if (schemaReference != null) {
    references.add(schemaReference);
  }

  for (const child of Object.values(value)) {
    for (const reference of getSchemaReferences(child, seen)) {
      references.add(reference);
    }
  }

  return references;
};

const getReachableSchemaNames = (document) => {
  const schemas = document.components?.schemas ?? {};
  const reachable = new Set();
  const pending = [...getSchemaReferences(document.paths)];

  while (pending.length > 0) {
    const schemaName = pending.pop();
    if (!reachable.has(schemaName)) {
      reachable.add(schemaName);
      pending.push(...getSchemaReferences(schemas[schemaName]));
    }
  }

  return reachable;
};

const LOCAL_COMPONENT_REFERENCE_PREFIX = '#/components/';

const getLocalComponentReference = (value) =>
  typeof value.$ref === 'string' &&
  value.$ref.startsWith(LOCAL_COMPONENT_REFERENCE_PREFIX)
    ? value.$ref
    : null;

const getLocalComponentReferences = (value, seen = new WeakSet()) => {
  if (!isUnvisitedObject(value, seen)) {
    return new Set();
  }

  seen.add(value);
  const references = new Set();
  const localComponentReference = getLocalComponentReference(value);
  if (localComponentReference != null) {
    references.add(localComponentReference);
  }

  for (const child of Object.values(value)) {
    for (const reference of getLocalComponentReferences(child, seen)) {
      references.add(reference);
    }
  }

  return references;
};

// The keywords of an OpenAPI 3.0 Schema Object. Extensions start with x-.
const OPENAPI_30_SCHEMA_KEYWORDS = [
  '$ref',
  'additionalProperties',
  'allOf',
  'anyOf',
  'default',
  'deprecated',
  'description',
  'discriminator',
  'enum',
  'example',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'externalDocs',
  'format',
  'items',
  'maxItems',
  'maxLength',
  'maxProperties',
  'maximum',
  'minItems',
  'minLength',
  'minProperties',
  'minimum',
  'multipleOf',
  'not',
  'nullable',
  'oneOf',
  'pattern',
  'properties',
  'readOnly',
  'required',
  'title',
  'type',
  'uniqueItems',
  'writeOnly',
  'xml',
];

// OpenAPI 3.0 has no null type: a schema is nullable instead
const OPENAPI_30_TYPES = [
  'array',
  'boolean',
  'integer',
  'number',
  'object',
  'string',
];

const isOpenApi30Keyword = overSome([
  (keyword) => includes(keyword, OPENAPI_30_SCHEMA_KEYWORDS),
  startsWith('x-'),
]);

const isOpenApi30Type = (type) => includes(type, OPENAPI_30_TYPES);

// The schemas nested in a schema. additionalProperties can be a boolean.
const subschemas = (schema) =>
  filter(isPlainObject, [
    ...values(schema.properties),
    schema.items,
    schema.not,
    schema.additionalProperties,
    ...flatMap(defaultTo([]), [schema.allOf, schema.anyOf, schema.oneOf]),
  ]);

// A schema and every schema nested in it
const withSubschemas = (schema) => [
  schema,
  ...flatMap(withSubschemas, subschemas(schema)),
];

const componentSchema = (document, title) =>
  find({ title }, values(document.components.schemas));

const CLAIMS_PATH_POINTER_SEGMENT_PATH = [
  'properties',
  'verifiablePresentationAuthRules',
  'items',
  'properties',
  'path',
  'items',
  'items',
];

const resolveLocalReference = (document, reference) =>
  reference
    .slice(2)
    .split('/')
    .map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, token) => value?.[token], document);

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
      expect(Object.keys(document.components?.securitySchemes ?? {})).toEqual(
        expected.securitySchemes,
      );
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

  it('uses OpenID4VCI terminology for issuance operations', () => {
    const operations = Object.fromEntries(
      getOperationEntries(documents.openid4vc),
    );

    for (const [operationKey, summary] of Object.entries(
      EXPECTED_OPENID4VCI_SUMMARIES,
    )) {
      expect(operations[operationKey].summary).toEqual(summary);
    }
  });

  it('returns the same depots response from GET and POST depots/get', () => {
    const { get, post } = documents.operator.paths['/operator/depots/get'];

    expect(post.responses['200']).toEqual(get.responses['200']);
  });

  it('documents the serviceId and depotId of depots/get as ObjectIds', () => {
    const { get, post } = documents.operator.paths['/operator/depots/get'];
    const objectId = { type: 'string', pattern: '^[0-9a-fA-F]{24}$' };
    const idFilters = {
      serviceId: objectId,
      depotId: { anyOf: [objectId, { type: 'array', items: objectId }] },
    };

    expect(
      flow(keyBy('name'), mapValues('schema'))(get.parameters),
    ).toMatchObject(idFilters);
    expect(
      resolveLocalReference(
        documents.operator,
        getPath(
          ['requestBody', 'content', 'application/json', 'schema', '$ref'],
          post,
        ),
      ).properties,
    ).toMatchObject(idFilters);
  });

  it('documents the item errors in the credentials/create-many 400 response only', () => {
    const getBadRequestSchema = (path) => {
      const { schema } =
        documents.operator.paths[path].post.responses['400'].content[
          'application/json'
        ];
      return schema.$ref == null
        ? schema
        : resolveLocalReference(documents.operator, schema.$ref);
    };

    expect(
      getBadRequestSchema('/operator/credentials/create-many').properties,
    ).toEqual({
      error: { type: 'string' },
      message: { type: 'string' },
      statusCode: { type: 'integer' },
      errorCode: { type: 'string' },
      requestId: { type: 'string' },
      errors: {
        type: 'array',
        description: expect.any(String),
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer', description: expect.any(String) },
            path: { type: 'string', description: expect.any(String) },
            errorCode: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['index', 'path', 'errorCode', 'message'],
        },
      },
    });
    expect(
      getBadRequestSchema('/operator/credentials/create').properties,
    ).not.toHaveProperty('errors');
  });

  it('emits only reachable schemas and no dangling component refs', () => {
    for (const document of Object.values(documents)) {
      expect(new Set(Object.keys(document.components?.schemas ?? {}))).toEqual(
        getReachableSchemaNames(document),
      );
      for (const reference of getLocalComponentReferences(document)) {
        expect(resolveLocalReference(document, reference)).toBeDefined();
      }
    }
  });

  it('uses only the schema keywords and types that OpenAPI 3.0 has', () => {
    for (const document of Object.values(documents)) {
      const schemas = flatMap(
        withSubschemas,
        values(document.components?.schemas),
      );
      const usedKeywords = flow(flatMap(keys), uniq)(schemas);
      const usedTypes = flow(map('type'), compact, uniq)(schemas);

      expect(reject(isOpenApi30Keyword, usedKeywords)).toEqual([]);
      expect(reject(isOpenApi30Type, usedTypes)).toEqual([]);
    }
  });

  it('documents a null claims path pointer segment as nullable', () => {
    for (const title of ['new-issuer-service', 'issuer-service']) {
      const issuerService = componentSchema(documents.operator, title);

      expect(getPath(CLAIMS_PATH_POINTER_SEGMENT_PATH, issuerService)).toEqual({
        anyOf: [
          { type: 'string', minLength: 1, nullable: true },
          { type: 'integer', minimum: 0 },
        ],
      });
    }
  });

  it("documents the issuer service's auth method rules", () => {
    const newIssuerService = componentSchema(
      documents.operator,
      'new-issuer-service',
    );
    const authRuleProperties =
      newIssuerService.properties.verifiablePresentationAuthRules.items
        .properties;

    expect(newIssuerService.anyOf).toEqual([
      {
        description: 'preauth only',
        properties: {
          authMethods: { type: 'array', items: { enum: ['preauth'] } },
        },
      },
      {
        description: 'internal verifiable_presentation, alone or with preauth',
        required: ['disclosureRequest', 'verifiablePresentationAuthRules'],
        properties: {
          authMode: { enum: ['internal'] },
          verifiablePresentationAuthRules: { type: 'array', minItems: 1 },
        },
        not: { required: ['presentationDefinition'] },
      },
    ]);
    expect(authRuleProperties.valueIndex).toEqual(
      expect.objectContaining({ type: 'integer', minimum: 0, maximum: 9 }),
    );
    expect(authRuleProperties.rule).toEqual(
      expect.objectContaining({
        enum: ['pick', 'equal'],
        description: expect.stringMatching(/`pick` .*`equal` /),
      }),
    );
    expect(
      newIssuerService.properties.disclosureRequest.properties.types.items,
    ).toEqual(
      expect.objectContaining({
        required: ['type'],
        additionalProperties: false,
      }),
    );
  });

  it('documents the limits of a new depot and a new credential', () => {
    const newDepot = componentSchema(documents.operator, 'new-depot');
    const newCredential = componentSchema(documents.operator, 'new-credential');

    expect(newDepot.properties.authValues).toEqual(
      expect.objectContaining({ minItems: 1, maxItems: 10 }),
    );
    expect(newDepot.properties.authValues.items.anyOf).toContainEqual({
      type: 'string',
      minLength: 1,
      pattern: '\\S',
    });
    expect(newDepot.properties.userReference).toEqual(
      expect.objectContaining({ minLength: 1, maxLength: 64 }),
    );
    expect(newCredential.properties.credentialReference).toEqual(
      expect.objectContaining({ minLength: 1, maxLength: 64 }),
    );
    expect(newCredential.properties.tags).toEqual({
      type: 'array',
      maxItems: 10,
      items: { type: 'string', minLength: 1, maxLength: 32 },
    });
  });

  it('offers all documents in Swagger UI without preconfigured OAuth credentials', async () => {
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
    expect(result.body).toContain('ui.initOAuth({})');
    expect(result.body).not.toContain('persistAuthorization');
    expect(result.body).not.toContain('clientId');
  });
});

describe('CAO security provider documentation', () => {
  it('includes Operator auth metadata supplied by the provider', async () => {
    const operatorSecurityScheme = {
      type: 'oauth2',
      flows: {
        clientCredentials: {
          tokenUrl: '/operator/oauth/token',
          scopes: {},
        },
      },
    };
    const fastify = createAppServer({
      caoSecurityProvider: {
        operatorAuthPlugin: fp(async (server) => {
          server.decorate('authenticateOperator', async (request) => {
            request.operatorPrincipal = {
              caoDid: 'did:example:operator',
              subject: 'operator-client',
              subjectType: 'client',
              authenticationMethod: 'test',
            };
          });
        }),
        blockchainClientCredentialsPlugin: fp(async (server) => {
          server.decorate('resolveBlockchainClientCredentials', async () => ({
            cacheKey: 'did:example:operator',
            loadCredentials: async () => ({
              clientId: 'test-client',
              clientSecret: 'test-secret',
            }),
          }));
        }),
        documentation: {
          operatorSecurityScheme,
          tags: [
            {
              name: 'Operator Authentication',
              description: 'Machine authentication.',
            },
          ],
        },
      },
      configOverrides: {
        mongoConnection: buildMongoConnection('test-credentialing-hub'),
      },
    });

    try {
      const response = await fastify.inject({
        method: 'GET',
        url: DOCUMENTS.operator,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json().components.securitySchemes.operatorAuth).toEqual(
        operatorSecurityScheme,
      );
      expect(response.json().tags[0]).toEqual({
        name: 'Operator Authentication',
        description: 'Machine authentication.',
      });
    } finally {
      await fastify.close();
    }
  });
});
