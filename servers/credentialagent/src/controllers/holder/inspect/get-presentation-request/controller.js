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

const { omitBy, isNil } = require('lodash/fp');
const {
  getPushDelegate,
} = require('../../../../entities/push-delegate/get-push-delegate');
const {
  ExchangeTypes,
  ExchangeProtocols,
  buildRequestResponseSchema,
  createPresentationRequest,
  signExchangeResponse,
} = require('../../../../entities');
const {
  ensureDisclosureConfigurationTypePlugin,
  ensureDisclosureActivePlugin,
} = require('../../../../plugins');

const controller = async (fastify) => {
  fastify.register(ensureDisclosureConfigurationTypePlugin);
  fastify.register(ensureDisclosureActivePlugin);
  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
        querystring: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            format: { type: 'string', enum: ['json'] },
          },
          required: ['id'],
        },
        params: {
          type: 'object',
          properties: {
            'push_delegate.push_token': { type: 'string' },
            'push_delegate.push_url': { type: 'string' },
          },
        },
        response: {
          200: buildRequestResponseSchema('presentation', fastify.config),
        },
      }),
    },
    async (req) => {
      const {
        repos,
        query,
        config: { isProd },
      } = req;
      const disclosure = await repos.disclosures.findById(query.id);

      const pushDelegate = getPushDelegate(query.push_delegate, req);

      const exchange = await repos.exchanges.insertWithInitialState(
        omitBy(isNil, {
          type: ExchangeTypes.DISCLOSURE,
          pushDelegate,
          disclosureId: disclosure._id,
          protocolMetadata: {
            protocol: ExchangeProtocols.VNF_API,
          },
        })
      );
      // eslint-disable-next-line better-mutation/no-mutation
      req.exchange = exchange; // exchange is added onto the request for the exchange error handler

      const presentationRequest = await createPresentationRequest(
        disclosure,
        exchange,
        req
      );

      // eslint-disable-next-line camelcase
      return {
        presentation_request:
          !isProd && req.query.format === 'json'
            ? presentationRequest
            : await signExchangeResponse(presentationRequest, {}, req),
      };
    }
  );
};

module.exports = controller;
