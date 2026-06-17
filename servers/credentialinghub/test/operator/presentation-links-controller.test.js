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
 *
 */
const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');
const { initDepotFactory } = require('../../src/entities/depots');
const { initKeyFactory } = require('../../src/entities/keys');
const {
  initRelyingPartyServiceFactory,
} = require('../../src/entities/relying-party-services');
const { initTenantFactory } = require('../../src/entities/tenants');

const testUrl = '/operator/presentation-links/refresh';

describe('Presentation Links Test suite', () => {
  let fastify;
  let persistTenant;
  let persistKey;
  let persistRelyingPartyService;
  let persistDepot;
  let tenant;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistRelyingPartyService } = initRelyingPartyServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('relyingPartyServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    ({ tenant } = await constructTenant(
      () =>
        persistTenant({
          did: 'did:web:localhost%3A3000',
        }),
      persistKey,
    ));
  });

  after(async () => {
    await fastify.close();
  });

  describe('bad request errors', () => {
    let service;

    beforeEach(async () => {
      service = await persistRelyingPartyService({ tenant });
    });

    it('should 400, if missing tenantId property', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: { serviceId: service._id },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body must have required property 'tenantId'",
        }),
      );
    });

    it('should 400, if tenantId cannot be found', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: new ObjectId().toString(),
          serviceId: service._id,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'tenant_not_found',
          message: 'Tenant not found',
        }),
      );
    });

    it('should 400, if missing serviceId property', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: { tenantId: tenant._id },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body must have required property 'serviceId'",
        }),
      );
    });

    it('should 400, if service cannot be found', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: tenant._id,
          serviceId: new ObjectId().toString(),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'referenced_service_not_found',
          message: 'referenced_service_not_found',
        }),
      );
    });

    it('should 400, if service is deactivated', async () => {
      const deactivatedService = await persistRelyingPartyService({
        tenant,
        deactivationDate: new Date(),
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: tenant._id,
          serviceId: deactivatedService._id,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'referenced_service_not_found',
          message: 'referenced_service_not_found',
        }),
      );
    });

    it('should 400, if depot cannot be found', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          depotId: new ObjectId().toString(),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'referenced_depot_not_found',
          message: 'referenced_depot_not_found',
        }),
      );
    });

    it('should 400, if depot belongs to another service', async () => {
      const anotherService = await persistRelyingPartyService({ tenant });
      const depot = await persistDepot({
        tenant,
        service: anotherService,
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          depotId: depot._id,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'referenced_depot_not_found',
          message: 'referenced_depot_not_found',
        }),
      );
    });
  });

  describe('successful use cases', () => {
    it('should 200 for a service-scoped presentation link', async () => {
      const service = await persistRelyingPartyService({ tenant });

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        redirectUrl: expectedRedirectUrl(response.json),
        vnProtocolLink: expect.any(String),
        openid4vpProtocolLink: expect.any(String),
        requestId: expect.any(String),
      });
      expectVnProtocolLink(response.json.vnProtocolLink, tenant, service);
      expectOpenid4vpProtocolLink(
        response.json.openid4vpProtocolLink,
        tenant,
        `s-${service._id}`,
      );
    });

    it('should 200 for a depot-scoped presentation link', async () => {
      const service = await persistRelyingPartyService({ tenant });
      const depot = await persistDepot({
        tenant,
        service,
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          depotId: depot._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        redirectUrl: expectedRedirectUrl(response.json),
        vnProtocolLink: expect.any(String),
        openid4vpProtocolLink: expect.any(String),
        requestId: expect.any(String),
      });
      expectVnProtocolLink(
        response.json.vnProtocolLink,
        tenant,
        service,
        depot,
      );
      expectOpenid4vpProtocolLink(
        response.json.openid4vpProtocolLink,
        tenant,
        `d-${depot._id}`,
      );
    });
  });
});

const expectedRedirectUrl = ({ vnProtocolLink, openid4vpProtocolLink }) =>
  `https://localhost.test/app-redirect?deeplink=${encodeURIComponent(
    vnProtocolLink,
  )}&openid4vc_uri=${encodeURIComponent(openid4vpProtocolLink)}`;

const expectVnProtocolLink = (uri, tenant, service, depot) => {
  const url = new URL(uri);
  expect(url.protocol).toEqual('velocity-network-devnet:');
  expect(url.host).toEqual('inspect');
  expect(url.searchParams.get('request_uri')).toEqual(
    `https://localhost.test/vn-api/r/${encodeURI(
      tenant.did,
    )}/get-presentation-request?id=${service._id}`,
  );
  expect(url.searchParams.get('inspectorDid')).toEqual(tenant.did);
  expect(url.searchParams.get('issuerDid')).toBeNull();
  expect(url.searchParams.get('vendorOriginContext')).toEqual(
    depot == null ? null : `depot:${depot._id}`,
  );
};

const expectOpenid4vpProtocolLink = (uri, tenant, requestId) => {
  const url = new URL(uri);
  expect(url.protocol).toEqual('openid4vp:');
  expect(url.host).toEqual('authorize');
  expect(url.searchParams.get('client_id')).toEqual(
    `decentralized_identifier:${tenant.did}`,
  );
  expect(url.searchParams.get('request_uri_method')).toEqual('post');
  const requestUri = new URL(url.searchParams.get('request_uri'));
  expect(requestUri.origin).toEqual('https://localhost.test');
  expect(requestUri.pathname).toEqual(
    `/r/${tenant._id}/openid4vp/authorization-request/${requestId}`,
  );
  expect([...requestUri.searchParams.entries()]).toEqual([]);
};
