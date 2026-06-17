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
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const {
  mockHttpClientJsonResponse,
  mockHttpClientModule,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { map } = require('lodash/fp');
const { nanoid } = require('nanoid');
const { ObjectId } = require('mongodb');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const createTestFastify = require('../helpers/create-test-fastify');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initDepotFactory } = require('../../src/entities/depots');
const { initCredentialFactory } = require('../../src/entities/credentials');
const { initKeyFactory } = require('../../src/entities/keys');
const { constructTenant } = require('../helpers/construct-tenant');

const testUrl = '/operator/issue-links/refresh';
describe('Issue Links Test suite', () => {
  let fastify;
  let persistTenant;
  let persistIssuerService;
  let persistDepot;
  let persistCredential;
  let persistKey;

  let tenant;
  let vpIssuerService;
  let vpDepot;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistCredential } = initCredentialFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
    ({ tenant } = await constructTenant(
      () =>
        persistTenant({
          did: 'did:web:localhost%3A3000',
        }),
      persistKey,
    ));
    resetMockHttpClient();
  });

  after(async () => {
    await fastify.close();
  });

  describe('bad request errors', () => {
    let service;
    beforeEach(async () => {
      service = await persistIssuerService({
        tenant,
        authMethods: ['preauth'],
      });
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
        payload: {
          tenantId: tenant._id,
        },
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
          errorCode: 'referenced_service_not_found',
          message: 'referenced_service_not_found',
          statusCode: 400,
        }),
      );
    });
  });

  describe('preauth services', () => {
    let preauthIssuerService;
    let preauthDepot;

    beforeEach(async () => {
      preauthIssuerService = await persistIssuerService({
        tenant,
        authMethods: ['preauth'],
      });
      preauthDepot = await persistDepot({
        tenant,
        service: preauthIssuerService,
        userReference: nanoid(),
      });
    });
    it('should 400, for preauth service if missing depotId property', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: tenant._id,
          serviceId: preauthIssuerService._id,
        },
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'issue_link_requires_depotId',
          message: 'issue_link_requires_depotId',
          statusCode: 400,
        }),
      );
    });

    it('should 400, if depot cannot be found', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: tenant._id,
          serviceId: preauthIssuerService._id,
          depotId: new ObjectId().toString(),
        },
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'referenced_depot_not_found',
          message: 'referenced_depot_not_found',
          statusCode: 400,
        }),
      );
    });
    it('should 200 for preauth service', async () => {
      const credentialTypeMetadatas = [
        {
          credentialType: 'Employment',
          schemaUrl: 'https://example.com/employment.schema.json',
          issuerCategory: 'RegularIssuer',
        },
        {
          credentialType: 'barType',
          schemaUrl: 'https://example.com/bar.schema.json',
          issuerCategory: 'NoIssuer',
        },
        {
          credentialType: 'Education',
          schemaUrl: 'https://example.com/education.schema.json',
          issuerCategory: 'RegularIssuer',
        },
      ];
      const profile = {
        credentialSubject: {
          permittedVelocityServiceCategory: ['Inspector', 'Issuer', 'Foo'],
        },
      };
      mockHttpClientJsonResponse('get', credentialTypeMetadatas);
      mockHttpClientJsonResponse('get', profile);
      await persistCredential({
        tenant,
        depot: preauthDepot,
      });
      await persistCredential({
        tenant,
        depot: preauthDepot,
        content: {
          type: 'Education',
          credentialSubject: {
            institution: {
              identifier: 'did:example.edu',
              name: 'Example College',
            },
            degreeName: 'Bachelor of Arts',
          },
        },
      });
      await persistCredential({
        tenant,
        depot: preauthDepot,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: tenant._id,
          serviceId: preauthIssuerService._id,
          depotId: preauthDepot._id,
        },
      });
      expect(response.statusCode).toEqual(200);
      const refreshedDepot = await mongoDb()
        .collection('depots')
        .findOne({ _id: new ObjectId(preauthDepot._id) });
      expect(response.json).toEqual({
        openidCredentialOffer: expect.any(String),
        vnProtocolLink: `velocity-network-devnet://issue?${expectedSearchParams(
          tenant,
          preauthIssuerService,
          refreshedDepot,
          response.json.preauthCode,
          ['Employment', 'Education'],
        )}`,
        redirectUrl: `https://localhost.test/app-redirect?deeplink=${encodeURIComponent(
          response.json.vnProtocolLink,
        )}&openid4vc_uri=${encodeURIComponent(
          response.json.openidCredentialOffer,
        )}`,
        preauthCode: expect.any(String),
        requestId: expect.any(String),
      });
      expectedOidcCredentialOfferUri(
        response.json.openidCredentialOffer,
        tenant,
        ['Employment', 'Education'],
      );
    });

    it('should 200 but without an openid4vc credential offer link', async () => {
      const profile = {
        credentialSubject: {
          permittedVelocityServiceCategory: ['Inspector', 'Issuer', 'Foo'],
        },
      };
      mockHttpClientJsonResponse('get', profile);
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: tenant._id,
          serviceId: preauthIssuerService._id,
          depotId: preauthDepot._id,
        },
      });
      expect(response.statusCode).toEqual(200);
      const refreshedDepot = await mongoDb()
        .collection('depots')
        .findOne({ _id: new ObjectId(preauthDepot._id) });
      expect(response.json).toEqual({
        vnProtocolLink: `velocity-network-devnet://issue?${expectedSearchParams(
          tenant,
          preauthIssuerService,
          refreshedDepot,
          response.json.preauthCode,
          [],
        )}`,
        redirectUrl: `https://localhost.test/app-redirect?deeplink=${encodeURIComponent(
          response.json.vnProtocolLink,
        )}`,
        preauthCode: expect.any(String),
        requestId: expect.any(String),
      });
    });
  });

  describe('vp service', () => {
    beforeEach(async () => {
      vpIssuerService = await persistIssuerService({
        tenant,
      });
      vpDepot = await persistDepot({
        tenant,
        service: vpIssuerService,
        userReference: nanoid(),
      });
    });
    it('should 200 for vp service if missing depotId property', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: tenant._id,
          serviceId: vpIssuerService._id,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        vnProtocolLink: `velocity-network-devnet://issue?${expectedSearchParams(
          tenant,
          vpIssuerService,
        )}`,
        redirectUrl: `https://localhost.test/app-redirect?deeplink=${encodeURIComponent(
          response.json.vnProtocolLink,
        )}`,
        requestId: expect.any(String),
      });
    });
    it('should 200 for vp service', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: {
          tenantId: tenant._id,
          serviceId: vpIssuerService._id,
          depotId: vpDepot._id,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        vnProtocolLink: `velocity-network-devnet://issue?${expectedSearchParams(
          tenant,
          vpIssuerService,
          vpDepot,
        )}`,
        redirectUrl: `https://localhost.test/app-redirect?deeplink=${encodeURIComponent(
          response.json.vnProtocolLink,
        )}`,
        requestId: expect.any(String),
      });
    });
  });
});

