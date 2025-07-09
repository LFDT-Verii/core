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

const { loadTestEnv, buildMongoConnection } = require('@verii/tests-helpers');

loadTestEnv();
const { genericConfig } = require('@verii/config');
const { createServer, listenServer } = require('../src/create-server');

const mongoConnection = buildMongoConnection('credentialagent');

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
    listenServer(server);
    await server.ready();
    const response = await server.inject({ method: 'get', url: '/' });
    expect(response.body).toEqual('null');
  });

  it('server with <Array> response payload should respond with <Array> response body', async () => {
    server.get('/', async (req, reply) => {
      return reply.status(200).send([]);
    });
    listenServer(server);
    await server.ready();
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
    listenServer(server);
    await server.ready();
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

    listenServer(server);
    await server.ready();
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
