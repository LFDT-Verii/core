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
const {
  w3cVcSchema,
  newOfferRelatedResourceSchema,
} = require('@verii/common-schemas');
const { tenantLoaderPlugin } = require('../../../entities/tenants');
const { verifyPresentation } = require('../../../entities/presentations');
const {
  basePresentationSchema,
  credentialVerificationSchema,
  presentationVerificationSchema,
  presentationSchema,
  w3cPresentationSchema,
} = require('./schemas');

module.exports = async (fastify) => {
  fastify
    .addSchema(newOfferRelatedResourceSchema)
    .addSchema(w3cVcSchema)
    .addSchema(credentialVerificationSchema)
    .addSchema(presentationSchema)
    .addSchema(presentationVerificationSchema)
    .addSchema(w3cPresentationSchema)
    .register(tenantLoaderPlugin, { notFoundStatusCode: 400 })
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
                requestId: {
                  type: 'string',
                },
              },
              required: [...basePresentationSchema.required],
            },
            402: {
              $ref: 'error#',
            },
          },
        }),
      },
      async (req) => {
        if (req.body.presentation) {
          return verifyPresentation(req.body.presentation, req);
        }
        if (req.body.presentationId) {
          const presentationEntity = await req.repos.presentations.findById(
            req.body.presentationId,
          );

          const verification = await verifyPresentation(
            presentationEntity.presentation,
            req,
          );
          await req.repos.presentations.addVerification(
            presentationEntity._id,
            verification.verification,
          );
          return verification;
        }
        throw newError.BadRequest('presentation verify request invalid', {
          errorCode: 'presentation_verify_request_invalid',
        });
      },
    );
};
