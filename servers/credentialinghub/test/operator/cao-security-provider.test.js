const { spawnSync } = require('node:child_process');
const { after, afterEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const Fastify = require('fastify');
const fp = require('fastify-plugin');
const nock = require('nock').default;

const { initHttpClient: realInitHttpClient } = require('@verii/http-client');
const initHttpClient = mock.fn(realInitHttpClient);
mock.module('@verii/http-client', {
  namedExports: {
    ...require('@verii/http-client'),
    initHttpClient,
  },
});

const { buildMongoConnection } = require('@verii/tests-helpers');
const buildFastify = require('../helpers/create-test-fastify');
const { createAppServer } = require('../../src');
const {
  registerCaoSecurityProvider,
  resolveCaoSecurityProvider,
} = require('../../src/plugins/cao-security-provider');

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
const CAO_SECURITY_PROVIDER_MONGO_CONNECTION = buildMongoConnection(
  'test-credentialing-hub-cao-security-provider',
);
const TEST_BLOCKCHAIN_CLIENT_CREDENTIALS_RESOLVER = async () => ({
  cacheKey: 'test-cao',
  loadCredentials: async () => ({
    clientId: 'test-vnf-client',
    clientSecret: 'test-vnf-secret',
  }),
});
const VNF_AUTH_ORIGIN = 'http://vnf-auth.localhost.test';
const RPC_NODE_URL = 'http://rpc.localhost.test';
const BLOCKCHAIN_NETWORK_CONFIG = {
  blockchainApiAudience: 'https://blockchain.example.test',
  rpcUrl: RPC_NODE_URL,
  vnfOAuthTokensEndpoint: `${VNF_AUTH_ORIGIN}/oauth/token`,
};

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
    fastify.decorate('resolveBlockchainClientCredentials', resolver);
  });

const createCaoSecurityProvider = (overrides = {}) => ({
  operatorAuthPlugin: createTestOperatorAuthPlugin(),
  blockchainClientCredentialsPlugin:
    createTestBlockchainClientCredentialsPlugin(),
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
  initHttpClient.mock.resetCalls();
  initHttpClient.mock.mockImplementation(realInitHttpClient);
  nock.cleanAll();
});

after(() => {
  nock.restore();
});

// Fakes the VNF OAuth token endpoint and the RPC node, recording the token
// requests and the Authorization header of each RPC call.
const nockBlockchainNetwork = () => {
  const network = { tokenRequests: [], rpcAuthorizations: [] };
  nock(VNF_AUTH_ORIGIN)
    .post('/oauth/token')
    .reply(200, async (request) => {
      const tokenRequest = await request.json();
      network.tokenRequests.push(tokenRequest);
      return {
        access_token: `vnf-access-token-for-${tokenRequest.client_id}`,
        expires_in: 60,
      };
    });
  nock(RPC_NODE_URL)
    .post('/')
    .reply(200, async (request) => {
      network.rpcAuthorizations.push(request.headers.get('authorization'));
      const { id } = await request.json();
      return { jsonrpc: '2.0', id, result: '0x2a' };
    });
  return network;
};

const addBlockNumberRoute = (fastify) =>
  fastify.get('/test/block-number', async (request) => ({
    blockNumber: await request.rpcProvider.send('eth_blockNumber', []),
  }));

