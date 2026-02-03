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

const newError = require('http-errors');
const { ObjectId } = require('mongodb');
const { OBJECT_ID_FORMAT } = require('@verii/test-regexes');

const operatorFeedsController = async (fastify) => {
  const paramsSchema = {
    type: 'object',
    properties: {
      feedId: { type: 'string', minLength: 1 },
      ...fastify.currentAutoSchemaPreset.params.properties,
    },
    required: ['feedId', ...fastify.currentAutoSchemaPreset.params.required],
  };
  fastify.post(
    '/',
    {
      schema: fastify.autoSchema({
        body: {
          type: 'object',
          properties: {
            feeds: {
              type: 'array',
              items: {
                $ref: 'https://velocitycareerlabs.io/add-feed.schema.json#',
              },
              minItems: 1,
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              feeds: {
                type: 'array',
                items: {
                  $ref: 'https://velocitycareerlabs.io/feed.schema.json#',
                },
              },
            },
          },
        },
      }),
    },
    async (req, reply) => {
      const { repos, body } = req;
      const feeds = await repos.feeds.insertMany(body.feeds);
      reply.code(201);
      return {
        feeds,
      };
    },
  );

  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
        response: {
          200: {
            type: 'object',
            properties: {
              feeds: {
                type: 'array',
                items: {
                  $ref: 'https://velocitycareerlabs.io/feed.schema.json#',
                },
              },
            },
          },
          400: { $ref: 'error#' },
        },
      }),
    },
    async (req) => {
      const { repos } = req;
      const feeds = await repos.feeds.find();
      return { feeds };
    },
  );

  fastify.get(
    '/:feedId',
    {
      schema: fastify.autoSchema({
        params: paramsSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              feed: { $ref: 'https://velocitycareerlabs.io/feed.schema.json#' },
            },
          },
          400: { $ref: 'error#' },
        },
      }),
    },
    async (req) => {
      const { params, repos } = req;
      const feed = await repos.feeds.findById(params.feedId);
      return { feed };
    },
  );

  fastify.delete(
    '/:feedId',
    {
      schema: fastify.autoSchema({
        params: paramsSchema,
        response: {
          400: { $ref: 'error#' },
        },
      }),
    },
    async (req, reply) => {
      const { params, repos } = req;
      await repos.feeds.del(params.feedId);
      reply.code(204);
      return {};
    },
  );

  fastify.put(
    '/:feedId',
    {
      schema: fastify.autoSchema({
        params: paramsSchema,
        body: {
          allOf: [
            {
              type: 'object',
              properties: {
                feed: {
                  $ref: 'https://velocitycareerlabs.io/modify-feed-update-body.schema.json#',
                },
              },
            },
          ],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              feed: { $ref: 'https://velocitycareerlabs.io/feed.schema.json#' },
            },
          },
          400: { $ref: 'error#' },
        },
      }),
    },
    async (req) => {
      const { params, body, repos } = req;
      const updateDoc = {
        $set: {
          ...body.feed,
          updatedAt: new Date(),
        },
        $unset: { clientId: '' },
      };

      const updateResult = await repos.feeds.collection().findOneAndUpdate(
        {
          _id: OBJECT_ID_FORMAT.test(params.feedId)
            ? new ObjectId(params.feedId)
            : params.feedId,
          disclosureId: new ObjectId(params.id),
        },
        updateDoc,
        {
          projection: repos.feeds.defaultColumnsSelection,
          returnDocument: 'after',
          includeResultMetadata: true,
        },
      );
      if (!updateResult.value) {
        throw newError(404, `feed ${params.feedId} not found`);
      }
      return { feed: updateResult.value };
    },
  );
};

module.exports = operatorFeedsController;
