/*
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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const fp = require('fastify-plugin');
const { omit } = require('lodash/fp');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const createTestFastify = require('../helpers/create-test-fastify');
const {
  initTenantFactory,
  tenantLoaderPlugin,
} = require('../../src/entities/tenants');

const CAO_A_DID = 'did:example:cao-a';
const CAO_B_DID = 'did:example:cao-b';

const operatorAuthExtension = {
  plugin: fp(async (fastify) => {
    fastify.decorate('authenticateOperator', async (request) => {
      request.operatorPrincipal = {
        caoDid: CAO_A_DID,
        subject: 'test-operator',
        subjectType: 'client',
        authenticationMethod: 'test',
      };
    });
  }),
  documentation: {},
};

const createTenantLoaderServer = async () => {
  const fastify = createTestFastify(
    { logSeverity: 'fatal' },
    { operatorAuthExtension },
  );
  fastify.register(async (server) => {
    server.addHook('onRequest', server.authenticateOperator);
    await server.register(tenantLoaderPlugin);
    server.get('/test/operator-tenants/:tenantId', async (request) => ({
      tenantId: request.tenant._id,
    }));
  });
  await fastify.ready();
  return fastify;
};

const comparableResponse = (response) => ({
  statusCode: response.statusCode,
  body: omit(['requestId'], response.json),
});

describe('tenant loader CAO isolation', () => {
  let fastify;
  let persistTenant;
  let ownTenant;
  let foreignTenant;

  before(async () => {
    fastify = await createTenantLoaderServer();
    ({ persistTenant } = initTenantFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    [ownTenant, foreignTenant] = await Promise.all([
      persistTenant({ caoDid: CAO_A_DID }),
      persistTenant({ caoDid: CAO_B_DID }),
    ]);
  });

  after(async () => {
    await fastify.close();
  });

  it("loads the authenticated CAO's tenant", async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: `/test/operator-tenants/${ownTenant._id}`,
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({ tenantId: ownTenant._id });
  });

  it('conceals a tenant owned by another CAO as an unknown tenant', async () => {
    const unknownResponse = await fastify.injectJson({
      method: 'GET',
      url: '/test/operator-tenants/000000000000000000000000',
    });
    const foreignResponse = await fastify.injectJson({
      method: 'GET',
      url: `/test/operator-tenants/${foreignTenant._id}`,
    });

    expect(comparableResponse(foreignResponse)).toEqual(
      comparableResponse(unknownResponse),
    );
  });
});