const createAuthenticationBoundary = (caoSecurityProvider, config = {}) => {
  const fastify = trackServer(Fastify());
  const resolvedCaoSecurityProvider =
    resolveCaoSecurityProvider(caoSecurityProvider);
  fastify.decorate('config', {
    isTest: true,
    defaultCaoDid: undefined,
    ...config,
  });
  registerCaoSecurityProvider(fastify, resolvedCaoSecurityProvider);
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

// Builds the Hub's production server, which runs here in test mode.
const createProductionServer = (caoSecurityProvider, configOverrides = {}) =>
  trackServer(
    createAppServer({
      caoSecurityProvider,
      configOverrides: {
        logSeverity: 'silent',
        mongoConnection: CAO_SECURITY_PROVIDER_MONGO_CONNECTION,
        ...DEFAULT_OPERATOR_CONFIG,
        ...configOverrides,
      },
    }),
  );

describe('CAO security provider Operator authentication', () => {
  it('registers provider config before its capability plugins', async () => {
    const fastify = trackServer(
      buildFastify(
        {},
        {
          caoSecurityProvider: createCaoSecurityProvider({
            configPlugin: fp(async (server) => {
              server.config.providerAuthenticationError =
                'provider-config-loaded';
            }),
            operatorAuthPlugin: fp(async (server) => {
              const { providerAuthenticationError } = server.config;
              if (providerAuthenticationError == null) {
                throw new Error('provider config was not loaded');
              }
              server.decorate(
                'authenticateOperator',
                async (request, reply) => {
                  await reply.code(401).send({
                    error: providerAuthenticationError,
                  });
                },
              );
            }),
            blockchainClientCredentialsPlugin: fp(async (server) => {
              if (server.config.providerAuthenticationError == null) {
                throw new Error('provider config was not loaded');
              }
              server.decorate(
                'resolveBlockchainClientCredentials',
                TEST_BLOCKCHAIN_CLIENT_CREDENTIALS_RESOLVER,
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
        error: 'provider-config-loaded',
      }),
    );
  });

  it('authenticates core Operator routes through the provider', async () => {
    const fastify = trackServer(
      buildFastify(
        {},
        {
          caoSecurityProvider: createCaoSecurityProvider({
            operatorAuthPlugin: fp(async (server) => {
              server.decorate(
                'authenticateOperator',
                async (request, reply) => {
                  await reply.code(401).send({
                    error: 'provider-authenticator-ran',
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
        error: 'provider-authenticator-ran',
      }),
    );
  });

  it('preserves the authenticator Fastify receiver', async () => {
    const fastify = createAuthenticationBoundary(
      createCaoSecurityProvider({
        operatorAuthPlugin: fp(async (server) => {
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

  it('prefers built-in CAO config overrides to the environment', () => {
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
        const { createAppServer } = require('./src');
        const expectedConfig = {
          operatorApiToken: 'overridden-operator-secret',
          defaultCaoDid: 'did:example:overridden-cao',
          vnfClientId: 'overridden-vnf-client',
          vnfClientSecret: 'overridden-vnf-secret',
        };
        const fastify = createAppServer({
          configOverrides: {
            ...expectedConfig,
            isTest: false,
            logSeverity: 'silent',
            mongoConnection: ${JSON.stringify(
              CAO_SECURITY_PROVIDER_MONGO_CONNECTION,
            )},
          },
        });
        fastify.ready()
          .then(async () => {
            for (const [key, value] of Object.entries(expectedConfig)) {
              if (fastify.config[key] !== value) {
                throw new Error(\`\${key} did not retain its config override\`);
              }
            }
            const response = await fastify.inject({
              method: 'GET',
              url: '/operator/tenants/get',
              headers: {
                authorization: 'Bearer overridden-operator-secret',
              },
            });
            if (response.statusCode !== 200) {
              throw new Error(
                \`overridden Operator token returned \${response.statusCode}\`,
              );
            }
          })
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
          let fastify;
          try {
            const { createAppServer } = require('./src');
            fastify = createAppServer({
              configOverrides: {
                mongoConnection: ${JSON.stringify(
                  CAO_SECURITY_PROVIDER_MONGO_CONNECTION,
                )},
              },
            });
          } catch (error) {
            process.stderr.write(\`synchronous: \${error.message}\`);
            process.exit(2);
          }
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

      expect(startup.status).toEqual(1);
      expect(startup.stderr).toContain(
        `"${environmentVariable}" is a required variable`,
      );
    }
  });

  it('keeps the test server blockchain authenticator', async () => {
    const network = nockBlockchainNetwork();
    const fastify = trackServer(buildFastify(BLOCKCHAIN_NETWORK_CONFIG));
    addBlockNumberRoute(fastify);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test/block-number',
    });

    expect(response.statusCode).toEqual(200);
    expect(network.tokenRequests).toEqual([]);
    expect(network.rpcAuthorizations).toEqual(['Bearer TOKEN']);
  });

  it('authenticates app server blockchain calls with the static credentials in test mode', async () => {
    const network = nockBlockchainNetwork();
    const fastify = createProductionServer(
      undefined,
      BLOCKCHAIN_NETWORK_CONFIG,
    );
    addBlockNumberRoute(fastify);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test/block-number',
    });

    expect(fastify.config.isTest).toEqual(true);
    expect(response.statusCode).toEqual(200);
    expect(network.tokenRequests).toEqual([
      {
        grant_type: 'client_credentials',
        client_id: DEFAULT_OPERATOR_CONFIG.vnfClientId,
        client_secret: DEFAULT_OPERATOR_CONFIG.vnfClientSecret,
        audience: BLOCKCHAIN_NETWORK_CONFIG.blockchainApiAudience,
      },
    ]);
    expect(network.rpcAuthorizations).toEqual([
      `Bearer vnf-access-token-for-${DEFAULT_OPERATOR_CONFIG.vnfClientId}`,
    ]);
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
            operatorAuthPlugin,
            blockchainClientCredentialsPlugin,
            documentation: {},
          },
          configOverrides: {
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

  it('rejects an incomplete provider instead of using static credentials', async () => {
    const fastify = createProductionServer({
      operatorAuthPlugin: createTestOperatorAuthPlugin(),
      documentation: {},
    });

    await expect(fastify.ready()).rejects.toThrow(
      "Plugin must be a function or a promise. Received: 'undefined'",
    );
  });

  it('rejects a missing blockchain credential cache key', async () => {
    const caoSecurityProvider = createCaoSecurityProvider({
      blockchainClientCredentialsPlugin:
        createTestBlockchainClientCredentialsPlugin({
          resolver: async () => ({
            loadCredentials: async () => ({
              clientId: 'cao-client',
              clientSecret: 'cao-secret',
            }),
          }),
        }),
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
      vnfOAuthTokensEndpoint: 'http://blockchain-auth.test/oauth/token',
    });
    fastify.get('/test/blockchain-authentication', async (request) => ({
      accessToken: await request.vnfBlockchainAuthenticate(),
    }));

    const response = await fastify.inject({
      method: 'GET',
      url: '/test/blockchain-authentication',
    });

    expect(response.statusCode).toEqual(500);
    expect(response.json()).toEqual(
      expect.objectContaining({
        message: 'VNF OAuth creds resolver cacheKey must be non-empty',
      }),
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
      blockchainClientCredentialsPlugin: fp(async (server) => {
        server
          .decorate('blockchainCredentialCacheKey', 'did:example:cao')
          .decorate(
            'resolveBlockchainClientCredentials',
            resolveBlockchainClientCredentials,
          );
      }),
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

  describe('in test mode', () => {
    const createCaoCredentialsResolver = () =>
      mock.fn(async () => ({
        cacheKey: 'did:example:cao',
        loadCredentials: async () => ({
          clientId: 'cao-client',
          clientSecret: 'cao-secret',
        }),
      }));

    const expectCaoCredentialsOnBlockchainCall = async (
      fastify,
      { network, resolveBlockchainClientCredentials },
    ) => {
      addBlockNumberRoute(fastify);

      const response = await fastify.inject({
        method: 'GET',
        url: '/test/block-number',
      });

      expect(fastify.config.isTest).toEqual(true);
      expect({
        statusCode: response.statusCode,
        body: response.json(),
      }).toEqual({ statusCode: 200, body: { blockNumber: '0x2a' } });
      expect(resolveBlockchainClientCredentials.mock.callCount()).toEqual(1);
      expect(network.tokenRequests).toEqual([
        {
          grant_type: 'client_credentials',
          client_id: 'cao-client',
          client_secret: 'cao-secret',
          audience: BLOCKCHAIN_NETWORK_CONFIG.blockchainApiAudience,
        },
      ]);
      expect(network.rpcAuthorizations).toEqual([
        'Bearer vnf-access-token-for-cao-client',
      ]);
    };

    it('authenticates app server blockchain calls with the provider credentials', async () => {
      const network = nockBlockchainNetwork();
      const resolveBlockchainClientCredentials = createCaoCredentialsResolver();
      const fastify = createProductionServer(
        createCaoSecurityProvider({
          blockchainClientCredentialsPlugin:
            createTestBlockchainClientCredentialsPlugin({
              resolver: resolveBlockchainClientCredentials,
            }),
        }),
        BLOCKCHAIN_NETWORK_CONFIG,
      );

      await expectCaoCredentialsOnBlockchainCall(fastify, {
        network,
        resolveBlockchainClientCredentials,
      });
    });

    it('replaces the test server blockchain authenticator with the provider credentials', async () => {
      const network = nockBlockchainNetwork();
      const resolveBlockchainClientCredentials = createCaoCredentialsResolver();
      const fastify = trackServer(
        buildFastify(BLOCKCHAIN_NETWORK_CONFIG, {
          caoSecurityProvider: createCaoSecurityProvider({
            blockchainClientCredentialsPlugin:
              createTestBlockchainClientCredentialsPlugin({
                resolver: resolveBlockchainClientCredentials,
              }),
          }),
        }),
      );

      await expectCaoCredentialsOnBlockchainCall(fastify, {
        network,
        resolveBlockchainClientCredentials,
      });
    });
  });
});
