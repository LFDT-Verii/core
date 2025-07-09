/**
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
 */

const { isEmpty, map, uniq, reduce } = require('lodash/fp');
const newError = require('http-errors');

const {
  hasDuplicatePurposes,
  KeyErrorMessages,
  buildServiceIds,
  refreshTenantDids,
  validateGroupByUser,
} = require('../../../entities');

const { createTenant } = require('../../../entities/tenants');

const areKidFragmentsUnique = (keys) => {
  const kidFragments = reduce(
    (arr, key) => {
      return [...arr, key.kidFragment];
    },
    [],
    keys
  );
  return uniq(kidFragments).length === kidFragments.length;
};

const validateAllPurposes = (keys) => {
  const allPurposes = reduce(
    (arr, key) => {
      return [...arr, ...key.purposes];
    },
    [],
    keys
  );
  if (hasDuplicatePurposes(allPurposes)) {
    throw newError(400, KeyErrorMessages.DUPLICATE_PURPOSE_DETECTED);
  }
};

const validateUniqueKidFragments = (keys) => {
  if (!areKidFragmentsUnique(keys)) {
    throw newError(400, 'Duplicate kid fragments purposes detected');
  }
};

const tenantController = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: fastify.autoSchema({
        body: {
          $ref: 'https://velocitycareerlabs.io/secret-new-tenant-v0.8.schema.json#',
        },
        response: {
          201: {
            $ref: 'https://velocitycareerlabs.io/new-tenant.response.200.schema.json#',
          },
          404: { $ref: 'error#' },
        },
      }),
    },
    async (req, reply) => {
      const { did, serviceIds, webhookUrl, keys, webhookAuth } = req.body;

      await validateGroupByUser(req);
      validateAllPurposes(keys);
      validateUniqueKidFragments(keys);

      const insertedTenant = await createTenant(
        {
          did,
          serviceIds,
          webhookUrl,
          keys,
          webhookAuth,
        },
        req
      );

      const { createdAt, _id } = insertedTenant;
      reply.code(201);
      return { createdAt, id: _id };
    }
  );

  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
        response: {
          200: {
            type: 'array',
            items: {
              $ref: 'https://velocitycareerlabs.io/tenant-v0.8.schema.json',
            },
          },
        },
      }),
    },
    async (req) => {
      const filter = await buildFilterByGroup(req);
      const tenants = await req.repos.tenants.find({ filter });
      return map(
        (tenant) => ({ ...tenant, serviceIds: buildServiceIds(tenant) }),
        tenants
      );
    }
  );

  fastify.post(
    '/refresh',
    {
      schema: fastify.autoSchema({
        body: {
          oneOf: [
            {
              type: 'object',
              properties: {
                all: { type: 'boolean', enum: [true] },
              },
              required: ['all'],
            },
            {
              type: 'object',
              properties: {
                did: { type: 'string' },
              },
              required: ['did'],
            },
          ],
        },
        response: {
          204: { type: 'null' },
        },
      }),
    },
    async (req) => {
      await refreshTenantDids(req.body, req);
      return {};
    }
  );
};

const buildFilterByGroup = async (context) => {
  const { repos, user } = context;
  if (isEmpty(user.groupId)) {
    return {};
  }
  const group = await repos.groups.findById(user.groupId);
  return { did: { $in: group.dids } };
};

module.exports = tenantController;
