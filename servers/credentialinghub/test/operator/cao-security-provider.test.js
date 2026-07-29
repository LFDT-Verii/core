const { spawnSync } = require('node:child_process');
const { afterEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const Fastify = require('fastify');
const fp = require('fastify-plugin');

const { initHttpClient: realInitHttpClient } = require('@verii/http-client');
const initHttpClient = mock.fn(realInitHttpClient);
mock.module('@verii/http-client', {
  namedExports: {
    ...require('@verii/http-client'),
    initHttpClient,
  },
});

const {
  buildMongoConnection,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const buildFastify = require('../helpers/create-test-fastify');
const { createAppServer, registerCaoSecurityProvider } = require('../../src');

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
const TEST_BLOCKCHAIN_CLIENT_CREDENTIALS_RESOLVER = async () => ({
  cacheKey: 'test-cao',
  loadCredentials: async () => ({
    clientId: 'test-vnf-client',
    clientSecret: 'test-vnf-secret',
  }),
});

const createTestOperatorAuthPlugin = ({ principal = TEST_PRINCIPAL } = {}) =>
  fp(async (fastify) => {
    fastify.decorate('authenticateOperator', async (request) => {
      request.operatorPrincipal = {
        ...principal,
        privateClaim: 'provider-owned',
      };
    });
  });

const createTestBlockchainClientCredentialsPlugin = ({
  resolver = TEST_BLOCKCHAIN_CLIENT_CREDENTIALS_RESOLVER,
} = {}) =>
  fp(async (fastify) => {
    if (resolver != null) {
      fastify.decorate('resolveBlockchainClientCredentials', resolver);
    }
  });

const createCaoSecurityProvider = (overrides = {}) => ({
  operatorAuth: {
    plugin: createTestOperatorAuthPlugin(),
    documentation: {},
  },
  blockchainClientCredentials: {
    plugin: createTestBlockchainClientCredentialsPlugin(),
  },
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
  initHttpClient.mock.resetCalls();
  initHttpClient.mock.mockImplementation(realInitHttpClient);
});

const createAuthenticationBoundary = (caoSecurityProvider, config = {}) => {
  const fastify = trackServer(Fastify());
  fastify.decorate('config', {
    isTest: true,
    defaultCaoDid: undefined,
    ...config,
  });
  registerCaoSecurityProvider(fastify, caoSecurityProvider);
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

const createProductionServer = (caoSecurityProvider, configOverrides = {}) =>
  trackServer(
    createAppServer({
      caoSecurityProvider,
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

describe('CAO security provider Operator authentication', () => {
  it('authenticates core Operator routes through the provider', async () => {
    const fastify = trackServer(
      buildFastify(
        {},
        {
          caoSecurityProvider: createCaoSecurityProvider({
            operatorAuth: {
              plugin: fp(async (server) => {
                server.decorate(
                  'authenticateOperator',
                  async (request, reply) => {
                    await reply.code(401).send({
                      error: 'provider-authenticator-ran',
                    });
                  },
                );
              }),
              documentation: {},
            },
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
        error: 'provider-authenticator-ran',
      }),
    );
  });

  it('preserves the authenticator Fastify receiver', async () => {
    const fastify = createAuthenticationBoundary(
      createCaoSecurityProvider({
        operatorAuth: {
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
          documentation: {},
        },
      }),
    );

    const response = await fastify.inject({
      method: 'GET',
      url: '/principal',
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual(TEST_PRINCIPAL);
  });

  it('trusts provider-owned principal data', async () => {
    const fastify = createAuthenticationBoundary(createCaoSecurityProvider());

    const response = await fastify.inject({
      method: 'GET',
      url: '/principal',
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({
      ...TEST_PRINCIPAL,
      privateClaim: 'provider-owned',
    });
  });

  it('fails startup when operatorAuth omits authenticateOperator', async () => {
    const fastify = createAuthenticationBoundary(
      createCaoSecurityProvider({
        operatorAuth: {
          plugin: fp(async () => {}),
          documentation: {},
        },
      }),
    );

    await expect(fastify.ready()).rejects.toThrow(
      'CAO security provider operatorAuth plugin must decorate authenticateOperator',
    );
  });

  it('requires authenticateOperator to be a function', async () => {
    const fastify = createAuthenticationBoundary(
      createCaoSecurityProvider({
        operatorAuth: {
          plugin: fp(async (server) => {
            server.decorate('authenticateOperator', 'not-a-function');
          }),
          documentation: {},
        },
      }),
    );

    await expect(fastify.ready()).rejects.toThrow(
      'CAO security provider operatorAuth plugin must decorate authenticateOperator',
    );
  });

  it('fails startup when the provider shape is invalid', async () => {
    const invalidProviders = [
      {
        provider: 'oauth2',
        message: 'caoSecurityProvider must be an object',
      },
      {
        provider: {
          blockchainClientCredentials:
            createCaoSecurityProvider().blockchainClientCredentials,
        },
        message: 'caoSecurityProvider.operatorAuth must be an object',
      },
      {
        provider: createCaoSecurityProvider({
          operatorAuth: { documentation: {} },
        }),
        message: 'caoSecurityProvider.operatorAuth.plugin must be a function',
      },
      {
        provider: createCaoSecurityProvider({
          operatorAuth: {
            plugin: createTestOperatorAuthPlugin(),
            documentation: 'oauth2',
          },
        }),
        message:
          'caoSecurityProvider.operatorAuth.documentation must be an object',
      },
      {
        provider: {
          operatorAuth: createCaoSecurityProvider().operatorAuth,
        },
        message:
          'caoSecurityProvider.blockchainClientCredentials must be an object',
      },
      {
        provider: createCaoSecurityProvider({
          blockchainClientCredentials: {},
        }),
        message:
          'caoSecurityProvider.blockchainClientCredentials.plugin must be a function',
      },
    ];

    await Promise.all(
      invalidProviders.map(async ({ provider, message }) => {
        const fastify = createAuthenticationBoundary(provider);
        await expect(fastify.ready()).rejects.toThrow(message);
        activeServers.delete(fastify);
      }),
    );
  });
});

describe('default static CAO security', () => {
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

  it('requires every built-in CAO security environment variable', () => {
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

describe('blockchain client credentials capability', () => {
  it('allows a complete provider without static configuration', () => {
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
          },
          { name: 'testOperatorAuth' },
        );
        const blockchainClientCredentialsPlugin = fp(
          async (fastify) => {
            fastify.decorate(
              'resolveBlockchainClientCredentials',
              async () => ({
                cacheKey: 'test-cao',
                loadCredentials: async () => ({
                  clientId: 'test-vnf-client',
                  clientSecret: 'test-vnf-secret',
                }),
              }),
            );
          },
          { name: 'testBlockchainClientCredentials' },
        );

        const fastify = createAppServer({
          caoSecurityProvider: {
            operatorAuth: {
              plugin: operatorAuthPlugin,
              documentation: {},
            },
            blockchainClientCredentials: {
              plugin: blockchainClientCredentialsPlugin,
            },
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
  });

  it('requires resolveBlockchainClientCredentials', async () => {
    const fastify = createProductionServer(
      createCaoSecurityProvider({
        blockchainClientCredentials: {
          plugin: createTestBlockchainClientCredentialsPlugin({
            resolver: null,
          }),
        },
      }),
    );

    await expectStartupError(
      fastify,
      'CAO security provider blockchainClientCredentials plugin must decorate resolveBlockchainClientCredentials',
    );
  });

  it('requires resolveBlockchainClientCredentials to be a function', async () => {
    const fastify = createProductionServer(
      createCaoSecurityProvider({
        blockchainClientCredentials: {
          plugin: createTestBlockchainClientCredentialsPlugin({
            resolver: 'not-a-function',
          }),
        },
      }),
    );

    await expectStartupError(
      fastify,
      'CAO security provider blockchainClientCredentials plugin must decorate resolveBlockchainClientCredentials',
    );
  });

  it('requires the blockchain capability plugin to own its resolver', async () => {
    const fastify = createProductionServer(
      createCaoSecurityProvider({
        operatorAuth: {
          plugin: fp(async (server) => {
            server
              .decorate('authenticateOperator', async () => {})
              .decorate(
                'resolveBlockchainClientCredentials',
                TEST_BLOCKCHAIN_CLIENT_CREDENTIALS_RESOLVER,
              );
          }),
          documentation: {},
        },
        blockchainClientCredentials: {
          plugin: fp(async () => {}),
        },
      }),
    );

    await expectStartupError(
      fastify,
      'CAO security provider blockchainClientCredentials plugin must own resolveBlockchainClientCredentials',
    );
  });

  it('supplies resolved credentials through request blockchain authentication', async () => {
    const loadCredentials = mock.fn(async () => ({
      clientId: 'cao-client',
      clientSecret: 'cao-secret',
    }));
    const resolveBlockchainClientCredentials = mock.fn(
      async function resolveCredentials() {
        return {
          cacheKey: this.blockchainCredentialCacheKey,
          loadCredentials,
        };
      },
    );
    const caoSecurityProvider = createCaoSecurityProvider({
      blockchainClientCredentials: {
        plugin: fp(async (server) => {
          server
            .decorate('blockchainCredentialCacheKey', 'did:example:cao')
            .decorate(
              'resolveBlockchainClientCredentials',
              resolveBlockchainClientCredentials,
            );
        }),
      },
    });
    const post = mock.fn(async () => ({
      json: async () => ({
        access_token: 'cao-access-token',
        expires_in: 60,
      }),
    }));
    initHttpClient.mock.mockImplementation(() => () => ({ post }));
    const fastify = createProductionServer(caoSecurityProvider, {
      blockchainApiAudience: 'https://blockchain.example.test',
      vnfClientId: 'static-client-must-not-be-used',
      vnfClientSecret: 'static-secret-must-not-be-used',
      vnfOAuthTokensEndpoint: 'http://blockchain-auth.test/oauth/token',
    });
    fastify.get('/test/blockchain-authentication', async (request) => ({
      accessToken: await request.vnfBlockchainAuthenticate(),
    }));

    expect(loadCredentials.mock.callCount()).toEqual(0);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test/blockchain-authentication',
    });

    expect({
      statusCode: response.statusCode,
      body: response.json(),
    }).toEqual({
      statusCode: 200,
      body: { accessToken: 'cao-access-token' },
    });
    expect(resolveBlockchainClientCredentials.mock.callCount()).toEqual(1);
    expect(resolveBlockchainClientCredentials.mock.calls[0].this).toBe(fastify);
    expect(
      resolveBlockchainClientCredentials.mock.calls[0].arguments[0].url,
    ).toEqual('/test/blockchain-authentication');
    expect(loadCredentials.mock.callCount()).toEqual(1);
    expect(post.mock.calls[0].arguments).toEqual([
      'http://blockchain-auth.test/oauth/token',
      {
        grant_type: 'client_credentials',
        client_id: 'cao-client',
        client_secret: 'cao-secret',
        audience: 'https://blockchain.example.test',
      },
    ]);
  });
});
