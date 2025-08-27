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
const { describe, it, mock } = require('node:test');
const { expect } = require('expect');

const fastify = require('fastify');
const { corsPlugin } = require('../src/cors-plugin');

const buildFastify = (opts) => fastify(opts);

describe('CORS plugin Test Suite', () => {
  it('cors plugin should decorate fastify', async () => {
    const fakeServer = {
      config: {
        allowedCorsOrigins: '',
        tokenWalletBaseUrl: 'one',
        registrarAppUiUrl: 'two',
      },
      register: mock.fn(),
    };
    await corsPlugin(fakeServer, {}, () => {});
    expect(
      fakeServer.register.mock.calls.map((call) => call.arguments)
    ).toEqual([[expect.any(Function), expect.any(Function)]]);
    const mockRequest = {
      routeOptions: {},
    };
    const mockCorsCallback = mock.fn();
    fakeServer.register.mock.calls[0].arguments[1]()(
      mockRequest,
      mockCorsCallback
    );
    expect(
      mockCorsCallback.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      null,
      {
        origin: ['one', 'two'],
        allowedHeaders: [
          'Authorization',
          'Accept',
          'Origin',
          'Keep-Alive',
          'User-Agent',
          'Cache-Control',
          'Content-Type',
          'Content-Range',
          'Range',
          'x-auto-activate',
          'x-vnf-protocol-version',
        ],
        methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
      },
    ]);
  });
  it('cors plugin origins response should be per route', async () => {
    const testServer = buildFastify({});
    testServer.decorate('config', {
      allowedCorsOrigins: '',
      tokenWalletBaseUrl: 'one',
      registrarAppUiUrl: 'two',
    });
    testServer.register(corsPlugin, { wildcardRoutes: ['/foo/:id'] });

    testServer.get('/', (req) => ({ origin: req.originalUrl }));
    testServer.get('/foo/:id', (req) => ({ origin: req.originalUrl }));

    const response = await testServer.inject({
      method: 'GET',
      url: '/',
    });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();

    const response2 = await testServer.inject({
      method: 'GET',
      url: '/foo/bar',
    });
    expect(response2.headers['access-control-allow-origin']).toEqual('*');
  });
});
