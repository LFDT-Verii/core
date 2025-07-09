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
const { NotFoundError } = require('http-errors');
const { entries, set } = require('lodash/fp');
const { MockAgent, interceptors, ResponseStatusCodeError } = require('undici');
const {
  initHttpClient,
  parseOptions,
  parsePrefixUrl,
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

  describe('Http client get', () => {
    const origin = 'https://www.example.com';
    let mockAgent;

    beforeAll(() => {
      mockAgent = new MockAgent().compose(interceptors.responseError());
      mockAgent.disableNetConnect();
    });

    describe('Request client test suite', () => {
      let httpClient;

      beforeAll(() => {
        httpClient = initHttpClient({
          rejectUnauthorized: false,
          agent: mockAgent,
          prefixUrls: [origin],
        })(origin, {
          log: console,
          traceId: 'TRACE-ID',
        });
      });
      it('Should throw NotFoundError', async () => {
        const result = () => httpClient.get('404');
        await expect(result).rejects.toThrow(NotFoundError);
      });

      it('Should throw BadRequestError', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/bad_request', method: 'GET' })
          .reply(400, { error: true });
        const result = () => httpClient.get('bad_request');

        await expect(result).rejects.toThrow(ResponseStatusCodeError);
      });

      it('Should throw InternalServerError', async () => {
        mockAgent
          .get(origin)
          .intercept({ path: '/internal_server_error', method: 'GET' })
          .reply(500);
        const result = () => httpClient.get('internal_server_error');

        await expect(result).rejects.toThrow(ResponseStatusCodeError);
      });

      it('Should handle empty body in 204 response', async () => {
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
        });
        await expect(response.text()).resolves.toEqual('');
      });

      it('Should parse text', async () => {
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
        });
        await expect(response.text()).resolves.toEqual('Hello world!');
      });

      it('should parse json', async () => {
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
          agent: mockAgent,
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
        });
        await expect(response.json()).resolves.toEqual({
          message: 'matched',
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
