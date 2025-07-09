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
const { map } = require('lodash/fp');
const { wrapValidationError } = require('@verii/validation');
const {
  RegistrarScopes,
  buildFullOrganizationResponse,
  buildProfileResponse,
  initCreateOrganization,
  initTransformOrganizationFilter,
  validateProfileName,
  validateProfileWebsite,
  verifyProfileWebsiteUnique,
} = require('../../../entities');
const {
  verifyUserOrganizationReadAuthorized,
  verifyUserOrganizationWriteAuthorized,
} = require('../../../plugins/authorization');
const { registeredCredentialTypesPreHandler } = require('../plugins');
const {
  invitationCodePropertySchema,
  addKeyBodySchema,
} = require('../schemas');

const fullOrganizationController = async (fastify) => {
  const transformToFinder = initTransformOrganizationFilter();
  const createOrganization = initCreateOrganization(fastify);

  fastify
    .get(
      '/',
      {
        onRequest: [
          fastify.verifyAccessToken([
            RegistrarScopes.ReadOrganizations,
            RegistrarScopes.AdminOrganizations,
          ]),
        ],
        preHandler: [verifyUserOrganizationReadAuthorized],
        schema: fastify.autoSchema({
          security: [
            {
              RegistrarOAuth2: [
                RegistrarScopes.ReadOrganizations,
                RegistrarScopes.AdminOrganizations,
              ],
            },
          ],
          querystring: { $ref: 'organization-search-query-params#' },
          response: {
            200: {
              type: 'object',
              properties: {
                result: {
                  type: 'array',
                  items: {
                    $ref: 'https://velocitycareerlabs.io/full-organization.json#',
                  },
                },
              },
            },
          },
        }),
      },
      async (req) => {
        const { repos, query } = req;
        const organizations = await repos.organizations.find(
          transformToFinder(query)
        );
        return {
          result: map(
            (organization) => buildFullOrganizationResponse({ organization }),
            organizations
          ),
        };
      }
    )
    .get(
      '/:did',
      {
        onRequest: fastify.verifyAccessToken([
          RegistrarScopes.ReadOrganizations,
          RegistrarScopes.AdminOrganizations,
        ]),
        preHandler: [verifyUserOrganizationReadAuthorized],
        schema: fastify.autoSchema({
          security: [
            {
              RegistrarOAuth2: [
                RegistrarScopes.ReadOrganizations,
                RegistrarScopes.AdminOrganizations,
              ],
            },
          ],
          params: {
            type: 'object',
            properties: {
              did: {
                type: 'string',
              },
            },
          },
          response: {
            200: {
              $ref: 'https://velocitycareerlabs.io/full-organization.json#',
            },
          },
        }),
      },
      async ({ repos, params }) => {
        const organization = await repos.organizations.findOneByDid(params.did);
        return buildFullOrganizationResponse({ organization });
      }
    )
    .post(
      '/',
      {
        onRequest: fastify.verifyAccessToken([
          RegistrarScopes.AdminOrganizations,
          RegistrarScopes.WriteOrganizations,
        ]),
        preHandler: [
          verifyUserOrganizationWriteAuthorized,
          validateFullOrganizationBody,
          registeredCredentialTypesPreHandler,
        ],
        schema: fastify.autoSchema({
          security: [
            {
              RegistrarOAuth2: [
                RegistrarScopes.WriteOrganizations,
                RegistrarScopes.AdminOrganizations,
              ],
            },
          ],
          body: {
            type: 'object',
            properties: {
              profile: {
                $ref: 'organization-profile-creation#',
              },
              serviceEndpoints: {
                type: 'array',
                items: { $ref: 'create-did-service#' },
              },
              invitationCode: invitationCodePropertySchema,
              byoDid: {
                type: 'string',
                pattern: '^did:web:[A-Za-z0-9._:?=&%;-]+$',
              },
              keys: {
                type: 'array',
                items: addKeyBodySchema,
              },
            },
            required: ['profile'],
          },
          response: {
            201: {
              allOf: [
                {
                  $ref: 'https://velocitycareerlabs.io/full-organization.json#',
                },
                {
                  type: 'object',
                  properties: {
                    keys: {
                      type: 'array',
                      items: { $ref: 'did-key#' },
                    },
                    authClients: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          type: { type: 'string' },
                          clientType: { type: 'string' },
                          clientId: { type: 'string' },
                          clientSecret: { type: 'string' },
                          serviceId: { type: 'string' },
                        },
                      },
                    },
                    messageCode: {
                      type: 'string',
                    },
                  },
                },
              ],
              required: ['didDoc', 'profile', 'keys'],
            },
            400: { $ref: 'error#' },
          },
        }),
      },
      async (req, reply) => {
        const {
          body: {
            serviceEndpoints,
            invitationCode,
            byoDid,
            profile,
            keys: byoKeys,
          },
        } = req;

        const { organization, keys, keyPairs, authClients, messageCode } =
          await createOrganization(
            {
              byoDid,
              byoKeys,
              serviceEndpoints,
              invitationCode,
              profile,
            },
            req
          );
        reply.code(201);
        return buildFullOrganizationResponse({
          organization,
          profile: buildProfileResponse(organization, true),
          keys,
          keyPairs,
          authClients,
          messageCode,
        });
      }
    );
};

const validateFullOrganizationBody = async (req) => {
  const schema =
    req.config.isProd || req.headers['x-validate-kyb-profile'] === '1'
      ? newKybFullOrganizationSchema
      : newFullOrganizationSchema;

  const validate = req.compileValidationSchema(schema, 'body');

  if (!validate(req.body)) {
    throw wrapValidationError(validate.errors, 'body');
  }

  const { profile } = req.body;
  await validateProfileName(profile.name, null, req);
  validateProfileWebsite({ profile });
  await verifyProfileWebsiteUnique({ profile }, req);
};

const buildNewFullOrganizationSchema = (profileRef) => ({
  type: 'object',
  properties: {
    profile: {
      $ref: profileRef,
    },
    serviceEndpoints: {
      type: 'array',
      items: { $ref: 'create-did-service#' },
    },
    invitationCode: invitationCodePropertySchema,
  },
  required: ['profile'],
});

const newFullOrganizationSchema = buildNewFullOrganizationSchema(
  'organization-profile-creation#'
);
const newKybFullOrganizationSchema = buildNewFullOrganizationSchema(
  'organization-kyb-profile-creation#'
);

module.exports = fullOrganizationController;
