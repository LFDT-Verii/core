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
const { tenantLoaderPlugin } = require('../../../entities/tenants');
const { createDepot, deleteDepot } = require('../../../entities/depots');
const { depotSchema, newDepotSchema } = require('./schemas');

const depotsController = async (fastify) => {
  fastify
    .addSchema(newDepotSchema)
    .addSchema(depotSchema)
    .register(tenantLoaderPlugin, { notFoundStatusCode: 400 })
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
              serviceId: {
                type: 'string',
              },
              depot: { $ref: 'new-depot' },
            },
            required: ['tenantId', 'serviceId', 'depot'],
          },
          response: {
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
          query: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              serviceId: {
                type: 'string',
              },
              depotId: {
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
      '/delete',
      {
        schema: fastify.autoSchema({
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
    );
};

module.exports = depotsController;
