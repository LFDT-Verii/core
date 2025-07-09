/**
 * Copyright 2023 Velocity Team
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
 */

const {
  verifyVerifiablePresentationJwt,
} = require('@verii/verifiable-credentials');
const {
  exchangeLoaderPlugin,
  ensureDisclosureConfigurationTypePlugin,
  ensureDisclosureActivePlugin,
  disclosureLoaderPlugin,
  verifyAccessTokenPlugin,
} = require('../../../../plugins');
const { handlePresentationSubmission } = require('../../../../entities');

const controller = async (fastify) => {
  fastify
    .register(exchangeLoaderPlugin)
    .register(disclosureLoaderPlugin)
    .register(ensureDisclosureConfigurationTypePlugin)
    .register(ensureDisclosureActivePlugin)
    .register(verifyAccessTokenPlugin, {
      feed: true,
      user: true,
      hook: 'preHandler',
    })
    .post(
      '/',
      {
        preValidation: async (req) => {
          // eslint-disable-next-line better-mutation/no-mutation
          req.body.vp = await verifyVerifiablePresentationJwt(
            req.body.jwt_vp ?? req.body.vp_jwt,
            req
          );
        },
        schema: fastify.autoSchema({
          body: {
            type: 'object',
            properties: {
              exchange_id: { type: 'string', description: 'exchange id value' },
              // TODO remove after SDK is released 01/06/2021
              vp_jwt: {
                type: 'string',
                description:
                  'deprecated - use jwt_vp instead. vp encoded as a jwt signed by the holder',
                deprecated: true,
              },
              jwt_vp: {
                type: 'string',
                description: 'vp encoded as a jwt signed by the holder',
              },
              vp: {
                $ref: 'https://velocitycareerlabs.io/velocity-presentation-submission.schema.json#',
                description: '--DO-NOT-SEND--',
              },
            },
          },
          response: {
            200: {
              $ref: 'https://velocitycareerlabs.io/velocity-presentation-submission-response.schema.json#',
            },
            401: {
              $ref: 'error#',
            },
            ...fastify.ConflictResponse,
          },
        }),
      },
      async (req) => {
        return handlePresentationSubmission(req.body.vp, req);
      }
    );
};

module.exports = controller;
