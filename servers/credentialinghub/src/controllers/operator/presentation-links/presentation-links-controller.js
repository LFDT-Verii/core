/*
 * Copyright 2026 Velocity Team
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

const { refreshPresentationLinks } = require('../../../entities/links');
const { tenantLoaderPlugin } = require('../../../entities/tenants');

const presentationLinksController = async (fastify) => {
  fastify.register(tenantLoaderPlugin, { notFoundStatusCode: 400 }).post(
    '/refresh',
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
              openid4vpProtocolLink: {
                type: 'string',
                format: 'uri',
              },
              requestId: {
                type: 'string',
              },
            },
            required: [
              'redirectUrl',
              'vnProtocolLink',
              'openid4vpProtocolLink',
              'requestId',
            ],
          },
        },
      }),
    },
    async (req) =>
      refreshPresentationLinks(req.body.serviceId, req.body.depotId, req),
  );
};

module.exports = presentationLinksController;
