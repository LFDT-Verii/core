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

const { omit } = require('lodash/fp');

const vendorUserIdMappingController = async (fastify) => {
  const specificParams = {
    type: 'object',
    properties: {
      id: { type: 'string', minLength: 1 },
      ...fastify.currentAutoSchemaPreset.params.properties,
    },
  };

  fastify.post(
    '/',
    {
      schema: fastify.autoSchema({
        body: { $ref: 'https://velocitycareerlabs.io/new-user.schema.json#' },
        response: {
          201: { $ref: 'https://velocitycareerlabs.io/user.schema.json#' },
        },
      }),
    },
    async ({ body, repos }) =>
      repos.vendorUserIdMappings.upsert(
        body.id || body.email,
        omit(['id'], body)
      )
  );

  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
        response: {
          200: {
            type: 'array',
            items: {
              $ref: 'https://velocitycareerlabs.io/user.schema.json#',
            },
          },
        },
      }),
    },
    async ({ repos }) => repos.vendorUserIdMappings.find({})
  );

  fastify.get(
    '/:id',
    {
      schema: fastify.autoSchema({
        params: specificParams,
        response: {
          200: { $ref: 'https://velocitycareerlabs.io/user.schema.json#' },
        },
      }),
    },
    async ({ params: { id }, repos }) => repos.vendorUserIdMappings.findById(id)
  );

  fastify.delete(
    '/:id',
    {
      schema: fastify.autoSchema({
        params: specificParams,
        response: {
          204: { type: 'null', description: 'No Content' },
        },
      }),
    },
    async ({ params: { id }, repos }, reply) => {
      reply.status(204);
      return repos.vendorUserIdMappings.del(id);
    }
  );
};

module.exports = vendorUserIdMappingController;
