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
const {
  verifyUserOrganizationWriteAuthorized,
  verifyUserOrganizationReadAuthorized,
} = require('../../../../plugins/authorization');
const {
  addKey,
  deleteKey,
  getKey,
  RegistrarScopes,
} = require('../../../../entities');

const keysController = async (fastify) => {
  fastify
    .post(
      '/',
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
          body: { $ref: 'https://velocitycareerlabs.io/add-key-body.json#' },
          response: {
            201: {
              type: 'object',
              properties: {
                key: {
                  $ref: 'did-key#',
                },
              },
              required: ['key'],
            },
          },
        }),
      },
      async (req, reply) => {
        const response = await addKey(req.params.did, req.body, req);
        reply.code(201);
        return response;
      }
    )
    .get(
      '/:kid',
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
          response: {
            200: {
              type: 'object',
              properties: {
                key: {
                  $ref: 'did-key#',
                },
              },
              required: ['key'],
            },
          },
        }),
      },
      async (req) => {
        const { params } = req;
        return getKey(params.did, params.kid, req);
      }
    )
    .delete(
      '/:keyId',
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
              keyId: { type: 'string' },
            },
          },
          response: {
            204: {
              type: 'null',
            },
            ...fastify.BadRequestResponse,
          },
        }),
      },
      async (req, reply) => {
        await deleteKey(req.params.did, req.params.keyId, req);
        reply.code(204);
        return {};
      }
    );
};

module.exports = keysController;
