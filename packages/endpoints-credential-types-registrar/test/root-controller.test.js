/**
 * Copyright 2026 Velocity Team
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

const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const nock = require('./helpers/nock');
const buildFastify = require('./helpers/build-fastify');

describe('root controller test', () => {
  let fastify;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  it('should give the version and the environment label', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual(`Welcome to VelocityCore Registrar
Version: ${fastify.config.version}
Environment: test
`);
  });
});
