/**
 * Copyright 2023 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const { createHash } = require('node:crypto');
const http = require('node:http');
const { setImmediate } = require('node:timers/promises');
const { afterEach, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const pinoTest = require('pino-test');

const { loadTestEnv, buildMongoConnection } = require('@verii/tests-helpers');
const { initHttpClient } = require('@verii/http-client');
const { loggerProvider } = require('@verii/logger');

loadTestEnv();
const { genericConfig } = require('@verii/config');
const { createServer } = require('../src/create-server');

const mongoConnection = buildMongoConnection('credentialagent');
const VELOCITY_LOGO_SHA256 =
  '1078983907572b93f8672a1b97ee7671e809bd8b9b31ef7721564648f5f4bd9c';
const VELOCITY_FAVICON_SHA256 =
  '324b10dc04fc04c974013d718df366bda259e599b8bbbec47443a450105b211a';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const listenTestServer = async (server) => {
  const { appPort, appHost } = server.config;
  await server.listen({ port: appPort, host: appHost });
};

describe('Server package variant tests ', () => {
  let server;

  beforeEach(() => {
    server = createServer({
      ...genericConfig,
      mongoConnection,
    });
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  it('server with null response payload should respond with "null" response body', async () => {
    server.get('/', async (req, reply) => {
      return reply.status(200).send(null);
    });
    await listenTestServer(server);
    const response = await server.inject({ method: 'get', url: '/' });
    expect(response.body).toEqual('null');
  });

  it('server with <Array> response payload should respond with <Array> response body', async () => {
    server.get('/', async (req, reply) => {
      return reply.status(200).send([]);
    });
    await listenTestServer(server);
    const response = await server.inject({
      method: 'get',
      url: '/',
    });
    expect(response.body).toEqual('[]');
  });

  it('server post method and <Object> response payload should respond with <Object> response body', async () => {
    server.post('/', async (req, reply) => {
      return reply.status(200).send({});
    });
    const response = await server.inject({
      method: 'post',
      url: '/',
      payload: {},
    });
    expect(response.body).toEqual('{}');
  });

  it('server should 404 when route does not exist', async () => {
    await listenTestServer(server);
    try {
      await server.inject({
        method: 'get',
        url: '/',
      });
    } catch (e) {
      expect(e.response.statusCode).toEqual(404);
    }
  });

  it('server that throws an Error with validation should trigger the error hook', async () => {
    server.get('/', async () => {
      throw new Error('fake error');
    });

    await listenTestServer(server);
    try {
      await server.inject({
        method: 'get',
        url: '/',
      });
    } catch (e) {
      expect(e.response.statusCode).toEqual(500);
    }
  });

  it('omits sensitive route payloads from logs while retaining normal debug payload logs', async () => {
    await server.close();
    const config = {
      ...genericConfig,
      logSeverity: 'debug',
      mongoConnection,
    };
    const logEntries = [];
    const logSink = pinoTest.sink();
    logSink.on('data', (entry) => logEntries.push(entry));
    const log = loggerProvider({ ...config, destination: logSink });
    server = createServer(config, log);
    server.post(
      '/sensitive',
      { config: { sensitiveLogging: true } },
      async () => ({
        result: 'sensitive-response-body',
        clientSecret: 'returned-secret',
      }),
    );
    server.post(
      '/sensitive-error',
      { config: { sensitiveLogging: true } },
      async () => {
        throw new Error('safe failure');
      },
    );
    server.post('/not-sensitive', async () => ({
      result: 'public-response-body',
    }));

    const sensitiveResponse = await server.inject({
      method: 'post',
      url: '/sensitive',
      headers: {
        authorization: 'Basic c2Vuc2l0aXZlOnNlY3JldA==',
        'x-provisioning-code': 'sensitive-provisioning-code',
      },
      payload: {
        request: 'sensitive-request-body',
        clientSecret: 'submitted-secret',
      },
    });
    const sensitiveErrorResponse = await server.inject({
      method: 'post',
      url: '/sensitive-error',
      headers: {
        authorization: 'Basic ZmFpbHVyZTpzZWNyZXQ=',
        'x-provisioning-code': 'failure-provisioning-code',
      },
      payload: {
        request: 'sensitive-error-request-body',
        clientSecret: 'failure-submitted-secret',
      },
    });
    const normalResponse = await server.inject({
      method: 'post',
      url: '/not-sensitive',
      payload: { request: 'public-request-body' },
    });

    expect(sensitiveResponse.statusCode).toEqual(200);
    expect(sensitiveErrorResponse.statusCode).toEqual(500);
    expect(normalResponse.statusCode).toEqual(200);

    const logs = JSON.stringify(logEntries);
    for (const sensitiveValue of [
      'sensitive-request-body',
      'sensitive-response-body',
      'submitted-secret',
      'returned-secret',
      'sensitive-error-request-body',
      'failure-submitted-secret',
      'Basic c2Vuc2l0aXZlOnNlY3JldA==',
      'Basic ZmFpbHVyZTpzZWNyZXQ=',
      'sensitive-provisioning-code',
      'failure-provisioning-code',
    ]) {
      expect(logs).not.toContain(sensitiveValue);
    }

    expect(logEntries).not.toHaveLength(0);
    const logEntriesForRoute = (url) => {
      const requestLog = logEntries.find(
        (entry) => entry.req?.url === url && entry.msg === 'incoming request',
      );
      return logEntries.filter((entry) => entry.reqId === requestLog.reqId);
    };
    const sensitiveLogs = logEntriesForRoute('/sensitive');
    const sensitiveErrorLogs = logEntriesForRoute('/sensitive-error');
    const publicLogs = logEntriesForRoute('/not-sensitive');

    for (const logEntry of [...sensitiveLogs, ...sensitiveErrorLogs]) {
      expect(logEntry).not.toHaveProperty('body');
      expect(logEntry).not.toHaveProperty('headers');
    }
    expect(publicLogs).toContainEqual(
      expect.objectContaining({
        body: { request: 'public-request-body' },
        msg: 'request',
      }),
    );
    expect(publicLogs).toContainEqual(
      expect.objectContaining({
        body: { result: 'public-response-body' },
        msg: 'response body',
      }),
    );
  });
});

describe('Swagger documentation', () => {
  let server;

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  it('serves the default documentation endpoints', async () => {
    server = createServer({
      ...genericConfig,
      mongoConnection,
      swaggerInfo: {
        info: { title: 'Public API', version: '1.0.0' },
      },
    });

    const responses = await Promise.all(
      ['/documentation/json', '/documentation/yaml', '/documentation/'].map(
        (url) => server.inject({ method: 'get', url }),
      ),
    );

    for (const response of responses) {
      expect(response.statusCode).toEqual(200);
    }
  });

  it('serves the approved Velocity logo and favicon', async () => {
    server = createServer({
      ...genericConfig,
      mongoConnection,
      swaggerInfo: {
        info: { title: 'Public API', version: '1.0.0' },
      },
    });

    const [html, initializer, favicon] = await Promise.all([
      server.inject({ method: 'get', url: '/documentation/' }),
      server.inject({
        method: 'get',
        url: '/documentation/static/swagger-initializer.js',
      }),
      server.inject({
        method: 'get',
        url: '/documentation/static/theme/velocity-favicon.png',
      }),
    ]);
    const [, logoBase64] =
      initializer.body.match(/data:image\/png;base64,([^']+)/) ?? [];

    expect(html.statusCode).toEqual(200);
    expect(html.body).toContain('./static/theme/velocity-favicon.png');
    expect(initializer.statusCode).toEqual(200);
    expect(logoBase64).toBeDefined();
    expect(sha256(Buffer.from(logoBase64, 'base64'))).toEqual(
      VELOCITY_LOGO_SHA256,
    );
    expect(favicon.statusCode).toEqual(200);
    expect(favicon.headers['content-type']).toEqual('image/png');
    expect(sha256(favicon.rawPayload)).toEqual(VELOCITY_FAVICON_SHA256);
  });

  it('serves named documentation using its decorator and Swagger UI selector', async () => {
    server = createServer({
      ...genericConfig,
      mongoConnection,
      swaggerInfo: {
        info: { title: 'Public API', version: '1.0.0' },
      },
      swaggerDocuments: {
        primaryName: 'Public API',
        documents: [
          {
            name: 'Internal API',
            url: '/documentation/internal.json',
            decorator: 'internalSwagger',
            openapi: {
              info: { title: 'Internal API', version: '1.0.0' },
            },
            transform: ({ schema, url }) => ({
              schema: { ...schema, hide: url !== '/internal' },
              url,
            }),
            transformObject: ({ openapiObject }) => ({
              ...openapiObject,
              info: {
                ...openapiObject.info,
                title: `${openapiObject.info.title} (transformed)`,
              },
            }),
          },
        ],
      },
    });
    server.register((instance, options, done) => {
      instance.get('/public', () => ({ public: true }));
      instance.get('/internal', () => ({ internal: true }));
      done();
    });

    const internalDocument = await server.inject({
      method: 'get',
      url: '/documentation/internal.json',
    });
    const swaggerUiInitializer = await server.inject({
      method: 'get',
      url: '/documentation/static/swagger-initializer.js',
    });

    expect(internalDocument.statusCode).toEqual(200);
    expect(server.internalSwagger).toBeDefined();
    expect(JSON.parse(internalDocument.body).info.title).toEqual(
      'Internal API (transformed)',
    );
    expect(JSON.parse(internalDocument.body).paths).toEqual({
      '/internal': expect.any(Object),
    });
    expect(JSON.parse(internalDocument.body).paths).not.toHaveProperty(
      '/documentation/internal.json',
    );
    expect(swaggerUiInitializer.statusCode).toEqual(200);
    expect(swaggerUiInitializer.body).toContain('/documentation/json');
    expect(swaggerUiInitializer.body).toContain('/documentation/internal.json');
    expect(swaggerUiInitializer.body).toContain(
      '"urls.primaryName":"Public API"',
    );
  });
});

describe('Server logging redaction', () => {
  const CENSOR = '...shhh...';
  let server;
  let upstream;
  let logEntries;

  const createLoggedServer = (configOverrides) => {
    const config = {
      ...genericConfig,
      logSeverity: 'info',
      mongoConnection,
      ...configOverrides,
    };
    logEntries = [];
    const logSink = pinoTest.sink();
    logSink.on('data', (entry) => logEntries.push(entry));
    const log = loggerProvider({ ...config, destination: logSink });
    return createServer(config, log);
  };

  const findLogEntries = async (msg) => {
    await setImmediate();
    return logEntries.filter((entry) => entry.msg === msg);
  };

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
    if (upstream) {
      await closeHttpServer(upstream.httpServer);
      upstream = null;
    }
  });

  it('logs the server config at startup without secret values', async () => {
    const secretConfig = {
      basicAuthPassword: 'fake-basic-auth-password',
      clientCertificatePassword: 'fake-client-certificate-password',
      holderAppServerAccessTokenSigningKey: 'fake-access-token-signing-key',
      issuingChallengeSecret: 'fake-issuing-challenge-secret',
      mediaPutAccessKey: 'fake-media-put-access-key',
      monitoringApiToken: 'fake-monitoring-api-token',
      mongoSecret: 'fake-mongo-secret',
      secret: 'fake-server-secret',
      twilioAuthToken: 'fake-twilio-auth-token',
      vnfHeaderSignatureSigningKey: 'fake-vnf-header-signing-key',
    };
    const nonSecretConfig = {
      appPort: 3999,
      auth0Connection: 'example-database-connection',
      defaultOAuthTokenExpiration: '10080m',
      hostUrl: 'https://agent.example.com',
      mediaPutAccessKeyId: 'FAKEACCESSKEYID',
      rootKid: 'did:example:root#key-1',
      rootPublicKey: 'fake-root-public-key',
      traceIdHeader: 'x-trace-id',
      vnfHeaderSignatureVerificationKey: 'fake-header-verification-key',
      vnfOAuthTokensEndpoint: 'https://auth.example.com/oauth/token',
    };
    server = createLoggedServer({
      ...secretConfig,
      ...nonSecretConfig,
      cacheUrl: 'redis://default:fake-cache-password@cache.example.com:6379',
      notifications: {
        enabled: true,
        webhook: {
          url: 'https://webhooks.example.com/events',
          secret: 'fake-notification-webhook-secret',
          signatureHeaderName: 'x-signature',
        },
      },
      vendorIntegrations: [
        { name: 'example-vendor', apiKey: 'fake-vendor-api-key' },
      ],
    });

    const [configuredLog, ...otherConfiguredLogs] =
      await findLogEntries('Server Configured');

    expect(otherConfiguredLogs).toHaveLength(0);
    const loggedConfig = JSON.stringify(configuredLog);
    for (const secretValue of [
      ...Object.values(secretConfig),
      'fake-cache-password',
      'fake-notification-webhook-secret',
      'fake-vendor-api-key',
    ]) {
      expect(loggedConfig).not.toContain(secretValue);
    }
    expect(configuredLog).toMatchObject({
      ...nonSecretConfig,
      ...Object.fromEntries(
        Object.keys(secretConfig).map((name) => [name, CENSOR]),
      ),
      cacheUrl: CENSOR,
      notifications: {
        enabled: true,
        webhook: {
          url: 'https://webhooks.example.com/events',
          secret: CENSOR,
          signatureHeaderName: 'x-signature',
        },
      },
      vendorIntegrations: [{ name: 'example-vendor', apiKey: CENSOR }],
    });
    expect(server.config).toMatchObject(secretConfig);
    expect(server.config.notifications.webhook.secret).toEqual(
      'fake-notification-webhook-secret',
    );
  });

  it('logs a server config that contains a circular reference', async () => {
    const customSettings = { name: 'example-settings' };
    customSettings.self = customSettings;
    server = createLoggedServer({ customSettings });

    const [configuredLog] = await findLogEntries('Server Configured');

    expect(configuredLog.customSettings).toEqual({
      name: 'example-settings',
      self: '[Circular]',
    });
    expect(server.config.customSettings).toBe(customSettings);
  });

  it('logs outgoing http-client requests without credential headers', async () => {
    upstream = await startUpstreamServer();
    server = createLoggedServer({});
    const clientOptions = {
      prefixUrl: upstream.origin,
      traceIdHeader: server.config.traceIdHeader,
    };
    server.get('/outgoing', async (req) => {
      const bearerTokenClient = initHttpClient({
        ...clientOptions,
        bearerToken: 'fake-configured-bearer-token',
      })(req);
      const headersClient = initHttpClient(clientOptions)(req);
      await (await bearerTokenClient.get('bearer-token')).json();
      await (
        await headersClient.get('request-headers', {
          headers: {
            authorization: 'Bearer fake-request-bearer-token',
            cookie: 'session=fake-request-session',
          },
        })
      ).json();
      return { ok: true };
    });

    const response = await server.inject({
      method: 'GET',
      url: '/outgoing',
      headers: { 'x-trace-id': 'trace-outgoing' },
    });

    expect(response.statusCode).toEqual(200);
    expect(upstream.receivedHeaders).toEqual([
      expect.objectContaining({
        url: '/bearer-token',
        authorization: 'Bearer fake-configured-bearer-token',
      }),
      expect.objectContaining({
        url: '/request-headers',
        authorization: 'Bearer fake-request-bearer-token',
        cookie: 'session=fake-request-session',
      }),
    ]);

    const requestLogs = await findLogEntries('HttpClient request');
    const responseLogs = await findLogEntries('HttpClient response');
    const logs = JSON.stringify(logEntries);
    for (const secretValue of [
      'fake-configured-bearer-token',
      'fake-request-bearer-token',
      'fake-request-session',
      'fake-upstream-session',
    ]) {
      expect(logs).not.toContain(secretValue);
    }
    expect(requestLogs).toEqual([
      expect.objectContaining({
        origin: upstream.origin,
        path: '/bearer-token',
        reqHeaders: {
          'user-agent': expect.stringMatching(/^@verii\/http-client\//),
          Authorization: CENSOR,
          'x-trace-id': 'trace-outgoing',
        },
      }),
      expect.objectContaining({
        origin: upstream.origin,
        path: '/request-headers',
        reqHeaders: {
          'user-agent': expect.stringMatching(/^@verii\/http-client\//),
          authorization: CENSOR,
          cookie: CENSOR,
          'x-trace-id': 'trace-outgoing',
        },
      }),
    ]);
    expect(responseLogs).toHaveLength(2);
    for (const responseLog of responseLogs) {
      expect(responseLog).toMatchObject({
        statusCode: 200,
        resHeaders: {
          'content-type': 'application/json',
          'set-cookie': CENSOR,
        },
        body: { ok: true },
      });
    }
  });
});

const startUpstreamServer = () =>
  new Promise((resolve, reject) => {
    const receivedHeaders = [];
    const httpServer = http.createServer((req, res) => {
      receivedHeaders.push({ url: req.url, ...req.headers });
      res.writeHead(200, {
        'content-type': 'application/json',
        'set-cookie': 'session=fake-upstream-session; HttpOnly',
      });
      res.end(JSON.stringify({ ok: true }));
    });

    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      const { port } = httpServer.address();
      resolve({
        httpServer,
        origin: `http://127.0.0.1:${port}`,
        receivedHeaders,
      });
    });
  });

const closeHttpServer = (httpServer) =>
  new Promise((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()));
  });
