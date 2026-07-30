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
const { coerceArray } = require('@verii/common-functions');
const {
  createTenant,
  deleteTenant,
  findTenants,
} = require('../../../entities/tenants');
const {
  jwkSchema,
  newTenantSchema,
  tenantSchema,
  newKeyMetadataSchema,
  keyMetadataSchema,
  secretKeySchema,
  newKeySchema,
} = require('./schemas');

module.exports = async (fastify) => {
  fastify
    .addSchema(jwkSchema)
    .addSchema(newTenantSchema)
    .addSchema(tenantSchema)
    .addSchema(newKeyMetadataSchema)
    .addSchema(keyMetadataSchema)
    .addSchema(secretKeySchema)
    .addSchema(newKeySchema)
    .autoSchemaPreset({ tags: ['Tenants'] })
    .post(
      '/create',
      {
        schema: fastify.autoSchema({
          summary: 'Create a tenant',
          operationId: 'createTenant',
          body: {
            type: 'object',
            properties: {
              tenant: {
                $ref: 'new-tenant#',
              },
              keys: {
                type: 'array',
                minItems: 1,
                items: {
                  $ref: 'new-key#',
                },
              },
            },
            required: ['tenant', 'keys'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                tenant: {
                  $ref: 'tenant#',
                },
                keyMetadatas: {
                  type: 'array',
                  items: {
                    $ref: 'key-metadata#',
                  },
                },
                requestId: {
                  type: 'string',
                },
              },
            },
          },
        }),
      },
      async (req) => {
        const { tenant, keyMetadatas } = await createTenant(
          req.body.tenant,
          req.body.keys,
          req,
        );
        return { tenant, keyMetadatas };
      },
    )
    .get(
      '/get',
      {
        schema: fastify.autoSchema({
          summary: 'Get tenants',
          operationId: 'getTenants',
          query: {
            type: 'object',
            properties: {
              tenantId: {
                anyOf: [
                  { type: 'string' },
                  {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                  },
                ],
              },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                tenants: {
                  type: 'array',
                  items: {
                    $ref: 'tenant#',
                  },
                },
                requestId: {
                  type: 'string',
                },
              },
            },
          },
        }),
      },
      async (req) => {
        const tenants = await findTenants(
          coerceArray(req.query?.tenantId),
          req,
        );
        return { tenants };
      },
    )
    .post(
      '/delete',
      {
        schema: fastify.autoSchema({
          summary: 'Delete a tenant',
          operationId: 'deleteTenant',
          body: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
            },
            required: ['tenantId'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                requestId: {
                  type: 'string',
                },
              },
            },
          },
        }),
      },
      async (req) => deleteTenant(req.body.tenantId, req),
    );
};
