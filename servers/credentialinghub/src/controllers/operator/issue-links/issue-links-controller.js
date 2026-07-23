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
const { refreshIssueLinks } = require('../../../entities/links');
const { tenantLoaderPlugin } = require('../../../entities/tenants');

const issueLinksController = async (fastify) => {
  fastify
    .register(tenantLoaderPlugin, { notFoundStatusCode: 400 })
    .autoSchemaPreset({ tags: ['Issue Links'] })
    .post(
      '/refresh',
      {
        schema: fastify.autoSchema({
          summary: 'Refresh issue links',
          operationId: 'refreshIssueLinks',
          body: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              serviceId: {
                type: 'string',
              },
              depotId: {
                type: 'string',
              },
            },
            required: ['tenantId', 'serviceId'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                redirectUrl: {
                  type: 'string',
                  format: 'uri',
                },
                vnProtocolLink: {
                  type: 'string',
                  format: 'uri',
                },
                openidCredentialOffer: {
                  type: 'string',
                  format: 'uri',
                },
                preauthCode: {
                  type: 'string',
                  format: 'uri',
                },
                requestId: {
                  type: 'string',
                  format: 'uri',
                },
              },
              required: ['redirectUrl', 'vnProtocolLink', 'requestId'],
            },
          },
        }),
      },
      async (req) =>
        refreshIssueLinks(req.body.serviceId, req.body.depotId, req),
    );
};

module.exports = issueLinksController;
