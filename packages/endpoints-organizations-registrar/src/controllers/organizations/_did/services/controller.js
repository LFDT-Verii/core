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
const { RegistrarScopes } = require('../../../../entities');
const {
  verifyUserOrganizationReadAuthorized,
  verifyUserOrganizationWriteAuthorized,
} = require('../../../../plugins/authorization');
const { registeredCredentialTypesPreHandler } = require('../../plugins');
const { invitationCodePropertySchema } = require('../../schemas');
const {
  initAddService,
  initDeleteService,
  getService,
  updateService,
} = require('../../../../entities');

const servicesController = async (fastify) => {
  const deleteService = initDeleteService(fastify);
  const addService = initAddService(fastify);

  fastify
    .get(
      '/:serviceId',
      {
        onRequest: fastify.verifyAccessToken([
          RegistrarScopes.AdminOrganizations,
          RegistrarScopes.ReadOrganizations,
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
              serviceId: { type: 'string' },
            },
          },
          response: {
            200: { $ref: 'organization-service#' },
          },
        }),
      },
      async (req) => getService(req.params.did, req.params.serviceId, req)
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
            allOf: [
              { $ref: 'create-did-service#' },
              {
                type: 'object',
                properties: {
                  invitationCode: invitationCodePropertySchema,
                },
              },
            ],
          },
          response: {
            201: {
              type: 'object',
              properties: {
                service: { $ref: 'did-service#' },
                authClient: {
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
            },
          },
        }),
      },
      async (req, reply) => {
        const response = await addService(req.params.did, req.body, req);
        reply.code(201);
        return response;
      }
    )
    .put(
      '/:serviceId',
      {
        onRequest: fastify.verifyAccessToken([
          RegistrarScopes.AdminOrganizations,
          RegistrarScopes.WriteOrganizations,
        ]),
        preHandler: [
          verifyUserOrganizationWriteAuthorized,
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
          params: {
            type: 'object',
            properties: {
              serviceId: { type: 'string' },
            },
          },
          body: { $ref: 'modify-did-service#' },
          response: {
            200: { $ref: 'did-service#' },
          },
        }),
      },
      async (req) =>
        updateService(req.params.did, req.params.serviceId, req.body, req)
    )
    .delete(
      '/:serviceId',
      {
        onRequest: fastify.verifyAccessToken([
          RegistrarScopes.AdminOrganizations,
          RegistrarScopes.WriteOrganizations,
        ]),
        preHandler: [verifyUserOrganizationWriteAuthorized],
        schema: fastify.autoSchema({
          security: [
            {
              RegistrarOAuth2: [
                RegistrarScopes.WriteOrganizations,
                RegistrarScopes.AdminOrganizations,
              ],
            },
          ],
          params: {
            type: 'object',
            properties: {
              serviceId: { type: 'string' },
            },
          },
          response: {
            204: {
              type: 'null',
            },
          },
        }),
      },
      async (req, reply) => {
        await deleteService(req.params.did, req.params.serviceId, req);
        return reply.status(204).send();
      }
    );
};

module.exports = servicesController;
