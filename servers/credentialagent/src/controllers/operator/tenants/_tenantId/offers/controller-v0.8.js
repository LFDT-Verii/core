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

const { resolveDid } = require('@verii/common-fetchers');
const newError = require('http-errors');
const { isEmpty, includes, map, flow, first, uniq } = require('lodash/fp');
const { nanoid } = require('nanoid/non-secure');
const qr = require('qr-image');

const {
  prepareOffers,
  ExchangeStates,
  NotificationTypes,
  postValidationOffersHandler,
  buildExchangeRequestDeepLink,
  initValidateOffer,
} = require('../../../../../entities');
const { sendPush } = require('../../../../../fetchers');
const { loadDisclosure } = require('../../../../../plugins');

const canPushNotification = (exchange) =>
  !!(exchange.pushDelegate && exchange.pushDelegate.pushUrl);

const offerExchangeController = async (fastify) => {
  const validateOffer = initValidateOffer(fastify);

  fastify.post(
    '/offers',
    {
      preHandler: [
        postValidationOffersHandler,
        async (req) => {
          // eslint-disable-next-line better-mutation/no-mutation
          req.disclosure = await loadDisclosure(req);
        },
      ],
      schema: fastify.autoSchema({
        body: {
          $ref: 'https://velocitycareerlabs.io/new-vendor-offer.schema.json#',
        },
        response: {
          200: {
            $ref: 'https://velocitycareerlabs.io/vendor-offer.schema.json#',
          },
          ...fastify.UnprocessableEntityResponse,
        },
      }),
      attachValidation: true,
    },
    async (req) => {
      const { body: vendorOffer, repos, exchange } = req;

      const validatedOffer = await validateOffer(
        vendorOffer,
        false,
        false,
        req,
      );

      const preparedOffers = await prepareOffers([validatedOffer], req);

      const offer = first(preparedOffers);
      if (includes(offer.contentHash.value, exchange.offerHashes)) {
        throw newError.UnprocessableEntity(
          'Wallet already contains this offer',
        );
      }
      return repos.offers.insert(offer);
    },
  );

  fastify.post(
    '/offers/complete',
    {
      schema: fastify.autoSchema({
        response: {
          200: {
            type: 'object',
            properties: {
              offerIds: {
                type: 'array',
                items: { type: 'string' },
              },
              pushSentAt: {
                type: 'string',
                format: 'date-time',
              },
            },
            description: 'Offers transmission complete',
          },
        },
      }),
    },
    async (req) => {
      const { repos, exchange, tenant } = req;

      const orgDoc = await resolveDid(tenant.did, req);
      if (isEmpty(orgDoc)) {
        throw new newError.NotFound(
          `No organization found for issuer ${tenant.did}`,
        );
      }

      const offers = await repos.offers.find(
        { filter: { exchangeId: exchange._id } },
        { _id: 1, issuer: 1, offerId: 1, type: 1 },
      );

      if (isEmpty(offers)) {
        if (!canPushNotification(exchange)) {
          await repos.exchanges.addState(
            exchange._id,
            ExchangeStates.NO_OFFERS_RECEIVED,
          );
          await repos.exchanges.addState(exchange._id, ExchangeStates.COMPLETE);
          return {};
        }
        await sendPush(
          {
            id: nanoid(),
            pushToken: exchange.pushDelegate.pushToken,
            data: {
              notificationType: NotificationTypes.NO_OFFERS_FOUND,
              issuer: tenant.did,
              exchangeId: exchange._id,
              serviceEndpoint: exchange.pushDelegate.pushUrl,
            },
          },
          req.exchange.pushDelegate,
          req,
        );
        const pushSentAt = new Date();
        await repos.exchanges.addState(
          exchange._id,
          ExchangeStates.NO_OFFERS_RECEIVED,
          { pushSentAt },
        );
        await repos.exchanges.addState(exchange._id, ExchangeStates.COMPLETE);
        return {
          pushSentAt,
        };
      }

      await repos.exchanges.addState(
        exchange._id,
        ExchangeStates.OFFERS_RECEIVED,
      );

      const offerIds = map('_id', offers);
      if (!canPushNotification(exchange)) {
        return { offerIds };
      }

      const types = flow(map('type.0'), uniq)(offers);
      await sendPush(
        {
          id: nanoid(),
          pushToken: exchange.pushDelegate.pushToken,
          data: {
            notificationType: NotificationTypes.NEW_OFFER_READY,
            issuer: tenant.did,
            exchangeId: exchange._id,
            serviceEndpoint: exchange.pushDelegate.pushUrl,
            credentialTypes: types,
            count: offers.length,
          },
        },
        req.exchange.pushDelegate,
        req,
      );
      const pushSentAt = new Date();
      await repos.exchanges.update(exchange._id, { pushSentAt });
      return {
        offerIds,
        pushSentAt,
      };
    },
  );

  fastify
    .get(
      '/qrcode.uri',
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
              description: 'qr code deep link',
              content: {
                'text/plain': { schema: { type: 'string', format: 'uri' } },
              },
            },
          },
        }),
      },
      async (req, reply) => {
        const uri = await buildExchangeRequestDeepLink(req);
        return reply.type('text/plain').send(uri);
      },
    )
    .get(
      '/qrcode.png',
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
              description: 'qr code image response',
              content: {
                'image/png': { schema: { type: 'string', format: 'binary' } },
              },
            },
          },
        }),
      },
      async (req, reply) => {
        const uri = await buildExchangeRequestDeepLink(req);
        const qrCodeBuffer = qr.imageSync(uri, {
          ec_level: 'H',
          type: 'png',
        });

        return reply.type('image/png').send(qrCodeBuffer);
      },
    );
};

module.exports = offerExchangeController;

module.exports.autoPrefix = '/tenants/:tenantId/exchanges/:exchangeId';
