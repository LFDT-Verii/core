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

const {
  newOfferRelatedResourceSchema,
  w3cVcSchema,
} = require('@verii/common-schemas');
const { validationPlugin } = require('@verii/validation');
const { tenantLoaderPlugin } = require('../../../entities/tenants');
const { createCredentials } = require('../../../entities/credentials');
const { newCredentialSchema, credentialSchema } = require('./schemas');

const credentialsController = async (fastify) => {
  fastify
    .addSchema(newOfferRelatedResourceSchema)
    .addSchema(w3cVcSchema)
    .addSchema(newCredentialSchema)
    .addSchema(credentialSchema)
    .register(tenantLoaderPlugin, { notFoundStatusCode: 400 })
    .register(validationPlugin, {
      ajv: { useDefaults: true, strictTypes: false },
      decorateRequest: ['addDocSchema', 'getDocValidator'],
    })
    .post(
      '/create',
      {
        schema: fastify.autoSchema({
          body: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              depotId: { type: 'string' },
              credential: {
                $ref: 'new-credential',
              },
            },
            required: ['tenantId', 'depotId', 'credential'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                credential: {
                  $ref: 'Credential',
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
        const { body } = req;
        const [credential] = await createCredentials([body], req);
        return { credential };
      },
    )
    .post(
      '/create-many',
      {
        schema: fastify.autoSchema({
          body: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    depotId: { type: 'string' },
                    credential: {
                      $ref: 'new-credential',
                    },
                  },
                  required: ['depotId', 'credential'],
                },
                minItems: 1,
              },
            },
            required: ['tenantId', 'items'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                credentials: {
                  type: 'array',
                  items: {
                    $ref: 'Credential',
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
        const { body } = req;
        const credentials = await createCredentials(body.items, req);
        return { credentials };
      },
    )
    .get(
      '/get',
      {
        schema: fastify.autoSchema({
          query: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              credentialId: {
                type: 'string',
              },
            },
            required: ['tenantId'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                credentials: {
                  type: 'array',
                  items: {
                    $ref: 'Credential',
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
        const {
          query: { credentialId },
          repos,
        } = req;
        const credentials = await repos.credentials.search({
          credentialIds: credentialId ? [credentialId] : [],
        });

        return { credentials };
      },
    )
    .post(
      '/delete',
      {
        schema: fastify.autoSchema({
          body: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              credentialIds: {
                type: 'array',
                items: {
                  type: 'string',
                },
                minItems: 1,
              },
            },
            required: ['tenantId', 'credentialIds'],
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
      async (req) =>
        req.repos.credentials.delUsingFilter({
          filter: { _id: { $in: req.body.credentialIds } },
        }),
    );
};

module.exports = credentialsController;
