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
const Fastify = require('fastify');
const { initCallWithKmsKey } = require('@verii/crypto');
const { initDbKms, dbKmsPlugin } = require('..');

// Mock dependencies
jest.mock('../src/db-kms', () => ({
  initDbKms: jest.fn().mockReturnValue(jest.fn().mockReturnValue({})),
}));

jest.mock('@verii/crypto', () => ({
  initCallWithKmsKey: jest.fn(),
}));

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
    jest.clearAllMocks();
  });

  it('should register Fastify plugin correctly', async () => {
    expect(fastify.hasRequestDecorator('kms')).toBe(true);
  });

  it('should assign kms and withKmsKey to the request', async () => {
    const mockKmsInstance = { encrypt: jest.fn(), decrypt: jest.fn() };
    const mockWithKmsKey = jest.fn();

    initDbKms.mockReturnValue(() => mockKmsInstance);
    initCallWithKmsKey.mockReturnValue(mockWithKmsKey);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
    });

    // expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      kms: true,
      withKmsKey: true,
    });

    expect(initDbKms).toHaveBeenCalledWith(fastify, {});
    expect(initCallWithKmsKey).toHaveBeenCalledWith(expect.any(Object));
  });
});
