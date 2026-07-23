/*
 * Copyright 2025 Velocity Team
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

const fastifyFormBody = require('@fastify/formbody');
const { createAccessToken } = require('../../entities/openid4vci');
const { oauthErrorResponseSchema } = require('../../schemas');

const oauthController = async (fastify) => {
  fastify
    .register(fastifyFormBody)
    .autoSchemaPreset({
      tags: ['OpenID4VCI'],
    })
    .post(
      '/r/:tenantId/oauth/token',
      {
        preValidation: async (req) => {
          if (req.body.authorization_details == null) {
            return;
          }
          try {
            // eslint-disable-next-line better-mutation/no-mutation
            req.body.authorization_details = JSON.parse(
              req.body.authorization_details,
            );
          } catch (e) {
            req.log.warn('failed to parse req.body.authorization_details', e);
          }
        },
        errorHandler: (error, request, reply) =>
          fastify.openid4vcErrorHandler(error, request, reply),
        schema: fastify.autoSchema({
          summary: 'Create an OpenID4VCI access token',
          operationId: 'createOpenid4vciAccessToken',
          params: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
            },
          },
          headers: {
            type: 'object',
            properties: {
              'content-type': {
                type: 'string',
                const: 'application/x-www-form-urlencoded',
              },
            },
            required: ['content-type'],
          },
          body: {
            type: 'object',
            properties: {
              grant_type: {
                type: 'string',
              },
              'pre-authorized_code': {
                type: 'string',
              },
              authorization_details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      const: 'openid_credential',
                    },
                    credential_configuration_id: {
                      type: 'string',
                    },
                  },
                  required: ['type', 'credential_configuration_id'],
                },
              },
            },
            required: ['grant_type', 'pre-authorized_code'],
          },
          response: {
            400: oauthErrorResponseSchema,
            500: oauthErrorResponseSchema,
          },
        }),
      },
      async (req) => createAccessToken(req.body, req),
    );
};

module.exports = oauthController;
