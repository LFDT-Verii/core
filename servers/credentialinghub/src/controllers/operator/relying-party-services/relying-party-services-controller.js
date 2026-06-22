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
const {
  createServiceConfiguration,
  updateServiceConfiguration,
  deleteServiceConfiguration,
  validateServiceConfiguration,
  validateUpdateServiceConfiguration,
} = require('../../../entities/service-configurations');
const {
  relyingPartyConfigurationSchema,
  newRelyingPartyConfigurationSchema,
} = require('./schemas');

const REPO_NAME = 'relyingPartyServices';
const createRelyingPartyServiceConfiguration = createServiceConfiguration(
  REPO_NAME,
  validateServiceConfiguration,
);
const updateRelyingPartyServiceConfiguration = updateServiceConfiguration(
  REPO_NAME,
  validateUpdateServiceConfiguration(validateServiceConfiguration),
);
const deleteRelyingPartyServiceConfiguration =
  deleteServiceConfiguration(REPO_NAME);

module.exports = async (fastify) => {
  fastify
    .addSchema(relyingPartyConfigurationSchema)
    .addSchema(newRelyingPartyConfigurationSchema)
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
              service: {
                $ref: 'new-relying-party-service',
              },
            },
            required: ['tenantId', 'service'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                service: { $ref: 'relying-party-service' },
                requestId: { type: 'string' },
              },
              required: ['service', 'requestId'],
            },
          },
        }),
      },
      async (req) => {
        const service = await createRelyingPartyServiceConfiguration(
          req.body.service,
          req,
        );
        return { service };
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
                services: {
                  type: 'array',
                  items: {
                    $ref: 'relying-party-service',
                  },
                },
                requestId: { type: 'string' },
              },
              required: ['services', 'requestId'],
            },
          },
        }),
      },
      async (req) => {
        const { query, repos } = req;
        const services = await repos.relyingPartyServices.findServices(
          coerceArray(query.serviceId),
        );
        return { services };
      },
    )
    .post(
      '/update',
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
              service: {
                $ref: 'new-relying-party-service',
              },
            },
            required: ['tenantId', 'serviceId', 'service'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                service: { $ref: 'relying-party-service' },
                requestId: { type: 'string' },
              },
              required: ['service', 'requestId'],
            },
          },
        }),
      },
      async (req) => {
        const service = await updateRelyingPartyServiceConfiguration(
          req.body.serviceId,
          req.body.service,
          req,
        );
        return { service };
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
              },
            },
            required: ['tenantId', 'serviceId'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                requestId: { type: 'string' },
              },
            },
          },
        }),
      },
      async (req) =>
        deleteRelyingPartyServiceConfiguration(req.body.serviceId, req),
    );
};
