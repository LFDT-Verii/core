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

const { getExchangeResponseBodySchema } = require('../schemas');
const {
  buildExchangeRequestDeepLink,
  velocityProtocolUriToHttpUri,
} = require('../../../../../../entities');

const exchangeController = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
        response: {
          200: getExchangeResponseBodySchema,
        },
      }),
    },
    async (req) => {
      const { exchange } = req;
      return {
        exchange: {
          ...exchange,
          id: exchange._id,
        },
      };
    }
  );
  fastify.get(
    '/deep-link',
    {
      schema: fastify.autoSchema({
        querystring: {
          type: 'object',
          properties: {
            vendorOriginContext: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { deepLink: { type: 'string' } },
            required: ['deepLink'],
          },
        },
      }),
    },
    async (req) => {
      const exchangeDeepLink = await buildExchangeRequestDeepLink(req);
      const httpProtocolDeepLink = velocityProtocolUriToHttpUri(
        exchangeDeepLink,
        req
      );
      return { deepLink: httpProtocolDeepLink };
    }
  );
};

module.exports = exchangeController;
