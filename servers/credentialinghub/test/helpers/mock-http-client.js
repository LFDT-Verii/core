/**
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
 */
const { mock } = require('node:test');
const { NotFoundError } = require('http-errors');

const mockRoutes = { get: {}, post: {} };
const buildDefaultImplementation =
  (method) =>
  (...args) => {
    if (!Object.hasOwn(mockRoutes[method], args[0])) {
      return Promise.resolve({
        json: () =>
          Promise.reject(new Error(`no ${method} route for ${args[0]}`)),
      });
    }

    return Promise.resolve({
      json: () => Promise.resolve(mockRoutes[method][args[0]]),
    });
  };

const mockHttpClient = {
  get: mock.fn(buildDefaultImplementation('get')),
  post: mock.fn(buildDefaultImplementation('post')),
  responseType: 'promise',
};
const mockCache = mock.fn();

const mockHttpClientModule = {
  initHttpClient: mock.fn(() => () => mockHttpClient),
  initCache: mock.fn(() => mockCache),
};

const mockHttpClientJsonRoute = (method, url, response) => {
  mockRoutes[method][url] = response;
};

let counter;
let jsonResponses;

const mockHttpClientJsonResponse = (method, body) => {
  jsonResponses[method].push(body);
  mockHttpClient.get.mock.mockImplementation(() => ({
    json: mock.fn(() => {
      if (jsonResponses.get.length > counter.get) {
        const response = jsonResponses.get[counter.get];
        counter.get += 1;
        return Promise.resolve(response);
      }
      throw new NotFoundError();
    }),
  }));
};

const mockHttpClientTextResponse = (method, body) => {
  mockHttpClient[method].mock.mockImplementationOnce(() => ({
    text: mock.fn(() => Promise.resolve(body)),
  }));
};

const mockHttpClientError = (method, error) => {
  mockHttpClient[method].mock.mockImplementationOnce(() => ({
    json: mock.fn(() => Promise.reject(error)),
    text: mock.fn(() => Promise.reject(error)),
  }));
};

const restMockHttpClient = () => {
  mockRoutes.get = {};
  mockRoutes.post = {};
};
const resetMockHttpClient = () => {
  counter = { get: 0, post: 0 };
  jsonResponses = { get: [], post: [] };
  mockHttpClient.get.mock.resetCalls();
  mockHttpClient.get.mock.mockImplementation(buildDefaultImplementation('get'));
  mockHttpClient.post.mock.resetCalls();
  mockHttpClient.post.mock.mockImplementation(
    buildDefaultImplementation('post'),
  );
};
resetMockHttpClient();

module.exports = {
  mockHttpClient,
  mockHttpClientModule,
  mockHttpClientJsonResponse,
  mockHttpClientTextResponse,
  mockHttpClientError,
  mockHttpClientJsonRoute,
  resetMockHttpClient,
  restMockHttpClient,
};
