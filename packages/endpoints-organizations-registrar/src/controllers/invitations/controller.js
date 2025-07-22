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

const newError = require('http-errors');
const {
  addressSchema,
  locationSchema,
} = require('@verii/common-schemas');
const {
  RegistrarScopes,
  isInvitationExpired,
  getInvitationResponseBodySchema,
} = require('../../entities');

const invitationsController = async (fastify) => {
  fastify
    .addSchema(addressSchema)
    .addSchema(locationSchema)
    .get(
      '/:code',
      {
        onRequest: fastify.verifyAccessToken([
          RegistrarScopes.ReadOrganizations,
        ]),
        schema: fastify.autoSchema({
          tags: ['registrar_organizations'],
          security: [
            {
              RegistrarOAuth2: [RegistrarScopes.ReadOrganizations],
            },
          ],
          params: {
            type: 'object',
            properties: {
              code: { type: 'string' },
            },
          },
          response: {
            200: getInvitationResponseBodySchema,
            ...fastify.BadRequestResponse,
          },
        }),
      },
      async (req) => {
        const {
          params: { code },
          repos,
        } = req;

        const invitation = await repos.invitations.findOne({
          filter: { code },
        });
        if (!invitation) {
          throw newError(404, 'Invitation not found', {
            errorCode: 'invitation_not_found',
          });
        }
        if (isInvitationExpired(invitation)) {
          throw newError(400, 'Invitation has expired', {
            errorCode: 'invitation_expired',
          });
        }
        return { invitation };
      }
    );
};

module.exports = invitationsController;
