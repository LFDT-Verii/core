const { spawnSync } = require('node:child_process');
const { afterEach, describe, it } = require('node:test');
const { expect } = require('expect');
const Fastify = require('fastify');
const fp = require('fastify-plugin');
const { buildMongoConnection } = require('@verii/tests-helpers');
const buildFastify = require('../helpers/create-test-fastify');
const { createAppServer, registerOperatorAuth } = require('../../src');

const TEST_PRINCIPAL = {
  caoDid: 'did:example:operator',
  subject: 'test-client',
  subjectType: 'client',
  authenticationMethod: 'test',
};

const createTestOperatorAuthPlugin = ({
  principal = TEST_PRINCIPAL,
  resolveVnfClientOAuthCreds,
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
  tenantIsolation: 'cao',
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
            );
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

  it('rejects a missing or empty CAO DID in CAO isolation mode', async () => {
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
          'operatorPrincipal.caoDid must be a non-empty string for CAO isolation',
        );
      }),
    );
  });

  it('allows a null CAO DID in legacy isolation mode', async () => {
    const fastify = createAuthenticationBoundary(
      createExtension({
        tenantIsolation: 'legacy',
        plugin: createTestOperatorAuthPlugin({
          principal: { ...TEST_PRINCIPAL, caoDid: undefined },
        }),
      }),
    );

    const response = await fastify.inject({
      method: 'GET',
      url: '/principal',
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({
      ...TEST_PRINCIPAL,
      caoDid: null,
    });
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
        extension: { tenantIsolation: 'cao', documentation: {} },
        message: 'operatorAuthExtension.plugin must be a function',
      },
      {
        extension: createExtension({ tenantIsolation: 'organization' }),
        message:
          "operatorAuthExtension.tenantIsolation must be 'legacy' or 'cao'",
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

  it('requires the static token only when no extension is supplied', async () => {
    const staticFastify = createAuthenticationBoundary(undefined, {
      isTest: false,
      operatorApiToken: undefined,
    });
    await expect(staticFastify.ready()).rejects.toThrow(
      'OPERATOR_API_TOKEN must be a non-empty string',
    );
    activeServers.delete(staticFastify);

    const extensionFastify = createAuthenticationBoundary(createExtension(), {
      isTest: false,
      operatorApiToken: undefined,
    });
    await extensionFastify.ready();
  });
});

describe('VNF OAuth creds resolver registration', () => {
  const createProductionServer = (operatorAuthExtension) =>
    trackServer(
      createAppServer({
        operatorAuthExtension,
        configOverrides: {
          isTest: false,
          logSeverity: 'silent',
          mongoConnection: buildMongoConnection('test-credentialing-hub'),
          operatorApiToken: undefined,
          vnfClientId: undefined,
          vnfClientSecret: undefined,
        },
      }),
    );

  it('installs an extension resolver before VNF authentication starts', async () => {
    const fastify = createProductionServer(
      createExtension({
        plugin: createTestOperatorAuthPlugin({
          resolveVnfClientOAuthCreds: async () => ({
            cacheKey: 'test-cao',
            loadOAuthCreds: async () => ({
              clientId: 'test-vnf-client',
              clientSecret: 'test-vnf-secret',
            }),
          }),
        }),
      }),
    );

    await fastify.ready();
  });

  it('uses the default resolver and requires both config values when no custom resolver is installed', async () => {
    const cases = [
      {
        config: { vnfClientId: undefined, vnfClientSecret: 'secret' },
        message: 'fastify.config.vnfClientId is required',
      },
      {
        config: { vnfClientId: 'client-id', vnfClientSecret: undefined },
        message: 'fastify.config.vnfClientSecret is required',
      },
    ];

    for (const { config, message } of cases) {
      const startup = spawnSync(
        process.execPath,
        [
          '-e',
          `
          const Fastify = require('fastify');
          const fp = require('fastify-plugin');
          const { authenticateVnfClientPlugin } =
            require('@verii/base-contract-io');
          const { registerOperatorAuth } =
            require('./src/plugins/operator-auth');
          const fastify = Fastify();
          fastify.decorate('config', ${JSON.stringify(config)});
          registerOperatorAuth(fastify, {
            plugin: fp(async (server) => {
              server.decorate('authenticateOperator', async () => {});
            }, { name: 'testOperatorAuth' }),
            tenantIsolation: 'cao',
            documentation: {},
          });
          fastify.register(authenticateVnfClientPlugin);
          fastify.ready((error) => {
            process.stderr.write(error?.message ?? 'ready');
            process.exit(error == null ? 0 : 1);
          });
        `,
        ],
        {
          cwd: require('node:path').resolve(__dirname, '../..'),
          encoding: 'utf8',
        },
      );

      expect(startup.status).toEqual(1);
      expect(startup.stderr).toContain(message);
    }
  });
});
