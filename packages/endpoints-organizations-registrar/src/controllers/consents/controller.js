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

const { values } = require('lodash/fp');
const { optional } = require('@verii/common-functions');
const { ConsentTypes } = require('../../entities');
const { consentResponseSchema } = require('./schemas/consent-response.schema');

const consentsController = async (fastify) => {
  fastify
    .post(
      '/',
      {
        onRequest: fastify.verifyAccessToken(),
        schema: fastify.autoSchema({
          body: {
            type: 'object',
            properties: {
              version: { type: 'string' },
              type: {
                type: 'string',
                enum: values(ConsentTypes),
                default: 'RegistrarAppTerms',
              },
              did: {
                type: 'string',
              },
            },
            required: ['version'],
          },
          response: {
            200: {
              type: 'object',
              properties: { consent: consentResponseSchema },
            },
          },
        }),
      },
      async (req) => {
        const {
          repos,
          body: { version, type, did },
          user,
        } = req;

        const organization = await optional(
          () =>
            repos.organizations.findOneByDid(did, {
              _id: 1,
            }),
          [did]
        );

        const { consentId, ...consent } =
          await repos.registrarConsents.registerConsent({
            userId: user.sub,
            organizationId: organization?._id,
            type,
            version,
          });
        return {
          consent: {
            id: consentId,
            ...consent,
          },
        };
      }
    )
    .get(
      '/',
      {
        onRequest: fastify.verifyAccessToken(),
        schema: fastify.autoSchema({
          response: {
            200: {
              type: 'array',
              items: consentResponseSchema,
            },
          },
        }),
      },
      async (req) => {
        const { repos, user } = req;
        const consents = await repos.registrarConsents.find({
          filter: { userId: user.sub },
        });
        return consents;
      }
    );
};

module.exports = consentsController;
