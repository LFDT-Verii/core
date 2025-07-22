/**
 * Copyright 2023 Velocity Team
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

// eslint-disable-next-line import/order
const nock = require('nock');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { first, flow, map, omit, sortBy } = require('lodash/fp');
const { idKeyMapper } = require('@verii/common-functions');
const { errorResponseMatcher, mongoify } = require('@verii/tests-helpers');
const {
  rootIssuerProfile,
  rootIssuerVerifiedProfile,
} = require('@verii/sample-data');
const { ObjectId } = require('mongodb');
const { decrypt, generateKeyPair } = require('@verii/crypto');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const { createOrgDoc } = require('./helpers/create-test-org-doc');
const {
  nockRegistrarGetOrganizationDidDoc,
} = require('../combined/helpers/nock-registrar-get-organization-diddoc');
const {
  nockRegistrarGetOrganizationVerifiedProfile,
} = require('../combined/helpers/nock-registrar-get-organization-verified-profile');

const {
  initDisclosureFactory,
  initTenantFactory,
  initKeysFactory,
  tenantRepoPlugin,
  groupRepoPlugin,
  initGroupsFactory,
  VendorEndpoint,
} = require('../../src/entities');
const { initAgentKms } = require('./helpers/init-agent-kms');

const buildUrl = () => '/operator-api/v0.8/tenants';

describe('Tenant management Test Suite', () => {
  let fastify;
  let persistTenant;
  let persistDisclosure;
  let persistGroup;
  let persistKey;
  let orgDoc;
  let tenantRepo;
  let groupRepo;
  let agentKms;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistDisclosure } = initDisclosureFactory(fastify));
    ({ persistGroup } = initGroupsFactory(fastify));
    ({ persistKey } = initKeysFactory(fastify));

    ({ orgDoc } = await createOrgDoc());
    tenantRepo = tenantRepoPlugin(fastify)();
    groupRepo = groupRepoPlugin(fastify)();
    agentKms = initAgentKms(fastify);
  });

  beforeEach(async () => {
    nock.cleanAll();
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('groups').deleteMany({});
    nockRegistrarGetOrganizationDidDoc(orgDoc.id, orgDoc);
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  describe('Tenant Update tests', () => {
    it('should return HTTP 404 when tenant not found when trying to update', async () => {
      const tenant = {
        _id: new ObjectId(),
      };

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${buildUrl()}/${tenant._id}`,
        payload: {
          serviceIds: tenant.serviceIds,
        },
      });
      expect(response.statusCode).toEqual(404);
      expect(response.json.message).toEqual(
        `Tenant ${JSON.stringify({ tenantId: tenant._id })} not found`
      );
    });

    it('should return HTTP 404 when DID not found when trying to update', async () => {
      const { orgDoc: orgDoc2 } = await createOrgDoc();
      const tenant = await persistTenant({
        did: orgDoc2.id,
        serviceIds: [`${orgDoc2.id}#test-service`],
      });
      nockRegistrarGetOrganizationDidDoc(orgDoc2.id, {});

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${buildUrl()}/${tenant._id}`,
        payload: {
          serviceIds: tenant.serviceIds,
        },
      });

      expect(response.statusCode).toEqual(404);
    });

    it('should return 400 if webhookUrl is not uri', async () => {
      const tenant = await persistTenant({
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${buildUrl()}/${tenant._id}`,
        payload: {
          serviceIds: tenant.serviceIds,
          webhookUrl: 'customUrl',
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: 'body/webhookUrl must match format "uri"',
          statusCode: 400,
        })
      );
    });

    it('should be able to update an existing tenant', async () => {
      const tenant = await persistTenant({
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${buildUrl()}/${tenant._id}`,
        headers: {
          authorization: 'Bearer',
        },
        payload: {
          serviceIds: tenant.serviceIds,
          webhookUrl: 'http://customUrl.com',
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        createdAt: tenant.createdAt,
        id: tenant._id,
      });
    });

    it('should be updated an existing tenant with webhookUrl', async () => {
      const tenant = await persistTenant({
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${buildUrl()}/${tenant._id}`,
        payload: {
          serviceIds: tenant.serviceIds,
          webhookUrl: 'http://customUrl.com',
        },
      });

      const updatedTenant = await tenantRepo.findOne(tenant._id);

      expect(updatedTenant).toEqual({
        ...tenant,
        _id: new ObjectId(tenant._id),
        webhookUrl: 'http://customUrl.com',
        updatedAt: expect.any(Date),
        createdAt: new Date(tenant.createdAt),
      });

      expect(updatedTenant.updatedAt).not.toEqual(tenant.updatedAt);

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        createdAt: tenant.createdAt,
        id: tenant._id,
      });
    });

    it('should be updated an existing tenant with encrypted bearerToken', async () => {
      const tenant = await persistTenant({
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${buildUrl()}/${tenant._id}`,
        payload: {
          serviceIds: tenant.serviceIds,
          webhookAuth: {
            type: ['bearer'],
            bearerToken: 'secretToken',
          },
        },
      });

      const updatedTenant = await tenantRepo.findOne(tenant._id);

      expect(updatedTenant).toEqual({
        ...tenant,
        _id: new ObjectId(tenant._id),
        webhookAuth: {
          bearerToken: expect.any(String),
          type: 'bearer',
        },
        updatedAt: expect.any(Date),
        createdAt: new Date(tenant.createdAt),
      });

      const decryptedBearerToken = decrypt(
        updatedTenant.webhookAuth.bearerToken,
        fastify.config.mongoSecret
      );
      expect(decryptedBearerToken).toBe('secretToken');

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        createdAt: tenant.createdAt,
        id: tenant._id,
      });
    });

    it('should allow removal of bearerToken from tenant', async () => {
      const tenant = await persistTenant({
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        webhookAuth: {
          type: 'bearer',
          bearerToken: 'secretToken',
        },
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${buildUrl()}/${tenant._id}`,
        payload: {
          serviceIds: tenant.serviceIds,
          webhookAuth: {
            bearerToken: '',
            type: 'bearer',
          },
        },
      });

      const updatedTenant = await tenantRepo.findOne(tenant._id);

      expect(updatedTenant).toEqual({
        ...tenant,
        _id: new ObjectId(tenant._id),
        updatedAt: expect.any(Date),
        createdAt: new Date(tenant.createdAt),
        webhookAuth: {
          type: 'bearer',
          bearerToken: '',
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        createdAt: tenant.createdAt,
        id: tenant._id,
      });
    });

    it('should be able to update an existing tenant using relative serviceIds', async () => {
      const tenant = await persistTenant({
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `${buildUrl()}/${tenant._id}`,
        payload: {
          serviceIds: ['#test-service'],
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        createdAt: tenant.createdAt,
        id: tenant._id,
      });
    });

    describe('Tenant update with authorized group test suite', () => {
      it('should be able to update an existing tenant if has auth group', async () => {
        const tenant = await persistTenant({
          did: orgDoc.id,
          serviceIds: [`${orgDoc.id}#test-service`],
        });
        await persistGroup({ _id: 'did:velocity:123', dids: [orgDoc.id] });
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${buildUrl()}/${tenant._id}`,
          headers: {
            authorization: 'Bearer',
            'x-override-auth-user-group-id': 'did:velocity:123',
          },
          payload: {
            serviceIds: tenant.serviceIds,
            webhookUrl: 'http://customUrl.com',
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          createdAt: tenant.createdAt,
          id: tenant._id,
        });
      });
    });
  });

  describe('Tenant Retrieval tests', () => {
    it('should be able to get a tenant by did', async () => {
      const tenant = await persistTenant({
        did: orgDoc.id,
        webhookUrl: 'https://customurl.com',
        serviceIds: [`${orgDoc.id}#test-service`],
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}/${tenant._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...omit(['_id'], tenant),
        id: tenant._id,
        updatedAt: expect.any(String),
      });
    });

    it('defaultIssuingDisclosureId should be automatically set on tenant if it is missing', async () => {
      const tenant = await persistTenant({
        did: orgDoc.id,
        webhookUrl: 'https://customurl.com',
        serviceIds: [`${orgDoc.id}#test-service`],
      });

      const disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}/${tenant._id}`,
      });

      await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      });

      await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}/${tenant._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...omit(['_id'], tenant),
        id: tenant._id,
        updatedAt: expect.any(String),
      });

      const db = await tenantRepo.findOne(tenant._id);
      expect(db.defaultIssuingDisclosureId.toString()).toEqual(disclosure._id);
    });

    it('defaultIssuingDisclosureId should not be set on tenant if defaultIssuingDisclosureId is null', async () => {
      const insertedTenant = await mongoDb()
        .collection('tenants')
        .insertOne({
          did: orgDoc.id,
          primaryAddress: '0x12345',
          webhookUrl: 'https://customurl.com',
          serviceIds: [`${orgDoc.id}#test-service`],
          defaultIssuingDisclosureId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const tenant = await mongoDb()
        .collection('tenants')
        .findOne({ _id: insertedTenant.insertedId });

      await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}/${tenant._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...omit(['_id', 'defaultIssuingDisclosureId'], tenant),
        id: tenant._id.toString(),
        updatedAt: expect.any(String),
        createdAt: expect.any(String),
      });

      const db = await tenantRepo.findOne(tenant._id);
      expect(db.defaultIssuingDisclosureId).toEqual(null);
    });

    it('should 200 when getting a tenant by did', async () => {
      const tenant = await persistTenant({
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}/${tenant.did}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...omit(['_id', 'serviceId'], tenant),
        serviceIds: tenant.serviceIds,
        id: tenant._id,
        updatedAt: expect.any(String),
      });
    });

    it('should handle tenants with single serviceId', async () => {
      const tenant = await persistTenant({
        did: orgDoc.id,
        serviceId: `${orgDoc.id}#test-service`,
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}/${tenant._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...omit(['_id', 'serviceId'], tenant),
        serviceIds: [tenant.serviceId],
        id: tenant._id,
        updatedAt: expect.any(String),
      });
    });

    it('should be able to get a full tenant profile by did', async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        orgDoc.id,
        rootIssuerVerifiedProfile
      );

      const tenant = await persistTenant({
        did: orgDoc.id,
        serviceIds: [first(orgDoc.service).id],
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}/${tenant._id}?fullProfile=true`,
      });

      const expectedResult = {
        ...omit(['_id'], tenant),
        did: orgDoc.id,
        name: rootIssuerProfile.name,
        logo: rootIssuerProfile.logo,
        credentialTypesIssued: ['CurrentEmploymentPosition'],
      };

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...expectedResult,
        ...omit(['_id'], tenant),
        updatedAt: expect.any(String),
        id: tenant._id,
      });
    });

    it("should be able to get a full tenant profile by id when it's missing a service ID", async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        orgDoc.id,
        rootIssuerVerifiedProfile
      );

      const tenant = await persistTenant({
        did: orgDoc.id,
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}/${tenant._id}?fullProfile=true`,
      });

      const expectedResult = {
        ...omit(['_id'], tenant),
        did: orgDoc.id,
        name: rootIssuerProfile.name,
        logo: rootIssuerProfile.logo,
        credentialTypesIssued: [],
      };

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        ...expectedResult,
        ...omit(['_id'], tenant),
        updatedAt: expect.any(String),
        id: tenant._id,
      });
    });

    it("should be able to get a tenant's key by id from the mongo collection", async () => {
      const privateKeyPair1 = generateKeyPair({ format: 'jwk' });
      const privateKeyPair2 = generateKeyPair({ format: 'jwk' });
      const tenant1 = await persistTenant();
      const tenantKey1 = await persistKey({
        tenant: tenant1,
        kidFragment: '#ID1',
        keyPair: privateKeyPair1,
      });

      const tenant2 = await persistTenant();
      await persistKey({
        tenant: tenant2,
        kidFragment: '#ID2',
        keyPair: privateKeyPair2,
      });

      const kmsKey = await agentKms({
        tenant: mongoify(tenant1),
      }).exportKeyOrSecret(tenantKey1._id);
      expect(kmsKey.privateJwk).toEqual(privateKeyPair1.privateKey);
    });

    it('should be able to fail with 404 if a tenant cannot be found', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}/507f1f77bcf86cd799439011`,
      });

      expect(response.statusCode).toEqual(404);
    });
  });

  describe('Tenants Retrieval tests', () => {
    it('should be able to get multiple tenants', async () => {
      const { orgDoc: orgDoc2 } = await createOrgDoc();
      const { orgDoc: orgDoc3 } = await createOrgDoc();

      const tenant1 = await persistTenant({
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
      });
      const tenant2 = await persistTenant({
        did: orgDoc2.id,
        serviceIds: [`${orgDoc2.id}#test-service`],
      });
      const tenant3 = await persistTenant({
        did: orgDoc3.id,
        serviceIds: [`${orgDoc3.id}#test-service`],
      });
      const tenants = [tenant1, tenant2, tenant3];

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual(
        flow(
          map(idKeyMapper),
          map((tenant) => ({
            ...omit(['_id'], tenant),
          })),
          sortBy((t) => -new Date(t.createdAt).getTime())
        )(tenants)
      );
    });

    it('should be able to get multiple tenants with single serviceId', async () => {
      const { orgDoc: orgDoc2 } = await createOrgDoc();
      const { orgDoc: orgDoc3 } = await createOrgDoc();

      const tenant1 = await persistTenant({
        did: orgDoc.id,
        serviceId: `${orgDoc.id}#test-service`,
      });
      const tenant2 = await persistTenant({
        did: orgDoc2.id,
        serviceId: `${orgDoc2.id}#test-service`,
      });
      const tenant3 = await persistTenant({
        did: orgDoc3.id,
        serviceId: `${orgDoc3.id}#test-service`,
      });
      const tenants = [tenant1, tenant2, tenant3];

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual(
        flow(
          map(idKeyMapper),
          map((tenant) => ({
            ...omit(['_id', 'serviceId'], tenant),
            serviceIds: [tenant.serviceId],
          })),
          sortBy((t) => -new Date(t.createdAt).getTime())
        )(tenants)
      );
    });

    it('should be able to get multiple tenants that have no service ID', async () => {
      const { orgDoc: orgDoc2 } = await createOrgDoc();
      const { orgDoc: orgDoc3 } = await createOrgDoc();

      const tenant1 = await persistTenant({
        did: orgDoc.id,
      });
      const tenant2 = await persistTenant({
        did: orgDoc2.id,
      });
      const tenant3 = await persistTenant({
        did: orgDoc3.id,
      });
      const tenants = [tenant1, tenant2, tenant3];

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual(
        flow(
          map(idKeyMapper),
          map((tenant) => ({
            ...omit(['_id'], tenant),
          })),
          sortBy((t) => -new Date(t.createdAt).getTime())
        )(tenants)
      );
    });
  });

  describe('Tenant Removal tests', () => {
    it('should be able to delete a tenant, as well as its did from related group', async () => {
      const tenant = await persistTenant();

      await persistGroup({
        groupId: 'groupIdRemovalTest',
        dids: ['test_tenant_did', tenant.did],
      });

      const delResponse = await fastify.injectJson({
        method: 'DELETE',
        url: `${buildUrl()}/${tenant._id}`,
      });
      expect(delResponse.statusCode).toEqual(204);

      const group = await groupRepo.findOne({});

      expect(group.dids).toEqual(['test_tenant_did']);

      const getResponse = await fastify.injectJson({
        method: 'GET',
        url: `${buildUrl()}/${tenant._id}`,
      });

      expect(getResponse.statusCode).toEqual(404);
    });

    it('should 404 when deleting a tenant that does not exist', async () => {
      const tenant = { _id: new ObjectId() };

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${buildUrl()}/${tenant._id}`,
      });
      expect(response.statusCode).toEqual(404);
      expect(response.json.message).toEqual(
        `Tenant ${JSON.stringify({ tenantId: tenant._id })} not found`
      );
    });
  });
});
