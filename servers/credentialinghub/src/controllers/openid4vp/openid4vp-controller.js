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

const fastifyFormBody = require('@fastify/formbody');
const {
  createAuthorizationRequest,
  postAuthorizationResponse,
} = require('../../entities/openid4vp');
const { oauthErrorResponseSchema } = require('../../schemas');
const {
  presentationSubmissionSchema,
  velocityPresentationSubmissionSchema,
} = require('../vn-api/schemas');

const openid4vpController = async (fastify) => {
  fastify.register(fastifyFormBody);
  fastify
    .addSchema(presentationSubmissionSchema)
    .addSchema(velocityPresentationSubmissionSchema)
    .autoSchemaPreset({ tags: ['OpenID4VP'] });

  fastify
    .post(
      '/r/:tenantId/openid4vp/authorization-request/:requestId',
      {
        errorHandler: (error, request, reply) =>
          fastify.openid4vpErrorHandler(error, request, reply),
        schema: fastify.autoSchema({
          summary: 'Create an OpenID4VP authorization request',
          operationId: 'createOpenid4vpAuthorizationRequest',
          params: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
              requestId: { type: 'string' },
            },
            required: ['tenantId', 'requestId'],
          },
          headers: {
            type: 'object',
            properties: {
              'content-type': {
                type: 'string',
                pattern: '^application/x-www-form-urlencoded(?:\\s*;.*)?$',
              },
              accept: {
                type: 'string',
                pattern: 'application/oauth-authz-req\\+jwt',
              },
            },
            required: ['content-type', 'accept'],
          },
          body: {
            type: 'object',
            properties: {
              wallet_metadata: { type: 'string' },
              wallet_nonce: { type: 'string', minLength: 11 },
            },
            required: ['wallet_metadata', 'wallet_nonce'],
          },
          response: {
            200: {
              description: 'OpenID4VP authorization request JWT',
              content: {
                'application/oauth-authz-req+jwt': {
                  schema: { type: 'string' },
                },
              },
            },
            400: oauthErrorResponseSchema,
            404: oauthErrorResponseSchema,
            500: oauthErrorResponseSchema,
          },
        }),
      },
      async (req, reply) => {
        const authorizationRequestJwt = await createAuthorizationRequest(
          req.params.requestId,
          {
            walletMetadata: req.body.wallet_metadata,
            walletNonce: req.body.wallet_nonce,
          },
          req,
        );

        reply.type('application/oauth-authz-req+jwt');
        return authorizationRequestJwt;
      },
    )
    .post(
      '/r/:tenantId/openid4vp/direct-post',
      {
        errorHandler: (error, request, reply) =>
          fastify.openid4vpErrorHandler(error, request, reply),
        schema: fastify.autoSchema({
          summary: 'Submit an OpenID4VP authorization response',
          operationId: 'submitOpenid4vpAuthorizationResponse',
          params: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
            },
            required: ['tenantId'],
          },
          headers: {
            type: 'object',
            properties: {
              'content-type': {
                type: 'string',
                pattern: '^application/x-www-form-urlencoded(?:\\s*;.*)?$',
              },
            },
            required: ['content-type'],
          },
          body: {
            oneOf: [
              {
                type: 'object',
                properties: {
                  state: {
                    type: 'string',
                    minLength: 1,
                    pattern: '^[0-9a-fA-F]{24}$',
                  },
                  vp_token: {
                    type: 'string',
                    minLength: 1,
                    pattern: '^(?!\\s*\\[\\s*\\]\\s*$).+',
                  },
                  presentation_submission: { type: 'string', minLength: 1 },
                },
                required: ['state', 'vp_token', 'presentation_submission'],
              },
              {
                type: 'object',
                properties: {
                  state: {
                    type: 'string',
                    minLength: 1,
                    pattern: '^[0-9a-fA-F]{24}$',
                  },
                  error: { type: 'string', minLength: 1 },
                  error_description: { type: 'string', minLength: 1 },
                },
                required: ['state', 'error'],
              },
            ],
          },
          response: {
            200: {
              type: 'object',
              additionalProperties: false,
              properties: {},
            },
            400: oauthErrorResponseSchema,
            404: oauthErrorResponseSchema,
            500: oauthErrorResponseSchema,
          },
        }),
      },
      async (req) => {
        await postAuthorizationResponse(req.body, req);
        return {};
      },
    );
};

module.exports = openid4vpController;
