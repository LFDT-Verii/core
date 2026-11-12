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
  depotConflictErrorSchema,
  depotSchema,
  findDepotsRequestSchema,
  newDepotSchema,
} = require('@verii/credentialing-hub-operator-api');
const { tenantLoaderPlugin } = require('../../../entities/tenants');
const {
  createDepot,
  deleteDepot,
  findDepotsByAuthValues,
  resolveDeferredCredentials,
  ResolveDeferredCredentialsStatuses,
} = require('../../../entities/depots');

// findDepots turns serviceId and depotId into ObjectIds
const OBJECT_ID_PATTERN = '^[0-9a-fA-F]{24}$';

const depotsController = async (fastify) => {
  fastify
    .addSchema(newDepotSchema)
    .addSchema(depotSchema)
    .addSchema(depotConflictErrorSchema)
    .addSchema(findDepotsRequestSchema)
    .register(tenantLoaderPlugin, { notFoundStatusCode: 400 })
    .autoSchemaPreset({ tags: ['Depots'] })
    .post(
      '/create',
      {
        schema: fastify.autoSchema({
          summary: 'Create a depot',
          operationId: 'createDepot',
          body: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              serviceId: {
                type: 'string',
              },
              depot: { $ref: 'new-depot' },
            },
            required: ['tenantId', 'serviceId', 'depot'],
          },
          response: {
            409: { $ref: 'depot-conflict-error#' },
            200: {
              type: 'object',
              properties: {
                depot: {
                  $ref: 'depot#',
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
        const { depot: newDepot, serviceId } = req.body;
        const depot = await createDepot(newDepot, serviceId, req);
        return { depot };
      },
    )
    .get(
      '/get',
      {
        schema: fastify.autoSchema({
          summary: 'Get depots',
          operationId: 'getDepots',
          query: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              serviceId: {
                type: 'string',
                pattern: OBJECT_ID_PATTERN,
              },
              depotId: {
                anyOf: [
                  { type: 'string', pattern: OBJECT_ID_PATTERN },
                  {
                    type: 'array',
                    items: {
                      type: 'string',
                      pattern: OBJECT_ID_PATTERN,
                    },
                  },
                ],
              },
            },
            required: ['tenantId'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                depots: {
                  type: 'array',
                  items: {
                    $ref: 'depot',
                  },
                },
                requestId: { type: 'string' },
              },
              required: ['depots', 'requestId'],
            },
          },
        }),
      },
      async (req) => {
        const { serviceId, depotId: depotIds } = req.query;
        const depots = await req.repos.depots.findDepots(
          serviceId,
          coerceArray(depotIds),
        );
        return { depots };
      },
    )
    .post(
      '/get',
      {
        // The body can carry holders' auth values, such as their emails
        config: { sensitiveLogging: true },
        schema: fastify.autoSchema({
          summary: 'Find depots',
          operationId: 'findDepots',
          body: { $ref: 'find-depots-request#' },
          // The same response as GET depots/get
          response: {
            200: {
              type: 'object',
              properties: {
                depots: {
                  type: 'array',
                  items: {
                    $ref: 'depot',
                  },
                },
                requestId: { type: 'string' },
              },
              required: ['depots', 'requestId'],
            },
            ...fastify.NotFoundResponse,
          },
        }),
      },
      async (req) => {
        const { serviceId, depotId, authValues } = req.body;
        const depotIds = coerceArray(depotId);
        const depots =
          authValues == null
            ? await req.repos.depots.findDepots(serviceId, depotIds)
            : await findDepotsByAuthValues(
                { serviceId, depotIds, authValues },
                req,
              );
        return { depots };
      },
    )
    .post(
      '/delete',
      {
        schema: fastify.autoSchema({
          summary: 'Delete a depot',
          operationId: 'deleteDepot',
          body: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              serviceId: {
                type: 'string',
                minLength: 1,
              },
              depotId: {
                type: 'string',
                minLength: 1,
              },
            },
            required: ['tenantId', 'serviceId', 'depotId'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                requestId: { type: 'string' },
              },
              required: ['requestId'],
            },
          },
        }),
      },
      async (req) => deleteDepot(req.body.depotId, req.body.serviceId, req),
    )
    .post(
      '/resolve-deferred-credentials',
      {
        schema: fastify.autoSchema({
          summary: "Resolve a depot's deferred credentials",
          operationId: 'resolveDeferredCredentials',
          body: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              depotId: {
                type: 'string',
                minLength: 1,
              },
            },
            required: ['tenantId', 'depotId'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                depot: {
                  $ref: 'depot#',
                },
                notification: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: Object.values(ResolveDeferredCredentialsStatuses),
                    },
                    exchangeId: {
                      type: 'string',
                    },
                    error: {
                      type: 'string',
                    },
                  },
                  required: ['status'],
                },
                requestId: { type: 'string' },
              },
              required: ['depot', 'notification', 'requestId'],
            },
            ...fastify.NotFoundResponse,
          },
        }),
      },
      async (req) => resolveDeferredCredentials(req.body.depotId, req),
    );
};

module.exports = depotsController;
