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
const { before, describe, it } = require('node:test');
const { expect } = require('expect');
const { NotFoundError } = require('http-errors');
const { entries, set } = require('lodash/fp');
const {
  MockAgent,
  interceptors,
  ResponseStatusCodeError,
  cacheStores,
  setGlobalDispatcher,
} = require('undici');
const {
  initHttpClient,
  parseOptions,
  parsePrefixUrl,
  initCache,
} = require('../src/client');

describe('Http Client Package', () => {
  describe('Http client prefixUrl parsing', () => {
    const origin = 'https://www.example.com';

    it('should create a client for simple prefixUrl and no options', () => {
      expect(parsePrefixUrl(origin)).toEqual({ origin, rootPath: '' });
    });
    it('should create a client for prefixUrl with path and no options', () => {
      expect(parsePrefixUrl(`${origin}/some_path/to_nowhere`)).toEqual({
        origin,
        rootPath: '/some_path/to_nowhere',
      });
    });
    it('should create a client for prefixUrl with slash suffixed path and no options', () => {
      expect(parsePrefixUrl(`${origin}/some_path/to_nowhere/`)).toEqual({
        origin,
        rootPath: '/some_path/to_nowhere',
      });
    });
    it('should create a client for prefixUrl with port and no options', () => {
      expect(parsePrefixUrl(`${origin}:8443`)).toEqual({
        origin: `${origin}:8443`,
        rootPath: '',
      });
    });
    it('should create a client for prefixUrl with path and port and no options', () => {
      expect(parsePrefixUrl(`${origin}:8443/some_path/to_nowhere`)).toEqual({
        origin: `${origin}:8443`,
        rootPath: '/some_path/to_nowhere',
      });
    });
    it('should create a memory cache store', () => {
      const cache = initCache();
      expect(cache).toBeInstanceOf(cacheStores.MemoryCacheStore);
    });
  });

  describe('options parsing', () => {
    it('should create a client for timeout', () => {
      expect(
        parseOptions({
          requestTimeout: 3,
        })
      ).toEqual(
        expectedHttpOptions({
          'clientOptions.bodyTimeout': 3,
        })
      );
    });
    it('should create a client with rejectUnauthorized false', () => {
      expect(
        parseOptions({
          requestTimeout: 2,
          tlsRejectUnauthorized: false,
        })
      ).toEqual(
        expectedHttpOptions({
          'clientOptions.bodyTimeout': 2,
          'clientOptions.connect.rejectUnauthorized': false,
        })
      );
    });
  });

  describe('Http client requests', () => {
    const origin = 'https://www.example.com';
    let mockAgent;

    before(() => {
      mockAgent = new MockAgent().compose(interceptors.responseError());
      mockAgent.disableNetConnect();
      setGlobalDispatcher(mockAgent);
    });

    describe('Request client test suite', () => {
      let httpClient;

      before(() => {
        httpClient = initHttpClient({
          rejectUnauthorized: false,
          useExistingGlobalAgent: true,
          prefixUrl: origin,
        })(origin, {
          log: console,
          traceId: 'TRACE-ID',
        });
      });

      it('Should throw NotFoundError if mock not matched', async () => {
        const result = () => httpClient.get('404');

        await expect(result).rejects.toThrow(NotFoundError);
      });

      it('Should throw NotFoundError if mock returns 404', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/not_found', method: 'GET' })
          .reply(404);
        const result = () => httpClient.get('not_found');

        await expect(result).rejects.toThrow(NotFoundError);
      });

      it('Should throw BadRequestError', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/bad_request', method: 'GET' })
          .reply(400);
        const result = () => httpClient.get('bad_request');

        await expect(result).rejects.toThrow(ResponseStatusCodeError);
      });

      it('Should throw BadRequestError for post()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/bad_request', method: 'POST' })
          .reply(400, { error: true });
        const result = () => httpClient.post('bad_request');

        await expect(result).rejects.toThrow(ResponseStatusCodeError);
      });

      it('Should throw InternalServerError for get()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/internal_server_error', method: 'GET' })
          .reply(500);
        const result = () => httpClient.get('internal_server_error');

        await expect(result).rejects.toThrow(ResponseStatusCodeError);
      });

      it('Should throw InternalServerError for post()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/internal_server_error', method: 'POST' })
          .reply(500);
        const result = () => httpClient.post('internal_server_error');

        await expect(result).rejects.toThrow(ResponseStatusCodeError);
      });

      it('Should handle empty body in 204 response for get()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/empty_body_response', method: 'GET' })
          .reply(204);

        const response = await httpClient.get('empty_body_response');

        expect(response).toEqual({
          statusCode: 204,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.text()).resolves.toEqual('');
      });

      it('Should handle empty body in 204 response for post()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/empty_body_response', method: 'POST' })
          .reply(204);

        const response = await httpClient.post('empty_body_response');

        expect(response).toEqual({
          statusCode: 204,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.text()).resolves.toEqual('');
      });

      it('Should parse text for get()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/text', method: 'GET' })
          .reply(200, 'Hello world!');

        const response = await httpClient.get('text');

        expect(response).toEqual({
          statusCode: 200,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.text()).resolves.toEqual('Hello world!');
      });

      it('Should parse text for post()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/text', method: 'POST' })
          .reply(200, 'Hello world!');

        const response = await httpClient.post('text');

        expect(response).toEqual({
          statusCode: 200,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.text()).resolves.toEqual('Hello world!');
      });

      it('should parse json for get()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/json', method: 'GET' })
          .reply(202, { message: 'Not Yet!' });

        const response = await httpClient.get('json');

        expect(response).toEqual({
          statusCode: 202,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.json()).resolves.toEqual({
          message: 'Not Yet!',
        });
      });

      it('should parse json for post()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/json', method: 'POST' })
          .reply(202, { message: 'Not Yet!' });

        const response = await httpClient.post('json');

        expect(response).toEqual({
          statusCode: 202,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.json()).resolves.toEqual({
          message: 'Not Yet!',
        });
      });

      it('should handle get() with no prefixUrl params', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/json', method: 'GET' })
          .reply(200, { message: 'matched' });

        const httpClient2 = initHttpClient({
          rejectUnauthorized: false,
          useExistingGlobalAgent: true,
        })({
          log: console,
          traceId: 'TRACE-ID',
        });

        const response = await httpClient2.get(`${origin}/json`);

        expect(response).toEqual({
          statusCode: 200,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.json()).resolves.toEqual({
          message: 'matched',
        });
      });

      it('should handle post() with no prefixUrl params', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/json', method: 'POST' })
          .reply(200, { message: 'matched' });

        const httpClient2 = initHttpClient({
          rejectUnauthorized: false,
          useExistingGlobalAgent: true,
        })({
          log: console,
          traceId: 'TRACE-ID',
        });

        const response = await httpClient2.post(`${origin}/json`);

        expect(response).toEqual({
          statusCode: 200,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.json()).resolves.toEqual({
          message: 'matched',
        });
      });

      it('should handle get() with options.searchParams', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/json?foo=bar', method: 'GET' })
          .reply(200, { message: 'matched' });

        const searchParams = new URLSearchParams();

        searchParams.append('foo', 'bar');

        const response = await httpClient.get('json', { searchParams });

        expect(response).toEqual({
          statusCode: 200,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.json()).resolves.toEqual({
          message: 'matched',
        });
      });

      it('should handle post() with JSON body', async () => {
        mockAgent
          .get(origin)
          .intercept({
            path: '/json',
            method: 'POST',
            body: JSON.stringify({ foo: 'bar' }),
          })
          .reply(202, { message: 'matched' });

        const response = await httpClient.post('json', { foo: 'bar' });

        expect(response).toEqual({
          statusCode: 202,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.json()).resolves.toEqual({
          message: 'matched',
        });
      });

      it('Should throw NotFoundError if mock returns 404 for delete()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/not_found', method: 'DELETE' })
          .reply(404);

        const result = () => httpClient.delete('not_found');

        await expect(result).rejects.toThrow(NotFoundError);
      });

      it('Should throw BadRequestError for delete()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/bad_request', method: 'DELETE' })
          .reply(400, { error: true });

        const result = () => httpClient.delete('bad_request');

        await expect(result).rejects.toThrow(ResponseStatusCodeError);
      });

      it('Should throw InternalServerError for delete()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/internal_server_error', method: 'DELETE' })
          .reply(500);

        const result = () => httpClient.delete('internal_server_error');

        await expect(result).rejects.toThrow(ResponseStatusCodeError);
      });

      it('Should handle empty body in 204 response for delete()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/empty_body_response', method: 'DELETE' })
          .reply(204);

        const response = await httpClient.delete('empty_body_response');

        expect(response).toEqual({
          statusCode: 204,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.text()).resolves.toEqual('');
      });

      it('Should parse text for delete()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/text', method: 'DELETE' })
          .reply(200, 'Hello world!');

        const response = await httpClient.delete('text');

        expect(response).toEqual({
          statusCode: 200,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.text()).resolves.toEqual('Hello world!');
      });

      it('should parse json for delete()', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/json', method: 'DELETE' })
          .reply(202, { message: 'Deleted!' });

        const response = await httpClient.delete('json');

        expect(response).toEqual({
          statusCode: 202,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.json()).resolves.toEqual({
          message: 'Deleted!',
        });
      });

      it('should handle delete() with no prefixUrl params', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/json', method: 'DELETE' })
          .reply(200, { message: 'matched' });

        const httpClient2 = initHttpClient({
          rejectUnauthorized: false,
          useExistingGlobalAgent: true,
        })({
          log: console,
          traceId: 'TRACE-ID',
        });

        const response = await httpClient2.delete(`${origin}/json`);

        expect(response).toEqual({
          statusCode: 200,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.json()).resolves.toEqual({
          message: 'matched',
        });
      });

      it('should handle delete() with options.searchParams', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/json?id=123', method: 'DELETE' })
          .reply(200, { message: 'deleted' });

        const searchParams = new URLSearchParams();

        searchParams.append('id', '123');

        const response = await httpClient.delete('json', { searchParams });

        expect(response).toEqual({
          statusCode: 200,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });

        await expect(response.json()).resolves.toEqual({
          message: 'deleted',
        });
      });

      it('should use `bearerToken` when passed', async () => {
        mockAgent
          .get(origin)
          .intercept({
            path: '/bearer',
            method: 'GET',
            headers: { Authorization: 'Bearer TOKEN' },
          })
          .reply(200);

        const httpClient2 = initHttpClient({
          rejectUnauthorized: false,
          useExistingGlobalAgent: true,
          bearerToken: 'TOKEN',
        })({
          log: console,
          traceId: 'TRACE-ID',
        });

        const response = await httpClient2.get(`${origin}/bearer`);

        expect(response).toEqual({
          statusCode: 200,
          resHeaders: {},
          json: expect.any(Function),
          text: expect.any(Function),
          rawBody: expect.any(Object),
        });
      });

      it("should have a 'promise' responseType ", async () => {
        const client = initHttpClient({
          prefixUrl: `${origin}/json`,
          rejectUnauthorized: false,
        })({
          log: console,
          traceId: 'TRACE-ID',
        });

        expect(client.responseType).toEqual('promise');
      });
    });
  });
});

const expectedHttpOptions = (overrides) => {
  let expectation = {
    clientOptions: {
      connect: { rejectUnauthorized: undefined },
    },
    customHeaders: {},
    traceIdHeader: 'TRACE_ID',
  };
  for (const [key, value] of entries(overrides)) {
    expectation = set(key, value, expectation);
  }
  return expectation;
};
