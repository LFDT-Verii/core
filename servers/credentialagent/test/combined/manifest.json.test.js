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

const buildFastify = require('./helpers/credentialagent-build-fastify');

describe('Android manifest.json and related files test suite', () => {
  let fastify;
  beforeAll(async () => {
    fastify = buildFastify();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should load the manifest.json', async () => {
    const result = await fastify.injectJson({
      method: 'GET',
      url: 'public/manifest.json',
    });
    expect(result.statusCode).toEqual(200);
    expect(result.json).not.toBe(null);
  });

  it('should load the favicon', async () => {
    const result = await fastify.injectJson({
      method: 'GET',
      url: 'public/favicon.ico',
    });
    expect(result.statusCode).toEqual(200);
    expect(result.json).not.toBe(null);
  });

  it('should load a logo', async () => {
    const result = await fastify.injectJson({
      method: 'GET',
      url: 'public/logo192.png',
    });
    expect(result.statusCode).toEqual(200);
    expect(result.json).not.toBe(null);
  });
});
