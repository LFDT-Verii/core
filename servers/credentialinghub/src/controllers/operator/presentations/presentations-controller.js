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
const newError = require('http-errors');
const { newOfferRelatedResourceSchema } = require('@verii/common-schemas');
const { tenantLoaderPlugin } = require('../../../entities/tenants');
const {
  verifyPresentation,
  verifyStoredPresentation,
} = require('../../../entities/presentations');
const { WalletMessageStatuses } = require('../../../entities/wallet-messages');
const {
  basePresentationSchema,
  credentialVerificationSchema,
  disclosedW3cVcSchema,
  presentationVerificationSchema,
  presentationSchema,
  w3cPresentationSchema,
} = require('./schemas');

module.exports = async (fastify) => {
  fastify
    .addSchema(newOfferRelatedResourceSchema)
    .addSchema(disclosedW3cVcSchema)
    .addSchema(credentialVerificationSchema)
    .addSchema(presentationSchema)
    .addSchema(presentationVerificationSchema)
    .addSchema(w3cPresentationSchema)
    .register(tenantLoaderPlugin, { notFoundStatusCode: 400 })
    .autoSchemaPreset({ tags: ['Presentations'] })
    .get(
      '/get',
      {
        schema: fastify.autoSchema({
          summary: 'Get presentations',
          operationId: 'getPresentations',
          query: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              depotId: {
                type: 'string',
              },
              exchangeId: {
                type: 'string',
              },
              presentationId: {
                type: 'string',
              },
            },
            required: ['tenantId'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                presentations: {
                  type: 'array',
                  items: { $ref: 'presentation#' },
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
        const {
          query: { presentationId, depotId, exchangeId },
          repos,
        } = req;
        const presentations = await repos.presentations.search({
          presentationIds: presentationId ? [presentationId] : [],
          depotId,
          exchangeId,
        });

        return { presentations };
      },
    )
    .post(
      '/verify',
      {
        schema: fastify.autoSchema({
          summary: 'Verify a presentation',
          operationId: 'verifyPresentation',
          body: {
            type: 'object',
            anyOf: [
              {
                type: 'object',
                properties: {
                  tenantId: {
                    type: 'string',
                  },
                  presentationId: {
                    type: 'string',
                  },
                  notifyHolder: {
                    type: 'boolean',
                    default: false,
                    description:
                      "sends PresentationVerified to the holder's wallet after verifying",
                  },
                },
                required: ['tenantId', 'presentationId'],
              },
              {
                type: 'object',
                properties: {
                  tenantId: {
                    type: 'string',
                  },
                  format: {
                    type: 'string',
                    enum: ['JWT_VP'],
                  },
                  presentation: {
                    type: 'string',
                  },
                },
                required: ['tenantId', 'format', 'presentation'],
              },
            ],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                ...basePresentationSchema.properties,
                verification: {
                  $ref: 'presentation-verification#',
                },
                notification: {
                  type: 'object',
                  description: 'present when notifyHolder is true',
                  properties: {
                    status: {
                      type: 'string',
                      enum: Object.values(WalletMessageStatuses),
                    },
                    error: {
                      type: 'string',
                    },
                  },
                  required: ['status'],
                },
                requestId: {
                  type: 'string',
                },
              },
              required: [...basePresentationSchema.required],
            },
            402: {
              $ref: 'error#',
            },
            404: {
              $ref: 'error#',
            },
          },
        }),
      },
      async (req) => {
        const { presentation, presentationId, notifyHolder } = req.body;
        if (presentation) {
          // An inline presentation has no exchange, so there is no wallet to message
          if (notifyHolder) {
            throw newError(400, 'notifyHolder requires a presentationId', {
              errorCode: 'presentation_verify_request_invalid',
            });
          }
          return verifyPresentation(presentation, req);
        }
        if (presentationId) {
          return verifyStoredPresentation(
            { presentationId, notifyHolder },
            req,
          );
        }
        throw newError(400, 'presentation verify request invalid', {
          errorCode: 'presentation_verify_request_invalid',
        });
      },
    )
    .post(
      '/delete',
      {
        schema: fastify.autoSchema({
          summary: 'Delete presentations',
          operationId: 'deletePresentations',
          body: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
              },
              presentationIds: {
                type: 'array',
                items: {
                  type: 'string',
                },
                minItems: 1,
                // delUsingFilter deletes at most 200 matches
                maxItems: 200,
              },
            },
            required: ['tenantId', 'presentationIds'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                requestId: {
                  type: 'string',
                },
              },
            },
          },
        }),
      },
      async (req) => {
        await req.repos.presentations.delUsingFilter({
          filter: { _id: { $in: req.body.presentationIds } },
        });
        return {};
      },
    );
};
