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
const { describe, it, before, after, beforeEach } = require('node:test');
const { expect } = require('expect');
const nock = require('nock').default;
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { omit } = require('lodash/fp');
const { addYears } = require('date-fns/fp');
const {
  OBJECT_ID_FORMAT,
  ISO_DATETIME_FORMAT,
} = require('@verii/test-regexes');
const { mongoify } = require('@verii/tests-helpers');
const createTestFastify = require('../helpers/create-test-fastify');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initRelyingPartyServiceFactory,
  relyingPartyServicesRepoPlugin,
} = require('../../src/entities/relying-party-services');
const { initDepotFactory } = require('../../src/entities/depots');
const testPresentationDefinition = require('../helpers/presentation-definition.json');

const REGISTRAR_HOST = 'http://oracle.localhost.test';
const testUrl = '/operator/relying-party-services';

const errorResponseExpectation = {
  error: expect.any(String),
  errorCode: expect.any(String),
  requestId: expect.any(String),
  message: expect.any(String),
  statusCode: expect.any(Number),
};
const errorResponseMatcher = (expectationOverrides, { omits } = {}) => {
  const omitFn = omit(omits);
  return omitFn({ ...errorResponseExpectation, ...expectationOverrides });
};

describe('Relying party service configuration test suite', () => {
  let fastify;
  let persistTenant;
  let persistDepot;
  let tenant;
  let persistRelyingPartyService;
  let relyingPartyServicesRepo;

  before(async () => {
    try {
      fastify = createTestFastify();
      await fastify.ready();

      ({ persistTenant } = initTenantFactory(fastify));
      ({ persistRelyingPartyService } =
        initRelyingPartyServiceFactory(fastify));
      ({ persistDepot } = initDepotFactory(fastify));
    } catch (e) {
      console.error(e);
    }
  });

  beforeEach(async () => {
    nock.cleanAll();
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('relyingPartyServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    tenant = await persistTenant();
    relyingPartyServicesRepo = relyingPartyServicesRepoPlugin(fastify)({
      tenant: { ...tenant, _id: new ObjectId(tenant._id) },
    });
  });

  after(async () => {
    nock.restore();
    await fastify.close();
  });

  describe('Relying Party Service Creation Test Suite', () => {
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
            mode: 'single',
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
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
            mode: 'single',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
            mode: 'single',
            velocityNetworkServiceId: [],
            termsUrl: 'http://www.example.com',
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
            mode: 'single',
            velocityNetworkServiceId: '#foo',
            authTokensExpireIn: 100000,
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
            mode: 'single',
            velocityNetworkServiceId: '#foo',
            termsUrl: 'foo',
            authTokensExpireIn: 100000,
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
    it('should 400 when additional property is present on service', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            mode: 'single',
            foo: 'foo',
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
      nock(REGISTRAR_HOST)
        .get(`/api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`)
        .reply(404);
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            mode: 'single',
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
    });
    it('should 400 when velocityNetworkServiceId does not match a did doc service', async () => {
      nock(REGISTRAR_HOST)
        .get(`/api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`)
        .reply(200, {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            mode: 'single',
            velocityNetworkServiceId: '#bar',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
    });
    it('should 400 when velocityNetworkServiceId is duplicate', async () => {
      nock(REGISTRAR_HOST)
        .get(`/api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`)
        .reply(200, {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
      await persistRelyingPartyService({
        tenant,
        velocityNetworkServiceId: '#foo',
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            mode: 'single',
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
    });
    describe('successful relying party service creation', () => {
      beforeEach(() => {
        nock(REGISTRAR_HOST)
          .get(`/api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`)
          .reply(200, {
            id: 'did-doc-foo',
            service: [{ id: '#foo' }],
          });
      });
      it('should 200 and create vp service with disclosureRequest', async () => {
        const now = new Date();
        const payload = {
          tenantId: tenant._id,
          service: {
            mode: 'single',
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
            presentationRequestsExpireIn: 600,
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          requestId: expect.any(String),
        });

        const dbRelyingPartyService = await relyingPartyServicesRepo.findById(
          response.json.service.id,
        );
        expect(dbRelyingPartyService).toEqual({
          ...mongoify(payload.service),
          _id: new ObjectId(response.json.service.id),
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          tenantId: new ObjectId(tenant._id),
        });
      });

      it('should 200 and create vp service with presentationDefinition', async () => {
        const payload = {
          tenantId: tenant._id,
          service: {
            mode: 'single',
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            presentationDefinition: testPresentationDefinition,
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
            presentationRequestsExpireIn: 600,
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          requestId: expect.any(String),
        });
        const dbRelyingPartyService = await relyingPartyServicesRepo.findById(
          response.json.service.id,
        );
        expect(dbRelyingPartyService).toEqual({
          ...mongoify(payload.service),
          _id: new ObjectId(response.json.service.id),
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          tenantId: new ObjectId(tenant._id),
        });
      });

      it('should 200 and create vp service for a feed', async () => {
        const now = new Date();
        const payload = {
          tenantId: tenant._id,
          service: {
            mode: 'feed',
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
            presentationRequestsExpireIn: 600,
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          requestId: expect.any(String),
        });

        const dbRelyingPartyService = await relyingPartyServicesRepo.findById(
          response.json.service.id,
        );
        expect(dbRelyingPartyService).toEqual({
          ...mongoify(payload.service),
          _id: new ObjectId(response.json.service.id),
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          tenantId: new ObjectId(tenant._id),
        });
      });
    });
  });

  describe('Relying Party Service Retrieval Test Suite', () => {
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
      const service = await persistRelyingPartyService({ tenant: tenant2 });
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
      const service = await persistRelyingPartyService({ tenant });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&serviceId=${service._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        services: [expectedRelyingPartyService(service)],
        requestId: expect.any(String),
      });
    });
  });

  describe('Relying Party Service Update Test Suite', () => {
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
            mode: 'single',
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
            mode: 'single',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
            mode: 'single',
            velocityNetworkServiceId: [],
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
            mode: 'single',
            velocityNetworkServiceId: '#foo',
            authTokensExpireIn: 100000,
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
            mode: 'single',
            velocityNetworkServiceId: '#foo',
            termsUrl: 'foo',
            authTokensExpireIn: 100000,
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
    it('should 400 when additional property is present on service', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            mode: 'single',
            foo: 'foo',
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
      nock(REGISTRAR_HOST)
        .get(`/api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`)
        .reply(404);
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: 'foo',
          service: {
            mode: 'single',
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
    });
    it('should 400 when velocityNetworkServiceId does not match a did doc service', async () => {
      nock(REGISTRAR_HOST)
        .get(`/api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`)
        .reply(200, {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
      const service = await persistRelyingPartyService({
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: {
            mode: 'single',
            velocityNetworkServiceId: '#bar',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
    });
    it('should 400 when velocityNetworkServiceId is duplicate', async () => {
      nock(REGISTRAR_HOST)
        .get(`/api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`)
        .reply(200, {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
      const service = await persistRelyingPartyService({
        tenant,
      });
      await persistRelyingPartyService({
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
            mode: 'single',
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
    });
    it('should 400 when service is not found', async () => {
      nock(REGISTRAR_HOST)
        .get(`/api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`)
        .reply(200, {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
      await persistRelyingPartyService({
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: new ObjectId(),
          service: {
            mode: 'single',
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
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
    });
    it('should 200 and update a relyingParty service', async () => {
      nock(REGISTRAR_HOST)
        .get(`/api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`)
        .reply(200, {
          id: 'did-doc-foo',
          service: [{ id: '#foo-updated' }],
        });
      const service = await persistRelyingPartyService({
        tenant,
      });
      const payload = {
        tenantId: tenant._id,
        serviceId: service._id,
        service: {
          mode: 'single',
          velocityNetworkServiceId: '#foo-updated',
          description: 'foo updated',
          termsUrl: 'http://www.example.com',
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
          ...expectedRelyingPartyService(service),
          ...payload.service,
          id: service._id,
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
        requestId: expect.any(String),
      });
      const dbRelyingPartyService = await relyingPartyServicesRepo.findById(
        service._id,
      );
      expect(dbRelyingPartyService).toEqual(
        expectedDbRelyingPartyService(response.json.service, tenant),
      );
    });
  });

  describe('Relying Party Service Deletion Test Suite', () => {
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
      const service = await persistRelyingPartyService({ tenant: tenant2 });
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
      const service = await persistRelyingPartyService({ tenant: tenant2 });
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

      const dbRelyingPartyService = await mongoDb()
        .collection('relyingPartyServices')
        .findOne({ _id: new ObjectId(service._id) });
      expect(dbRelyingPartyService).not.toBeNull();
    });

    it('should 200 with services of tenant, and delete the service', async () => {
      const service = await persistRelyingPartyService({ tenant });
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

      const dbRelyingPartyServices = await mongoDb()
        .collection('relyingPartyServices')
        .find()
        .toArray();
      expect(dbRelyingPartyServices).toEqual([]);
    });
  });
});

const expectedRelyingPartyService = (relyingPartyService) => ({
  id: relyingPartyService._id,
  ...omit(['tenantId', '_id'], relyingPartyService),
});

const expectedDbRelyingPartyService = (response, tenant) => ({
  ...mongoify(omit(['id'], response)),
  _id: new ObjectId(response.id),
  tenantId: new ObjectId(tenant._id),
});
