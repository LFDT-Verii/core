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
const { ObjectId } = require('mongodb');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const createTestFastify = require('../helpers/create-test-fastify');
const { initTenantFactory } = require('../../src/entities/tenants');

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

const requestCases = [
  {
    controller: 'credentials',
    buildRequest: (tenantId) => ({
      method: 'GET',
      url: `/operator/credentials/get?tenantId=${tenantId}`,
    }),
  },
  {
    controller: 'depots',
    buildRequest: (tenantId) => ({
      method: 'POST',
      url: '/operator/depots/delete',
      payload: {
        tenantId,
        serviceId: new ObjectId(),
        depotId: new ObjectId(),
      },
    }),
  },
  {
    controller: 'exchanges',
    buildRequest: (tenantId) => ({
      method: 'GET',
      url: `/operator/exchanges/get?tenantId=${tenantId}&exchangeId=${new ObjectId()}`,
    }),
  },
  {
    controller: 'issue-links',
    buildRequest: (tenantId) => ({
      method: 'POST',
      url: '/operator/issue-links/refresh',
      payload: { tenantId, serviceId: new ObjectId() },
    }),
  },
  {
    controller: 'issuer-services',
    buildRequest: (tenantId) => ({
      method: 'GET',
      url: `/operator/issuer-services/get?tenantId=${tenantId}`,
    }),
  },
  {
    controller: 'presentation-links',
    buildRequest: (tenantId) => ({
      method: 'POST',
      url: '/operator/presentation-links/refresh',
      payload: { tenantId, serviceId: new ObjectId() },
    }),
  },
  {
    controller: 'presentations',
    buildRequest: (tenantId) => ({
      method: 'GET',
      url: `/operator/presentations/get?tenantId=${tenantId}`,
    }),
  },
  {
    controller: 'relying-party-services',
    buildRequest: (tenantId) => ({
      method: 'GET',
      url: `/operator/relying-party-services/get?tenantId=${tenantId}`,
    }),
  },
];

const comparableResponse = (response) => ({
  statusCode: response.statusCode,
  body: omit(['requestId'], response.json),
});

describe('operator controller tenant-loader registration', () => {
  let fastify;
  let persistTenant;
  let foreignTenant;

  before(async () => {
    fastify = createTestFastify(
      { logSeverity: 'fatal' },
      { operatorAuthExtension },
    );
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    foreignTenant = await persistTenant({ caoDid: CAO_B_DID });
  });

  after(async () => {
    await fastify.close();
  });

  requestCases.forEach(({ controller, buildRequest }) => {
    it(`${controller} conceals a tenant owned by another CAO`, async () => {
      const unknownResponse = await fastify.injectJson(
        buildRequest(new ObjectId()),
      );
      const foreignResponse = await fastify.injectJson(
        buildRequest(foreignTenant._id),
      );

      expect(comparableResponse(foreignResponse)).toEqual(
        comparableResponse(unknownResponse),
      );
      expect(foreignResponse.json.errorCode).toEqual('tenant_not_found');
    });
  });
});