const expectedSearchParams = (
  tenant,
  service,
  depot,
  preauthCode,
  credentialTypes,
) => {
  const encodedTenantDid = encodeURI(tenant.did);
  let searchParamsString = `request_uri=https%3A%2F%2Flocalhost.test%2Fvn-api%2Fr%2F${encodeURIComponent(
    encodedTenantDid,
  )}%2Fget-credential-manifest%3Fid%3D${encodeURIComponent(service._id)}`;
  credentialTypes?.forEach((credentialType) => {
    searchParamsString += `%26credential_types%3D${credentialType}`;
  });
  searchParamsString += `&issuerDid=${encodeURIComponent(tenant.did)}`;
  if (preauthCode != null) {
    searchParamsString += `&vendorOriginContext=${encodeURIComponent(
      `depot:${depot._id}:${preauthCode}`,
    )}`;
  }
  return searchParamsString;
};

const expectedOidcCredentialOfferUri = (uri, tenant, credentialTypes) => {
  const urlObj = new URL(uri);
  expect(urlObj.protocol).toEqual('openid-credential-offer:');
  expect(urlObj.host).toEqual('');
  expect(urlObj.pathname).toEqual('');
  const credentialOfferValue = urlObj.searchParams.get('credential_offer');
  const credentialOffer = JSON.parse(credentialOfferValue);
  expect(credentialOffer).toEqual({
    credential_issuer: `https://localhost.test/r/${tenant._id}`,
    credential_configuration_ids: map(
      (cT) => `foundation.velocitynetwork.${cT}`,
      credentialTypes,
    ),
    grants: {
      'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
        'pre-authorized_code': expect.any(String),
      },
    },
  });
};
