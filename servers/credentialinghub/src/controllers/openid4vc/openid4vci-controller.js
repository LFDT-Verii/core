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

const { Oauth2ErrorCodes } = require('@openid4vc/oauth2');
const {
  createCredential,
  handleNotification,
  Oidc4vciErrors,
} = require('../../entities/openid4vci');
const { oauthErrorResponseSchema } = require('../../schemas');

const openid4vciController = async (fastify) => {
  fastify
    .post(
      '/r/:tenantId/openid4vc/nonce',
      {
        schema: fastify.autoSchema({
          params: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
            },
          },
        }),
      },
      async (req, reply) => {
        reply.header('Cache-Control', 'no-store');
        const openid4vcIssuer = await req.getOpenId4VciIssuer();
        return openid4vcIssuer.createNonce();
      },
    )
    .post(
      '/r/:tenantId/openid4vc/credential',
      {
        errorHandler: (e, request, reply) => {
          const error = fastify.openid4vcErrorHandler(e, request, reply);
          if (error.error === Oauth2ErrorCodes.InvalidRequest) {
            // eslint-disable-next-line better-mutation/no-mutation
            error.error = Oauth2ErrorCodes.InvalidCredentialRequest;
          }
          return error;
        },
        preHandler: (req, reply) => fastify.openid4vcBearerAuth(req, reply),
        schema: fastify.autoSchema({
          params: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
            },
          },
          response: {
            400: oauthErrorResponseSchema,
            401: oauthErrorResponseSchema,
            500: oauthErrorResponseSchema,
          },
        }),
      },
      async (req) => createCredential(req.body, req),
    )
    .post(
      '/r/:tenantId/openid4vc/notification',
      {
        errorHandler: (e, request, reply) => {
          const error = fastify.openid4vcErrorHandler(e, request, reply);
          if (error.error === Oauth2ErrorCodes.InvalidRequest) {
            // eslint-disable-next-line better-mutation/no-mutation
            error.error = Oidc4vciErrors.INVALID_NOTIFICATION_REQUEST;
          }
          return error;
        },
        preHandler: (req, reply) => fastify.openid4vcBearerAuth(req, reply),
        schema: fastify.autoSchema({
          params: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
            },
          },
          body: {
            type: 'object',
            properties: {
              notification_id: { type: 'string' },
              event: {
                type: 'string',
                enum: [
                  'credential_accepted',
                  'credential_deleted',
                  'credential_failure',
                ],
              },
              event_description: { type: 'string' },
            },
            required: ['notification_id', 'event'],
          },

          response: {
            400: oauthErrorResponseSchema,
            401: oauthErrorResponseSchema,
            500: oauthErrorResponseSchema,
          },
        }),
      },
      async (req, reply) => {
        await handleNotification(req.body, req);
        reply.status(204);
        return {};
      },
    );
};

module.exports = openid4vciController;
