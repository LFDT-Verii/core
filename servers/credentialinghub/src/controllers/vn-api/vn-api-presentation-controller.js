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
const { tenantLoaderPlugin } = require('../../entities/tenants');
const { kmsPlugin } = require('../../entities/keys');
const {
  ExchangeTypes,
  getPresentationRequest,
  postPresentation,
  signExchangeResponse,
  exchangeErrorHook,
} = require('../../entities/exchanges');
const { generateAccessToken } = require('../../entities/tokens');
const {
  presentationSubmissionSchema,
  velocityPresentationSubmissionSchema,
  velocityPresentationSubmissionResponseSchema,
} = require('./schemas');

const vnApiPresentationController = async (fastify) => {
  fastify
    .register(tenantLoaderPlugin, { useDID: true })
    .register(kmsPlugin)
    .addSchema(presentationSubmissionSchema)
    .addSchema(velocityPresentationSubmissionSchema)
    .addSchema(velocityPresentationSubmissionResponseSchema)
    .get(
      '/r/:tenantId/get-presentation-request',
      {
        schema: fastify.autoSchema({
          params: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
            },
          },
          query: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              vendorOriginContext: { type: 'string' },
              'push_delegate.push_token': { type: 'string' },
              'push_delegate.push_url': { type: 'string' },
              format: { type: 'string', enum: ['json', 'jwt'], default: 'jwt' },
            },
            required: ['id'],
          },
          response: {
            200: {
              oneOf: [
                {
                  presentation_request: { type: 'object' },
                },
                {
                  presentation_request: { type: 'string' },
                },
              ],
            },
          },
        }),
      },
      // eslint-disable-next-line complexity
      async (req) => {
        const { query } = req;

        const messagingSettings =
          query.push_delegate?.push_url != null ||
          query.push_delegate?.push_token != null
            ? {
                webhookUrl: query.push_delegate?.push_url,
                authToken: query.push_delegate?.push_token,
              }
            : undefined;

        const presentationRequest = await getPresentationRequest(
          query.id,
          query.locale,
          messagingSettings,
          query.vendorOriginContext,
          req,
        );

        /* eslint-disable camelcase */
        const presentation_request =
          query.format !== 'json'
            ? await signExchangeResponse(presentationRequest, {}, req)
            : presentationRequest;

        return { presentation_request };
        /* eslint-enable */
      },
    )
    .post(
      '/r/:tenantId/presentation',
      {
        schema: fastify.autoSchema({
          body: {
            type: 'object',
            properties: {
              exchange_id: { type: 'string', description: 'exchange id value' },
              jwt_vp: {
                type: 'string',
                description: 'vp encoded as a jwt signed by the holder',
              },
            },
            required: ['exchange_id', 'jwt_vp'],
          },
          response: {
            200: {
              $ref: 'https://velocitycareerlabs.io/velocity-presentation-submission-response.schema.json#',
            },
            ...fastify.UnauthorizedResponse,
          },
        }),
        onError: async (req, reply, err) =>
          exchangeErrorHook(req.body.exchange_id, err, req),
      },
      async (req) => {
        const [relyingPartyService, exchange] = await postPresentation(
          req.body.exchange_id,
          req.body.jwt_vp,
          req,
        );

        const token = await generateAccessToken(
          relyingPartyService,
          exchange,
          req,
        );

        return {
          token,
          exchange: {
            id: exchange._id,
            type:
              exchange.type === ExchangeTypes.ISSUER ? 'ISSUING' : 'DISCLOSURE',
            disclosureComplete: true,
            exchangeComplete: true,
          },
        };
      },
    );
};

module.exports = vnApiPresentationController;
