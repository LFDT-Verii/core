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

const {
  flatMap,
  flow,
  isEmpty,
  map,
  uniq,
  omitBy,
  isNil,
} = require('lodash/fp');
const newError = require('http-errors');
const {
  resolveDid,
  getOrganizationVerifiedProfile,
} = require('@verii/common-fetchers');

const {
  buildServiceIds,
  extractService,
  validateServiceIds,
  buildCleanPiiFilter,
} = require('../../../../entities');

const tenantController = async (fastify) => {
  const getOrgServiceTypes = (didDoc, serviceIds) => {
    const services = map(
      (serviceId) => extractService(serviceId)(didDoc),
      serviceIds
    );

    const serviceTypes = flow(map('type'), uniq)(services);
    const credentialTypes = flatMap('credentialTypes', services);
    return { serviceTypes, credentialTypes };
  };

  const getOrgInfo = async (tenantDid, didDoc, serviceIds, context) => {
    const { credentialSubject: orgProfile } =
      await getOrganizationVerifiedProfile(tenantDid, context);
    const { name, logo } = orgProfile;

    const { serviceTypes, credentialTypes } = getOrgServiceTypes(
      didDoc,
      serviceIds
    );

    return {
      name,
      logo,
      services: serviceTypes,
      credentialTypesIssued: credentialTypes,
    };
  };

  fastify.put(
    '/',
    {
      schema: fastify.autoSchema({
        body: {
          $ref: 'https://velocitycareerlabs.io/modify-tenant-v0.8.schema.json',
        },
        response: {
          200: {
            $ref: 'immutable-entity#',
          },
        },
      }),
    },
    async (req) => {
      const { tenant, body } = req;
      const { serviceIds, webhookUrl, webhookAuth } = body;
      const didDoc = await resolveDid(tenant.did, req);

      if (isEmpty(didDoc)) {
        throw new newError.NotFound(
          `Organization with DID "${didDoc.id}" was not found on the blockchain`
        );
      }

      validateServiceIds(didDoc, serviceIds);

      const updatedTenant = omitBy(isNil, {
        ...tenant,
        serviceIds,
        webhookUrl,
        webhookAuth,
      });

      return req.repos.tenants.update(tenant._id, updatedTenant);
    }
  );

  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
        query: {
          type: 'object',
          properties: {
            fullProfile: { type: 'boolean' },
          },
        },
        response: {
          200: {
            $ref: 'https://velocitycareerlabs.io/tenant-v0.8.schema.json#',
          },
        },
      }),
    },
    async (req) => {
      const { tenant } = req;
      return {
        ...tenant,
        serviceIds: buildServiceIds(tenant),
        ...(req.query.fullProfile
          ? await getOrgInfo(
              tenant.did,
              await resolveDid(tenant.did, req),
              buildServiceIds(tenant),
              req
            )
          : {}),
      };
    }
  );

  fastify.delete(
    '/',
    {
      schema: fastify.autoSchema({
        response: {
          204: { type: 'null', description: 'No Content' },
        },
      }),
    },
    async ({ repos, tenant }, reply) => {
      await repos.disclosures.collection().deleteMany({ tenantId: tenant._id });
      await repos.exchanges.collection().deleteMany({ tenantId: tenant._id });
      await repos.vendorUserIdMappings
        .collection()
        .deleteMany({ tenantId: tenant._id });
      await repos.allocations.collection().deleteMany({ tenantId: tenant._id });
      await repos.offers.collection().deleteMany({ 'issuer.id': tenant.did });
      await repos.tenants.delUsingFilter({ filter: { did: tenant.did } });
      await repos.groups.deleteTenant(tenant.did);

      reply.code(204);
    }
  );

  fastify.post(
    '/offers/clean_pii',
    {
      schema: fastify.autoSchema({
        body: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              properties: {
                vendorUserId: {
                  type: 'string',
                },
                disclosureId: {
                  type: 'string',
                },
                createdBefore: {
                  type: 'string',
                  format: 'date-time',
                },
                finalized: {
                  type: 'boolean',
                  default: false,
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              numCleaned: {
                type: 'number',
              },
            },
            required: ['numCleaned'],
          },
        },
      }),
    },
    async (req) => {
      const { repos, body } = req;
      const filter = buildCleanPiiFilter(body?.filter);
      const numCleaned = await repos.offers.cleanPii(filter);
      return {
        numCleaned,
      };
    }
  );
};

module.exports = tenantController;
