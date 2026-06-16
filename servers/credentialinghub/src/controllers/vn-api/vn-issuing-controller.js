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

const bearerAuthPlugin = require('@fastify/bearer-auth');
const { coerceArray } = require('@verii/common-functions');
const {
  verifyVerifiablePresentationJwt,
} = require('@verii/verii-verification');
const newError = require('http-errors');
const {
  holderOfferSchema,
  newOfferRelatedResourceSchema,
} = require('@verii/common-schemas');
const {
  authenticate,
  getCredentialManifest,
  signExchangeResponse,
  exchangeErrorHook,
  credentialOfferRequest,
  issueCredentials,
} = require('../../entities/exchanges');
const {
  generateAccessToken,
  verifyAccessToken,
} = require('../../entities/tokens');
const { ExchangeErrors, ExchangeStates } = require('../../entities/exchanges');
const { tenantLoaderPlugin } = require('../../entities/tenants');
const { kmsPlugin } = require('../../entities/keys');
const {
  presentationSubmissionSchema,
  velocityPresentationSubmissionSchema,
  velocityPresentationSubmissionResponseSchema,
} = require('./schemas');

const vnfIssuingController = async (fastify) => {
  fastify
    .register(tenantLoaderPlugin, { useDID: true })
    .register(kmsPlugin)
    .addSchema(presentationSubmissionSchema)
    .addSchema(velocityPresentationSubmissionSchema)
    .addSchema(velocityPresentationSubmissionResponseSchema)
    .addSchema(newOfferRelatedResourceSchema)
    .addSchema(holderOfferSchema)
    .register(bearerAuthPlugin, {
      auth: verifyAccessTokenAuth,
      addHook: false,
    })
    .get(
      '/r/:tenantId/get-credential-manifest',
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
              credential_types: {
                anyOf: [
                  { type: 'string' },
                  {
                    type: 'array',
                    items: { type: 'string', minLength: 1 },
                  },
                ],
              },
              'push_delegate.push_token': { type: 'string' },
              'push_delegate.push_url': { type: 'string' },
              locale: { type: 'string', default: 'en' },
              format: { type: 'string', enum: ['json', 'jwt'], default: 'jwt' },
            },
            required: ['id'],
          },
          response: {
            200: {
              oneOf: [
                {
                  issuing_request: { type: 'object' },
                },
                {
                  issuing_request: { type: 'string' },
                },
              ],
            },
          },
        }),
      },
      async (req) => {
        const { query } = req;

        const messagingSettings =
          query.push_delegate != null
            ? {
                webhookUrl: query.push_delegate.push_url,
                authToken: query.push_delegate.push_token,
              }
            : undefined;

        const credentialManifest = await getCredentialManifest(
          query.id,
          coerceArray(query.credential_types),
          query.locale,
          messagingSettings,
          req,
        );

        /* eslint-disable camelcase */
        const issuing_request =
          query.format !== 'json'
            ? await signExchangeResponse(credentialManifest, {}, req)
            : credentialManifest;

        return { issuing_request };
        /* eslint-enable */
      },
    )
    .post(
      '/r/:tenantId/authenticate',
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
        const vp = await verifyVerifiablePresentationJwt(req.body.jwt_vp, {
          vnfProtocolVersion: 2,
        });
        req.validateInput(vp, {
          $ref: 'https://velocitycareerlabs.io/velocity-presentation-submission.schema.json#',
        });

        const [issuerService, exchange] = await authenticate(
          req.body.exchange_id,
          vp,
          req,
        );

        const token = await generateAccessToken(issuerService, exchange, req);

        return {
          token,
          exchange: {
            id: exchange._id,
            type: exchange.type,
            disclosureComplete: true,
            exchangeComplete: false,
          },
        };
      },
    )
    .post(
      '/r/:tenantId/credential-offers',
      {
        schema: fastify.autoSchema({
          body: {
            type: 'object',
            properties: {
              offerHashes: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                offers: {
                  type: 'array',
                  items: {
                    $ref: 'https://velocitycareerlabs.io/holder-offer.schema.json#',
                  },
                },
                challenge: {
                  type: 'string',
                },
              },
              required: ['offers'],
            },
            502: {
              $ref: 'error#',
            },
          },
        }),
        preHandler: (...args) => fastify.verifyBearerAuth(...args),
        onError: async (req, reply, err) =>
          exchangeErrorHook(req.body.exchange_id, err, req),
      },
      async (req) =>
        credentialOfferRequest(req.token, req.body.offerHashes, req),
    )
    .post(
      '/r/:tenantId/issue-credentials',
      {
        schema: fastify.autoSchema({
          body: {
            type: 'object',
            properties: {
              approvedOfferIds: {
                type: 'array',
                items: { type: 'string' },
              },
              rejectedOfferIds: {
                type: 'array',
                items: { type: 'string' },
              },
              proof: {
                type: 'object',
                properties: {
                  proof_type: { type: 'string', enum: ['jwt'] },
                  jwt: { type: 'string' },
                },
                required: ['proof_type', 'jwt'],
              },
            },
          },
          response: {
            200: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
        }),
        preHandler: (...args) => fastify.verifyBearerAuth(...args),
        onError: async (req, reply, err) =>
          exchangeErrorHook(req.body.exchange_id, err, req),
      },
      async (req) =>
        issueCredentials(
          req.token,
          req.body.approvedOfferIds,
          req.body.rejectedOfferIds,
          req.body.proof,
          req,
        ),
    );
};

const verifyAccessTokenAuth = async (bearerToken, req) => {
  try {
    const verifiedJwt = await verifyAccessToken(bearerToken, req);

    // eslint-disable-next-line better-mutation/no-mutation
    req.token = verifiedJwt.payload;
    return true;
  } catch (error) {
    req.log.error(error);
    throw newError(401, ExchangeErrors.UNAUTHORIZED, {
      exchangeErrorState: ExchangeStates.UNAUTHORIZED,
      errorCode: ExchangeErrors.UNAUTHORIZED,
    });
  }
};

module.exports = vnfIssuingController;
