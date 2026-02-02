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

const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const nock = require('nock');
const { cachePlugin } = require('../src/cache-plugin');

const mockDecorate = mock.fn();

const buildFastify = () => {
  const { initHttpClient } = require('@verii/http-client');
  const fastify = require('fastify')()
    .register(cachePlugin)
    .decorate('baseRequest', () =>
      initHttpClient({ cache: fastify.cache, isTest: true }),
    )
    .addHook('preValidation', async (req) => {
      req.fetch = fastify.baseRequest()(req);
    });

  fastify.get('/test-csv', async (req) => {
    const response = await req.fetch.get('https://www.example.com/user', {
      cache: req.cache,
    });
    const result = await response.json();
    return result;
  });

  return fastify;
};

describe('cache-plugin test suite', () => {
  let fastify;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
  });

  beforeEach(() => {
    nock.cleanAll();
  });

  after(async () => {
    await fastify.close();
  });

  it('cache plugin should decorate and add hook', async () => {
    const fakeServer = {
      decorate: mockDecorate,
    };
    cachePlugin(fakeServer, {}, () => {});
    expect(mockDecorate.mock.callCount()).toEqual(1);
    expect(
      mockDecorate.mock.calls.map((call) => call.arguments),
    ).toContainEqual(['cache', expect.any(Object)]);
  });

  it('cache plugin should cached requests', async () => {
    const getUserNock = nock('https://www.example.com')
      .get('/user')
      .times(1)
      .reply(200, { name: 'user' }, { 'Cache-Control': 'max-age=604800' });

    const response1 = await fastify.inject({
      method: 'GET',
      url: '/test-csv',
    });
    const response2 = await fastify.inject({
      method: 'GET',
      url: '/test-csv',
    });

    expect(response1.statusCode).toEqual(200);
    expect(response1.json()).toEqual({ name: 'user' });
    expect(response2.statusCode).toEqual(200);
    expect(response2.json()).toEqual({ name: 'user' });
    expect(getUserNock.isDone()).toBe(true);

    const cachedResponse = fastify.cache.get({
      origin: 'https://www.example.com',
      method: 'GET',
      path: '/user',
    });
    const cachedResponseText = JSON.parse(
      Buffer.from(cachedResponse.body[0]).toString(),
    );

    expect(cachedResponse.body.length).toEqual(1);
    expect(cachedResponseText).toEqual({ name: 'user' });
  });
});
