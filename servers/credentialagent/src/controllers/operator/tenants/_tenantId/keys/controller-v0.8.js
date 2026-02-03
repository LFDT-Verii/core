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

const { isEmpty, some, map } = require('lodash/fp');
const newError = require('http-errors');
const { KeyEncodings, KeyPurposes } = require('@verii/crypto');
const { resolveDid } = require('@verii/common-fetchers');

const {
  addPrimaryAddressToTenant,
  validateDidDocKeys,
} = require('../../../../../entities');

const buildDuplicateKeyErrorString = (key, existingKey) => {
  if (key.kidFragment === existingKey.kidFragment) {
    return `Key with kidFragment ${key.kidFragment} already exists`;
  }
  return `Key with a purpose from ${JSON.stringify(
    key.purposes,
  )} already exists`;
};

const keysController = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
        response: {
          200: {
            type: 'array',
            items: {
              $ref: 'https://velocitycareerlabs.io/tenant-key-v0.8.schema.json#',
            },
          },
        },
      }),
    },
    async (req) => {
      const { repos, tenant } = req;
      const keys = await repos.keys.find(
        { filter: { tenantId: tenant._id }, sort: { _id: 1 } },
        {
          _id: 1,
          purposes: 1,
          algorithm: 1,
          encoding: 1,
          kidFragment: 1,
          createdAt: 1,
        },
      );
      return map(
        (key) => ({
          ...key,
          encoding: KeyEncodings.HEX,
        }),
        keys,
      );
    },
  );

  fastify.post(
    '/',
    {
      schema: fastify.autoSchema({
        body: {
          $ref: 'https://velocitycareerlabs.io/secret-tenant-key-v0.8.schema.json#',
        },
        response: {
          201: {
            $ref: 'https://velocitycareerlabs.io/tenant-key-v0.8.schema.json#',
          },
          409: { $ref: 'error#' },
        },
      }),
    },
    async (req, reply) => {
      const { body, repos, tenant, kms } = req;

      const preexistingTenantKey = await repos.keys.findOne({
        filter: {
          tenantId: tenant._id,
          $or: [
            {
              purposes: { $elemMatch: { $in: body.purposes } },
            },
            {
              kidFragment: body.kidFragment,
            },
          ],
        },
      });

      if (!isEmpty(preexistingTenantKey)) {
        throw newError(
          409,
          buildDuplicateKeyErrorString(body, preexistingTenantKey),
        );
      }

      const organizationDidDoc = await resolveDid(tenant.did, req);
      const [validatedKey] = await validateDidDocKeys(organizationDidDoc, [
        body,
      ]);

      const key = await kms.importKey({
        ...validatedKey,
        encoding: KeyEncodings.JWK,
        tenantId: tenant._id,
      });

      if (
        !tenant.primaryAddress &&
        some((p) => p === KeyPurposes.DLT_TRANSACTIONS, key.purposes)
      ) {
        await addPrimaryAddressToTenant(tenant, req);
      }

      reply.code(201);
      return { ...key, encoding: KeyEncodings.HEX };
    },
  );

  fastify.delete(
    '/:kidFragment',
    {
      schema: fastify.autoSchema({
        params: {
          type: 'object',
          properties: {
            ...fastify.currentAutoSchemaPreset.params.properties,
            kidFragment: { type: 'string', minLength: 1 },
          },
        },
        response: { 204: { type: 'null', description: 'No Content' } },
      }),
    },
    async ({ params, repos, tenant }, reply) => {
      const { kidFragment } = params;
      const result = await repos.keys.delUsingFilter({
        filter: { kidFragment, tenantId: tenant._id },
      });

      if (isEmpty(result)) {
        const kid = `${tenant.did}${kidFragment}`;
        throw newError.NotFound(`kid: ${kid} not found on tenant`);
      }

      reply.code(204);
      return null;
    },
  );
};

module.exports = keysController;
