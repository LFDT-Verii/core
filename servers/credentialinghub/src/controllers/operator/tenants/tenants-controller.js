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
  updateTenantSigningPolicy,
} = require('../../../entities/tenants');
const {
  CredentialSigningAlgorithms,
} = require('../../../entities/tenants/domain');
const {
  jwkSchema,
  newTenantSchema,
  tenantSchema,
  newKeyMetadataSchema,
  keyMetadataSchema,
  secretKeySchema,
  newKeySchema,
} = require('./schemas');

const OBJECT_ID_PATTERN = '^[0-9a-fA-F]{24}$';

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
      '/update-signing-policy',
      {
        schema: fastify.autoSchema({
          summary: "Update a tenant's credential signing policy",
          operationId: 'updateTenantSigningPolicy',
          body: {
            type: 'object',
            additionalProperties: false,
            properties: {
              credentialSigningAlgorithm: {
                type: ['string', 'null'],
                enum: [...CredentialSigningAlgorithms, null],
              },
              expectedUpdatedAt: {
                type: 'string',
                format: 'date-time',
              },
              tenantId: {
                type: 'string',
                pattern: OBJECT_ID_PATTERN,
              },
            },
            required: [
              'credentialSigningAlgorithm',
              'expectedUpdatedAt',
              'tenantId',
            ],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                tenant: {
                  $ref: 'tenant#',
                },
                requestId: {
                  type: 'string',
                },
              },
            },
            404: {
              $ref: 'error#',
            },
            409: {
              $ref: 'error#',
            },
          },
        }),
      },
      async (req) => ({
        tenant: await updateTenantSigningPolicy(
          req.body.tenantId,
          req.body.credentialSigningAlgorithm,
          req.body.expectedUpdatedAt,
          req,
        ),
      }),
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
