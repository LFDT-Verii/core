const { spawnSync } = require('node:child_process');
const { afterEach, describe, it } = require('node:test');
const { expect } = require('expect');
const Fastify = require('fastify');
const fp = require('fastify-plugin');
const {
  buildMongoConnection,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const buildFastify = require('../helpers/create-test-fastify');
const { createAppServer, registerOperatorAuth } = require('../../src');

const TEST_PRINCIPAL = {
  caoDid: 'did:example:operator',
  subject: 'test-client',
  subjectType: 'client',
  authenticationMethod: 'test',
};
const DEFAULT_OPERATOR_CONFIG = {
  operatorApiToken: 'operator-secret',
  defaultCaoDid: 'did:example:default-cao',
  vnfClientId: 'vnf-client',
  vnfClientSecret: 'vnf-secret',
};
const TEST_VNF_RESOLVER = async () => ({
  cacheKey: 'test-cao',
  loadOAuthCreds: async () => ({
    clientId: 'test-vnf-client',
    clientSecret: 'test-vnf-secret',
  }),
});

const createTestOperatorAuthPlugin = ({
  principal = TEST_PRINCIPAL,
  resolveVnfClientOAuthCreds = TEST_VNF_RESOLVER,
} = {}) =>
  fp(async (fastify) => {
    fastify.decorate('authenticateOperator', async (request) => {
      request.operatorPrincipal = {
        ...principal,
        privateClaim: 'must-not-leak',
      };
    });
    if (resolveVnfClientOAuthCreds != null) {
      fastify.decorate(
        'resolveVnfClientOAuthCreds',
        resolveVnfClientOAuthCreds,
      );
    }
  });

const createExtension = (overrides = {}) => ({
  plugin: createTestOperatorAuthPlugin(),
  documentation: {},
  ...overrides,
});

const activeServers = new Set();

const trackServer = (server) => {
  activeServers.add(server);
  return server;
};

afterEach(async () => {
  await Promise.all([...activeServers].map(async (server) => server.close()));
  activeServers.clear();
});

const createAuthenticationBoundary = (extension, config = {}) => {
  const fastify = trackServer(Fastify());
  fastify.decorate('config', {
    isTest: true,
    defaultCaoDid: undefined,
    ...config,
  });
  registerOperatorAuth(fastify, extension);
  fastify.get(
    '/principal',
    {
      onRequest: async (request, reply) =>
        fastify.authenticateOperator(request, reply),
    },
    async (request) => request.operatorPrincipal,
  );
  return fastify;
};

const createProductionServer = (operatorAuthExtension, configOverrides = {}) =>
  trackServer(
    createAppServer({
      operatorAuthExtension,
      configOverrides: {
        isTest: false,
        logSeverity: 'silent',
        mongoConnection: buildMongoConnection('test-credentialing-hub'),
        ...DEFAULT_OPERATOR_CONFIG,
        ...configOverrides,
      },
    }),
  );

const expectStartupError = async (fastify, message) => {
  try {
    await expect(fastify.ready()).rejects.toThrow(message);
  } finally {
    activeServers.delete(fastify);
    await mongoCloseWrapper();
  }
};

describe('operator authentication extension', () => {
  it('authenticates core Operator routes through the extension', async () => {
    const fastify = trackServer(
      buildFastify(
        {},
        {
          operatorAuthExtension: createExtension({
            plugin: fp(async (server) => {
              server.decorate(
                'authenticateOperator',
                async (request, reply) => {
                  await reply.code(401).send({
                    error: 'extension-authenticator-ran',
                  });
                },
              );
              server.decorate('resolveVnfClientOAuthCreds', TEST_VNF_RESOLVER);
            }),
          }),
        },
      ),
    );

    const response = await fastify.inject({
      method: 'GET',
      url: '/operator/tenants/get',
    });

    expect(response.statusCode).toEqual(401);
    expect(response.json()).toEqual(
      expect.objectContaining({
        error: 'extension-authenticator-ran',
      }),
    );
  });

  it('preserves the authenticator Fastify receiver through the HTTP boundary', async () => {
    const fastify = createAuthenticationBoundary(
      createExtension({
        plugin: fp(async (server) => {
          server
            .decorate('operatorCaoDid', TEST_PRINCIPAL.caoDid)
            .decorate(
              'authenticateOperator',
              async function authenticateOperator(request) {
                request.operatorPrincipal = {
                  ...TEST_PRINCIPAL,
                  caoDid: this.operatorCaoDid,
                };
              },
            )
            .decorate('resolveVnfClientOAuthCreds', TEST_VNF_RESOLVER);
        }),
      }),
    );

    const response = await fastify.inject({
      method: 'GET',
      url: '/principal',
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual(TEST_PRINCIPAL);
  });

  it('exposes only the normalized principal after authentication', async () => {
    const fastify = createAuthenticationBoundary(createExtension());

    const response = await fastify.inject({
      method: 'GET',
      url: '/principal',
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual(TEST_PRINCIPAL);
  });

  it('rejects a missing or empty CAO DID', async () => {
    await Promise.all(
      [undefined, ''].map(async (caoDid) => {
        const fastify = createAuthenticationBoundary(
          createExtension({
            plugin: createTestOperatorAuthPlugin({
              principal: { ...TEST_PRINCIPAL, caoDid },
            }),
          }),
        );

        const response = await fastify.inject({
          method: 'GET',
          url: '/principal',
        });

        expect(response.statusCode).toEqual(500);
        expect(response.json().message).toEqual(
          'operatorPrincipal.caoDid must be a non-empty string',
        );
      }),
    );
  });

  it('fails startup when the extension omits authenticateOperator', async () => {
    const fastify = createAuthenticationBoundary(
      createExtension({ plugin: fp(async () => {}) }),
    );

    await expect(fastify.ready()).rejects.toThrow(
      'operator authentication plugin must decorate authenticateOperator',
    );
  });

  it('fails startup when the extension shape is invalid', async () => {
    const invalidExtensions = [
      {
        extension: { documentation: {} },
        message: 'operatorAuthExtension.plugin must be a function',
      },
      {
        extension: createExtension({ documentation: 'oauth2' }),
        message: 'operatorAuthExtension.documentation must be an object',
      },
    ];

    await Promise.all(
      invalidExtensions.map(async ({ extension, message }) => {
        const fastify = createAuthenticationBoundary(extension);
        await expect(fastify.ready()).rejects.toThrow(message);
        activeServers.delete(fastify);
      }),
    );
  });
});

describe('default static Operator authentication', () => {
  it('accepts only the configured static bearer token', async () => {
    const fastify = createAuthenticationBoundary(undefined, {
      isTest: false,
      operatorApiToken: 'operator-secret',
      defaultCaoDid: 'did:example:default-cao',
    });

    const unauthorizedResponse = await fastify.inject({
      method: 'GET',
      url: '/principal',
    });
    const authenticatedResponse = await fastify.inject({
      method: 'GET',
      url: '/principal',
      headers: { authorization: 'Bearer operator-secret' },
    });

    expect(unauthorizedResponse.statusCode).toEqual(401);
    expect(authenticatedResponse.statusCode).toEqual(200);
    expect(authenticatedResponse.json()).toEqual({
      caoDid: 'did:example:default-cao',
      subject: 'legacy-operator-token',
      subjectType: 'client',
      authenticationMethod: 'static_bearer',
    });
  });

  it('requires every built-in Operator environment variable', () => {
    const requiredEnvironmentVariables = [
      'OPERATOR_API_TOKEN',
      'DEFAULT_CAO_DID',
      'VNF_OAUTH_CLIENT_ID',
      'VNF_OAUTH_CLIENT_SECRET',
    ];

    for (const environmentVariable of requiredEnvironmentVariables) {
      const childEnv = { ...process.env };
      delete childEnv[environmentVariable];
      const startup = spawnSync(
        process.execPath,
        [
          '-e',
          `
          try {
            const { createAppServer } = require('./src');
            createAppServer();
            process.exit(0);
          } catch (error) {
            process.stderr.write(error.message);
            process.exit(1);
          }
          `,
        ],
        {
          cwd: require('node:path').resolve(__dirname, '../..'),
          encoding: 'utf8',
          env: childEnv,
        },
      );

      expect(startup.status).toEqual(1);
      expect(startup.stderr).toContain(
        `"${environmentVariable}" is a required variable`,
      );
    }
  });
});

describe('VNF OAuth creds resolver registration', () => {
  it('allows a custom authenticator and VNF resolver without static configuration', () => {
    const childEnv = { ...process.env };
    for (const environmentVariable of [
      'OPERATOR_API_TOKEN',
      'DEFAULT_CAO_DID',
      'VNF_OAUTH_CLIENT_ID',
      'VNF_OAUTH_CLIENT_SECRET',
    ]) {
      delete childEnv[environmentVariable];
    }

    const startup = spawnSync(
      process.execPath,
      [
        '-e',
        `
        const fp = require('fastify-plugin');
        const { createAppServer } = require('./src');

        const operatorAuthPlugin = fp(
          async (fastify) => {
            fastify.decorate('authenticateOperator', async (request) => {
              request.operatorPrincipal = {
                caoDid: 'did:example:operator',
                subject: 'test-client',
                subjectType: 'client',
                authenticationMethod: 'test',
              };
            });
            fastify.decorate('resolveVnfClientOAuthCreds', async () => ({
              cacheKey: 'test-cao',
              loadOAuthCreds: async () => ({
                clientId: 'test-vnf-client',
                clientSecret: 'test-vnf-secret',
              }),
            }));
          },
          { name: 'testOperatorAuth' },
        );

        const fastify = createAppServer({
          operatorAuthExtension: {
            plugin: operatorAuthPlugin,
            documentation: {},
          },
          configOverrides: {
            isTest: false,
            logSeverity: 'silent',
            mongoConnection:
              'mongodb://localhost:27017/test-credentialing-hub-custom-auth',
          },
        });
        fastify.ready()
          .then(() => fastify.close())
          .then(() => process.exit(0))
          .catch((error) => {
            process.stderr.write(error.message);
            process.exit(1);
          });
        `,
      ],
      {
        cwd: require('node:path').resolve(__dirname, '../..'),
        encoding: 'utf8',
        env: childEnv,
      },
    );

    expect(startup.status).toEqual(0);
    expect(startup.stderr).toEqual('');
  });

  it('requires a custom VNF resolver with a custom authenticator', async () => {
    const fastify = createProductionServer(
      createExtension({
        plugin: createTestOperatorAuthPlugin({
          resolveVnfClientOAuthCreds: null,
        }),
      }),
    );

    await expectStartupError(
      fastify,
      'operator authentication plugin must decorate resolveVnfClientOAuthCreds',
    );
  });

  it('requires the custom VNF resolver to be a function', async () => {
    const fastify = createProductionServer(
      createExtension({
        plugin: createTestOperatorAuthPlugin({
          resolveVnfClientOAuthCreds: 'not-a-function',
        }),
      }),
    );

    await expectStartupError(
      fastify,
      'operator authentication plugin must decorate resolveVnfClientOAuthCreds',
    );
  });
});
