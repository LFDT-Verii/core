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
const { validateIssuerService } = require('../../../entities/issuer-services');
const {
  createServiceConfiguration,
  deleteServiceConfiguration,
  updateServiceConfiguration,
  validateUpdateServiceConfiguration,
} = require('../../../entities/service-configurations');
const {
  issuerConfigurationSchema,
  newIssuerConfigurationSchema,
} = require('./schemas');

const REPO_NAME = 'issuerServices';
const createIssuerServiceConfiguration = createServiceConfiguration(
  REPO_NAME,
  validateIssuerService,
);
const updateIssuerServiceConfiguration = updateServiceConfiguration(
  REPO_NAME,
  validateUpdateServiceConfiguration(validateIssuerService),
);
const deleteIssuerServiceConfiguration = deleteServiceConfiguration(REPO_NAME);

module.exports = async (fastify) => {
  fastify
    .addSchema(issuerConfigurationSchema)
    .addSchema(newIssuerConfigurationSchema)
    .register(tenantLoaderPlugin, { notFoundStatusCode: 400 })
    .autoSchemaPreset({ tags: ['Issuer Services'] })
    .post(
      '/create',
      {
        schema: fastify.autoSchema({
          summary: 'Create an issuer service',
          operationId: 'createIssuerService',
          body: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              service: {
                $ref: 'new-issuer-service',
              },
            },
            required: ['tenantId', 'service'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                service: { $ref: 'issuer-service' },
                requestId: { type: 'string' },
              },
              required: ['service', 'requestId'],
            },
          },
        }),
      },
      async (req) => {
        const service = await createIssuerServiceConfiguration(
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
          summary: 'Get issuer services',
          operationId: 'getIssuerServices',
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
                    $ref: 'issuer-service',
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
        const services = await repos.issuerServices.findServices(
          coerceArray(query.serviceId),
        );
        return { services };
      },
    )
    .post(
      '/update',
      {
        schema: fastify.autoSchema({
          summary: 'Update an issuer service',
          operationId: 'updateIssuerService',
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
                $ref: 'new-issuer-service',
              },
            },
            required: ['tenantId', 'serviceId', 'service'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                service: { $ref: 'issuer-service' },
                requestId: { type: 'string' },
              },
              required: ['service', 'requestId'],
            },
          },
        }),
      },
      async (req) => {
        const service = await updateIssuerServiceConfiguration(
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
          summary: 'Delete an issuer service',
          operationId: 'deleteIssuerService',
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
      async (req) => deleteIssuerServiceConfiguration(req.body.serviceId, req),
    );
};
