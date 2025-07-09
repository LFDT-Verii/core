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

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');
const buildFastify = require('./helpers/build-fastify');

const baseUrl = '/d';

describe(':d/website did-doc publishing test suite', () => {
  let fastify;
  let persistOrganization;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();

    ({ persistOrganization } = initOrganizationFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('organizations').deleteMany({});
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('Should return 404 when DID document not found', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: `${baseUrl}/www.example.com/did.json`,
    });

    expect(response.statusCode).toEqual(404);
  });

  it('Should 200 with existing did-doc', async () => {
    const org = await persistOrganization({
      did: 'did:web:members.localhost.test:d:www.example.com',
    });

    const response = await fastify.injectJson({
      method: 'GET',
      url: `${baseUrl}/www.example.com/did.json`,
    });

    expect(response.statusCode).toEqual(200);

    expect(response.json).toEqual(org.didDoc);
  });

  it('Should 200 with existing did-doc with did:web with a port', async () => {
    const org = await persistOrganization({
      did: 'did:web:members.localhost.test:d:www.example.com%3A1234',
    });

    const response = await fastify.injectJson({
      method: 'GET',
      url: `${baseUrl}/www.example.com:1234/did.json`,
    });

    expect(response.statusCode).toEqual(200);

    expect(response.json).toEqual(org.didDoc);
  });
});
