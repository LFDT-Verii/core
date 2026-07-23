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
const { afterEach, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { loadTestEnv, buildMongoConnection } = require('@verii/tests-helpers');

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
