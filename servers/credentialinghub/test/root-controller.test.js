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

const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const packageJson = require('../package.json');
const createTestFastify = require('./helpers/create-test-fastify');

describe('root controller test', () => {
  let fastify;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  it('should ping', async () => {
    const response = await fastify.injectJson({ method: 'GET', url: '/' });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual(`Welcome to the Credentialing Hub
Host: https://localhost.test
Version: ${packageJson.version}
`);
  });

  it('should load openid4vp routes at root paths', async () => {
    expect(
      fastify.hasRoute({
        method: 'POST',
        url: '/r/:tenantId/openid4vp/authorization-request/:requestId',
      }),
    ).toEqual(true);
    expect(
      fastify.hasRoute({
        method: 'POST',
        url: '/r/:tenantId/openid4vp/direct-post',
      }),
    ).toEqual(true);
    expect(
      fastify.hasRoute({
        method: 'POST',
        url: '/openid4vp/r/:tenantId/openid4vp/direct-post',
      }),
    ).toEqual(false);
  });
});
