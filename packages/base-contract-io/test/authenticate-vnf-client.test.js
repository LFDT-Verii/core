/*
 * Copyright 2024 Velocity Team
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
 *
 */
const { mock, beforeEach, describe, it, after } = require('node:test');
const { expect } = require('expect');

const initHttpClient = mock.fn();
mock.module('@verii/http-client', { namedExports: { initHttpClient } });

const {
  initAuthenticateVnfClient,
  initAuthenticateVnfBlockchainClient,
  initAuthenticateVnfClientPlugin,
} = require('../src/authenticate-vnf-client');

describe('VNF Identity Provider Authentication', () => {
  const addHook2 = mock.fn(() => {});
  const decorateRequest2 = mock.fn(() => ({ addHook: addHook2 }));
  const addHook = mock.fn(() => ({ decorateRequest: decorateRequest2 }));
  const decorateRequest = mock.fn(() => ({ addHook }));
  const decorate = mock.fn(() => ({ decorateRequest }));
  const createFastify = () => ({
    config: {},
    vnfAuthTokensCache: new Map(),
    decorate,
  });
  const tokenResult = {
    access_token: 'TOKEN',
    expires_in: 60,
  };
  const undiciMockPost = mock.fn((result) => ({
    json: () => Promise.resolve(result),
  }));
  const undiciMock = (result) => () => ({
    post: () => undiciMockPost(result),
  });
  let fastify;
  let vnfAuthenticate;

  beforeEach(() => {
    initHttpClient.mock.resetCalls();
    undiciMockPost.mock.resetCalls();
    fastify = createFastify();
    vnfAuthenticate = initAuthenticateVnfClient(fastify);
  });

  after(() => {
    mock.reset();
  });

  describe('VNF Authenticate', () => {
    it('Base VNF authenticate call', async () => {
      initHttpClient.mock.mockImplementationOnce(() => undiciMock(tokenResult));

      const result = await vnfAuthenticate('API-IDENTIFIER');

      expect(result).toEqual(tokenResult.access_token);
    });

    it('Get cached token', async () => {
      initHttpClient.mock.mockImplementationOnce(() => undiciMock(tokenResult));

      await vnfAuthenticate('API-IDENTIFIER');

      const otherTokenResult = {
        ...tokenResult,
        access_token: 'OTHER_TOKEN',
      };

      initHttpClient.mock.mockImplementationOnce(() =>
        undiciMock(otherTokenResult),
      );

      const result = await vnfAuthenticate('API-IDENTIFIER');

      expect(result).toEqual(tokenResult.access_token);
    });

    it('Get new token when cached expired', async () => {
      initHttpClient.mock.mockImplementationOnce(() =>
        undiciMock({
          ...tokenResult,
          expires_in: 0,
        }),
      );

      await vnfAuthenticate('API-IDENTIFIER');

      const otherTokenResult = {
        ...tokenResult,
        access_token: 'OTHER_TOKEN',
      };

      initHttpClient.mock.mockImplementationOnce(() =>
        undiciMock(otherTokenResult),
      );

      const result = await vnfAuthenticate('API-IDENTIFIER');

      expect(result).toEqual(otherTokenResult.access_token);
    });
  });

  describe('VNF Blockchain Authenticate', () => {
    it('Blockchain VNF authenticate call should make network request and then use cache', async () => {
      initHttpClient.mock.mockImplementation(() => undiciMock(tokenResult));
      const authenticate = initAuthenticateVnfBlockchainClient(fastify, {});
      const result1 = await authenticate();
      expect(result1).toEqual(tokenResult.access_token);
      expect(undiciMockPost.mock.callCount()).toEqual(1);
      const result2 = await authenticate();
      expect(result2).toEqual(tokenResult.access_token);
      expect(undiciMockPost.mock.callCount()).toEqual(1);
    });
  });

  describe('VNF Authentication Plugin', () => {
    it('Register VNF authentication functions', async () => {
      initAuthenticateVnfClientPlugin(fastify, {}, () => {});

      const req = {};
      await addHook.mock.calls[0].arguments[1](req);
      expect(req).toEqual({
        vnfBlockchainAuthenticate: expect.any(Function),
      });

      expect(
        decorateRequest.mock.calls.map((call) => call.arguments),
      ).toContainEqual(['vnfBlockchainAuthenticate', null]);
      expect(addHook.mock.calls.map((call) => call.arguments)).toContainEqual([
        'preValidation',
        expect.anything(),
      ]);
    });
  });
});
