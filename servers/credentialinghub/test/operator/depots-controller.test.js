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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { errorResponseMatcher, mongoify } = require('@verii/tests-helpers');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const { nanoid } = require('nanoid');
const { omit } = require('lodash/fp');
const createTestFastify = require('../helpers/create-test-fastify');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initDepotFactory } = require('../../src/entities/depots');
const { initCredentialFactory } = require('../../src/entities/credentials');

const testUrl = '/operator/depots';
describe('Depots Test suite', () => {
  let fastify;
  let persistTenant;
  let persistIssuerService;
  let persistDepot;
  let persistCredential;

  let tenant;
  let issuerService;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistCredential } = initCredentialFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    tenant = await persistTenant();
    issuerService = await persistIssuerService({
      tenant,
      authMethods: ['preauth'],
    });
  });

  after(async () => {
    await fastify.close();
  });

  describe('Depot Creation Test Suite', () => {
    it('should 400 if depot.serviceId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: { tenantId: tenant._id },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body must have required property 'serviceId'",
        }),
      );
    });
    it('should 400 if referenced issuer service does not exist', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          serviceId: new ObjectId().toString(),
          depot: { userReference: 'ABC123' },
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          message: 'referenced_service_not_found',
          errorCode: 'referenced_service_not_found',
        }),
      );
    });
    it('should 400 if userReference is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depot: { authValues: [1] },
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body/depot must have required property 'userReference'",
        }),
      );
    });
    it('should 400 for a depot without authValues for a VP rulesEngine service', async () => {
      const vpService = await persistIssuerService({ tenant });
      const payload = {
        tenantId: tenant._id,
        serviceId: vpService._id,
        depot: { userReference: 'ABC123' },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'invalid_auth_values',
          message: 'invalid_auth_values',
          statusCode: 400,
        }),
      );
    });
    it('should 400 if depot contains messagingSettings', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depot: {
            userReference: 'ABC123',
            messagingSettings: {
              webhookUrl: 'https://wallet.example.com/push',
              authToken: 'push-token',
            },
          },
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: 'body/depot must NOT have additional properties',
        }),
      );
    });
    it('should 200 for a correctly setup depot', async () => {
      const payload = {
        tenantId: tenant._id,
        serviceId: issuerService._id,
        depot: { userReference: 'ABC123' },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload,
      });
      expect(response.json).toEqual({
        depot: {
          ...payload.depot,
          serviceId: payload.serviceId,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
        requestId: expect.any(String),
      });

      await expect(
        mongoDb().collection('depots').find({}).toArray(),
      ).resolves.toEqual([expectedDbDepot(response.json.depot, tenant)]);
    });

    it('should 200 for a correctly setup depot with authValues', async () => {
      const payload = {
        tenantId: tenant._id,
        serviceId: issuerService._id,
        depot: { userReference: 'ABC123', authValues: [nanoid(), 1] },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload,
      });
      expect(response.json).toEqual({
        depot: {
          ...payload.depot,
          serviceId: payload.serviceId,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
        requestId: expect.any(String),
      });

      await expect(
        mongoDb().collection('depots').find({}).toArray(),
      ).resolves.toEqual([expectedDbDepot(response.json.depot, tenant)]);
    });
  });

  describe('Find Depots Test Suite', () => {
    let tenant2;
    let depots;

    beforeEach(async () => {
      tenant2 = await persistTenant();

      depots = [
        await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
        }),
        await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
        }),
        await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
        }),
      ];
    });

    it('should return none if no depots match the tenant', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant2._id}`,
      });
      expect(response.json).toEqual({
        depots: [],
        requestId: expect.any(String),
      });
    });

    describe('Find Depots by serviceId', () => {
      it('should return none if no depots match the serviceId', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${
            tenant._id
          }&serviceId=${new ObjectId()}`,
        });
        expect(response.json).toEqual({
          depots: [],
          requestId: expect.any(String),
        });
      });
      it('should return 3 depots matching the serviceId', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${tenant._id}&serviceId=${issuerService._id}`,
        });
        expect(response.json).toEqual({
          depots: expect.arrayContaining(depots.map(expectedDepot)),
          requestId: expect.any(String),
        });
      });
    });

    describe('Find Depots by depotId', () => {
      it('should return none if no depots match the depotId', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${
            tenant._id
          }&depotId=${new ObjectId()}`,
        });
        expect(response.json).toEqual({
          depots: [],
          requestId: expect.any(String),
        });
      });
      it('should return 2 if 2 depots match the depotIds', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${tenant._id}&depotId=${depots[0]._id}&depotId=${depots[2]._id}`,
        });
        expect(response.json).toEqual({
          depots: [depots[2], depots[0]].map(expectedDepot),
          requestId: expect.any(String),
        });
      });
    });
  });

  describe('Depot Deletion Test Suite', () => {
    let depots;

    beforeEach(async () => {
      depots = [
        await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
        }),
        await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
        }),
        await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
        }),
      ];
    });

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

    it('should 400 when depotId is missing from body', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: { tenantId: 'foo', serviceId: 'foo' },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'depotId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when depotId is not a string', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: { tenantId: 'foo', serviceId: 'foo', depotId: {} },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/depotId must be string',
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when tenant is not recognized', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: new ObjectId(),
          serviceId: new ObjectId(),
          depotId: 'foo',
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

    it('should 400 when related credentials still exists', async () => {
      const credential1 = await persistCredential({ tenant, depot: depots[0] });
      const credential2 = await persistCredential({ tenant, depot: depots[0] });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depotId: depots[0]._id,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: `Credentials(s) ${credential2._id},${credential1._id} must be deleted before deleting depot ${depots[0]._id}`,
          errorCode: 'related_credential_undeleted',
        }),
      );
    });

    it('should 200 when non-existent depot is deleted', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depotId: new ObjectId(),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
      });
    });

    it("should 200 when depot's service is not of tenant, and not delete the depot", async () => {
      const tenant2 = await persistTenant();
      const service2 = await persistIssuerService({ tenant: tenant2 });
      const depot = await persistDepot({
        tenant,
        userReference: nanoid(),
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: service2._id,
          depotId: depot._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
      });

      const dbDepot = await mongoDb()
        .collection('depots')
        .findOne({ _id: new ObjectId(depot._id) });
      expect(dbDepot).not.toBeNull();
    });

    it('should 200 and delete depots', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depotId: depots[0]._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
      });

      const dbDepots = await mongoDb()
        .collection('depots')
        .find({ _id: new ObjectId(depots[0]._id) })
        .toArray();
      expect(dbDepots).toEqual([]);
    });
  });
});

const expectedDepot = (depot) => ({
  ...omit(['_id', 'tenantId'], depot),
  id: depot._id,
});

const expectedDbDepot = (response, tenant) => ({
  ...mongoify(omit(['id'], response)),
  _id: new ObjectId(response.id),
  tenantId: new ObjectId(tenant._id),
});
