/*
 * Copyright 2025 Velocity Team
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
const {
  afterEach,
  beforeEach,
  describe,
  it,
  mock,
  after,
} = require('node:test');
const { expect } = require('expect');

const mockKmsInstance = () => ({ encrypt: mock.fn(), decrypt: mock.fn() });
const mockWithKmsKey = mock.fn();

const initDbKms = mock.fn(() => {
  return mockKmsInstance;
});
mock.module('../src/db-kms.js', {
  namedExports: {
    initDbKms,
  },
});

const initCallWithKmsKey = mock.fn(() => mockWithKmsKey);
mock.module('@verii/crypto', {
  namedExports: {
    initCallWithKmsKey,
  },
});

const Fastify = require('fastify');
const { dbKmsPlugin } = require('..');

describe('dbKmsPlugin Fastify Plugin', () => {
  let fastify;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(dbKmsPlugin);

    fastify.get('/test', async (req) => {
      return {
        kms: req.kms != null,
        withKmsKey: req.withKmsKey != null,
      };
    });
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  after(() => {
    mock.reset();
  });

  it('should register Fastify plugin correctly', async () => {
    expect(fastify.hasRequestDecorator('kms')).toBe(true);
  });

  it('should assign kms and withKmsKey to the request', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
    });

    // expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      kms: true,
      withKmsKey: true,
    });

    expect(initDbKms.mock.calls.map((call) => call.arguments)).toContainEqual([
      fastify,
      {},
    ]);
    expect(
      initCallWithKmsKey.mock.calls.map((call) => call.arguments)
    ).toContainEqual([expect.any(Object)]);
  });
});
