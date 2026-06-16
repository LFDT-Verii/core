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
  mockHttpClient,
  mockHttpClientJsonResponse,
  mockHttpClientError,
  mockHttpClientModule,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { addYears } = require('date-fns/fp');
const { omit } = require('lodash/fp');
const { ObjectId } = require('mongodb');
const { errorResponseMatcher, mongoify } = require('@verii/tests-helpers');
const {
  OBJECT_ID_FORMAT,
  ISO_DATETIME_FORMAT,
} = require('@verii/test-regexes');
const testPresentationDefinition = require('../helpers/presentation-definition.json');
const createTestFastify = require('../helpers/create-test-fastify');
const { initTenantFactory } = require('../../src/entities/tenants');
const { initDepotFactory } = require('../../src/entities/depots');
const {
  initIssuerServiceFactory,
  issuerServicesRepoPlugin,
} = require('../../src/entities/issuer-services');

const testUrl = '/operator/issuer-services';

describe('Issuer services management Test suite', () => {
  let fastify;
  let persistTenant;
  let persistDepot;
  let tenant;
  let issuerServicesRepo;
  let persistIssuerService;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    tenant = await persistTenant();
    issuerServicesRepo = issuerServicesRepoPlugin(fastify)({
      tenant: { ...tenant, _id: new ObjectId(tenant._id) },
    });
    resetMockHttpClient();
  });

  after(async () => {
    await fastify.close();
  });

  describe('Issuer Service Creation Test Suite', () => {
    it('should 400 when tenantId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {},
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'tenantId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: { tenantId: 'foo' },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'service'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when tenantId is not recognized', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'Tenant not found',
          errorCode: 'tenant_not_found',
        }),
      );
    });
    it('should 400 when service.velocityNetworkServiceId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            "body/service must have required property 'velocityNetworkServiceId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.velocityNetworkServiceId is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: [],
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service/velocityNetworkServiceId must be string',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.termsUrl is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: '#foo',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/service must have required property 'termsUrl'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.termsUrl is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'foo',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service/termsUrl must match format "uri"',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMethods is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/service must have required property 'authMethods'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMethods is empty', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: [],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service/authMethods must NOT have fewer than 1 items',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMethods contains invalid value', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['foo'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            'body/service/authMethods/0 must be equal to one of the allowed values',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMode is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/service must have required property 'authMode'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMode is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'foo',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            'body/service/authMode must be equal to one of the allowed values',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules is missing with authMode of "internal"', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_verifiablePresentationAuthRules_required',
          errorCode: 'service_verifiablePresentationAuthRules_required',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules is empty with authMode of "internal"', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_verifiablePresentationAuthRules_required',
          errorCode: 'service_verifiablePresentationAuthRules_required',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules[*] is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: ['foo'],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            'body/service/verifiablePresentationAuthRules/0 must be object',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when additional property is present on service', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            foo: 'foo',
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service must NOT have additional properties',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when velocityNetworkServiceId does not resolve', async () => {
      mockHttpClientError('get', new Error('could not resolve did'));
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'did_document_not_found',
          errorCode: 'did_document_not_found',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    it('should 400 when velocityNetworkServiceId does not match a did doc service', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#bar',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_not_matched',
          errorCode: 'service_not_matched',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    it('should 400 when velocityNetworkServiceId is duplicate', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      await persistIssuerService({
        tenant,
        velocityNetworkServiceId: '#foo',
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_must_be_unique',
          errorCode: 'service_must_be_unique',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    describe('successful issuer service creation', () => {
      it('should 200 and create vp issuer service with disclosureRequest', async () => {
        mockHttpClientJsonResponse('get', {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
        const now = new Date();
        const payload = {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#foo',
            description: 'foo',
            termsUrl: 'http://www.example.com',
            disclosureRequest: {
              types: [{ type: 'foo' }],
              purpose: 'foo',
              retentionPeriod: 'P12D',
            },
            deactivationDate: addYears(1)(now).toISOString(),
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
            credentialTypesAvailable: ['foo'],
            autoCleanPII: true,
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create`,
          payload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          service: {
            ...payload.service,
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          requestId: expect.any(String),
        });
        expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
          `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
        ]);
        const dbIssuerService = await issuerServicesRepo.findById(
          response.json.service.id,
        );
        expect(dbIssuerService).toEqual({
          ...mongoify(payload.service),
          _id: new ObjectId(response.json.service.id),
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          tenantId: new ObjectId(tenant._id),
        });
      });

      it('should 200 and create vp issuer service with presentationDefinition', async () => {
        mockHttpClientJsonResponse('get', {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
        const payload = {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#foo',
            description: 'foo',
            termsUrl: 'http://www.example.com',
            presentationDefinition: testPresentationDefinition,
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
            autoCleanPII: true,
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create`,
          payload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          service: {
            ...payload.service,
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          requestId: expect.any(String),
        });
        expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
          `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
        ]);
        const dbIssuerService = await issuerServicesRepo.findById(
          response.json.service.id,
        );
        expect(dbIssuerService).toEqual({
          ...mongoify(payload.service),
          _id: new ObjectId(response.json.service.id),
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          tenantId: new ObjectId(tenant._id),
        });
      });

      it('should 200 and create preauth issuer service', async () => {
        mockHttpClientJsonResponse('get', {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
        const payload = {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#foo',
            description: 'foo',
            termsUrl: 'http://www.example.com',
            authMethods: ['preauth'],
            authMode: 'internal',
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create`,
          payload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          service: {
            ...payload.service,
            authTokensExpireIn: 604800,
            challengesExpireIn: 600,
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          requestId: expect.any(String),
        });
        expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
          `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
        ]);
        const dbIssuerService = await issuerServicesRepo.findById(
          response.json.service.id,
        );
        expect(dbIssuerService).toEqual({
          ...mongoify(payload.service),
          _id: new ObjectId(response.json.service.id),
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          tenantId: new ObjectId(tenant._id),
        });
      });
    });
  });

  describe('Issuer Service Retrieval Test Suite', () => {
    it('should 400 when tenant query param is missing', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get`,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "querystring must have required property 'tenantId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when tenant is not recognized', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=foo`,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'Tenant not found',
          errorCode: 'tenant_not_found',
        }),
      );
    });

    it('should 200 empty array when service is not recognized', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&serviceId=foo`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        services: [],
        requestId: expect.any(String),
      });
    });

    it('should 200 empty array when service is not of a tenant', async () => {
      const tenant2 = await persistTenant();
      const service = await persistIssuerService({ tenant: tenant2 });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&serviceId=${service._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        services: [],
        requestId: expect.any(String),
      });
    });

    it('should 200 with service of tenant', async () => {
      const service = await persistIssuerService({ tenant });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&serviceId=${service._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        services: [expectedIssuerService(service)],
        requestId: expect.any(String),
      });
    });
  });

  describe('Issuer Service Update Test Suite', () => {
    it('should 400 when tenantId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {},
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'tenantId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when serviceId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: { tenantId: 'foo' },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'serviceId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: { tenantId: 'foo', serviceId: 'foo' },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'service'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when tenantId is not recognized', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'Tenant not found',
          errorCode: 'tenant_not_found',
        }),
      );
    });
    it('should 400 when service.velocityNetworkServiceId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            "body/service must have required property 'velocityNetworkServiceId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.velocityNetworkServiceId is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: [],
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service/velocityNetworkServiceId must be string',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.termsUrl is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: '#foo',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/service must have required property 'termsUrl'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.termsUrl is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'foo',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service/termsUrl must match format "uri"',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMethods is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/service must have required property 'authMethods'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMethods is empty', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: [],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service/authMethods must NOT have fewer than 1 items',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMethods contains invalid value', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['foo'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            'body/service/authMethods/0 must be equal to one of the allowed values',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMode is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/service must have required property 'authMode'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMode is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'foo',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            'body/service/authMode must be equal to one of the allowed values',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules is missing with authMode of "internal"', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const service = await persistIssuerService({
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_verifiablePresentationAuthRules_required',
          errorCode: 'service_verifiablePresentationAuthRules_required',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules is empty with authMode of "internal"', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const service = await persistIssuerService({
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_verifiablePresentationAuthRules_required',
          errorCode: 'service_verifiablePresentationAuthRules_required',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules[*] is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: ['foo'],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            'body/service/verifiablePresentationAuthRules/0 must be object',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when additional property is present on service', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            foo: 'foo',
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service must NOT have additional properties',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when velocityNetworkServiceId does not resolve', async () => {
      mockHttpClientError('get', new Error('could not resolve did'));
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'did_document_not_found',
          errorCode: 'did_document_not_found',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    it('should 400 when velocityNetworkServiceId does not match a did doc service', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const service = await persistIssuerService({
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: {
            velocityNetworkServiceId: '#bar',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_not_matched',
          errorCode: 'service_not_matched',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    it('should 400 when velocityNetworkServiceId is duplicate', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const service = await persistIssuerService({
        tenant,
      });
      await persistIssuerService({
        tenant,
        velocityNetworkServiceId: '#foo',
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_must_be_unique',
          errorCode: 'service_must_be_unique',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    it('should 400 when service is not found', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      await persistIssuerService({
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: new ObjectId(),
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              { path: ['foo'], rule: 'pick', valueIndex: 0 },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_not_found',
          errorCode: 'service_not_found',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    it('should 200 and update an issuer service', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo-updated' }],
      });
      const service = await persistIssuerService({
        tenant,
      });
      const payload = {
        tenantId: tenant._id,
        serviceId: service._id,
        service: {
          velocityNetworkServiceId: '#foo-updated',
          description: 'foo updated',
          termsUrl: 'http://www.example.com',
          authMethods: ['preauth'],
          authMode: 'internal',
        },
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        service: {
          ...expectedIssuerService(service),
          ...payload.service,
          id: service._id,
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
        requestId: expect.any(String),
      });
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
      const dbIssuerService = await issuerServicesRepo.findById(service._id);
      expect(dbIssuerService).toEqual(
        expectedDbIssuerService(response.json.service, tenant),
      );
    });
  });

  describe('Issuer Service Deletion Test Suite', () => {
    it('should 400 when tenantId is missing from body', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {},
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'tenantId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when serviceId is missing from body', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: 'foo',
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'serviceId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when serviceId is not a string', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: 'foo',
          serviceId: {},
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/serviceId must be string',
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when tenant is not recognized', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'Tenant not found',
          errorCode: 'tenant_not_found',
        }),
      );
    });

    it('should 400 when a related depot still exists', async () => {
      const tenant2 = await persistTenant();
      const service = await persistIssuerService({ tenant: tenant2 });
      const depot = await persistDepot({ tenant, service });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: `Depot(s) ${depot._id} must be deleted before deleting service ${service._id}`,
          errorCode: 'related_depot_undeleted',
        }),
      );
    });

    it('should 200 when a non-existent service is deleted', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: new ObjectId(),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
      });
    });

    it('should 200 when a service is not of a tenant, and not delete the service', async () => {
      const tenant2 = await persistTenant();
      const service = await persistIssuerService({ tenant: tenant2 });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
      });

      const dbIssuerService = await mongoDb()
        .collection('issuerServices')
        .findOne({ _id: new ObjectId(service._id) });
      expect(dbIssuerService).not.toBeNull();
    });

    it('should 200 with services of tenant, and delete the service', async () => {
      const service = await persistIssuerService({ tenant });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
      });

      const dbIssuerServices = await mongoDb()
        .collection('issuerServices')
        .find()
        .toArray();
      expect(dbIssuerServices).toEqual([]);
    });
  });
});

const expectedIssuerService = (issuerService) => ({
  id: issuerService._id,
  ...omit(['tenantId', '_id'], issuerService),
});

const expectedDbIssuerService = (response, tenant) => ({
  ...mongoify(omit(['id'], response)),
  _id: new ObjectId(response.id),
  tenantId: new ObjectId(tenant._id),
});
