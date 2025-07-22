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

const {
  newOfferRelatedResourceSchema,
} = require('@verii/common-schemas');
const { concat, isEmpty, flow, filter, map } = require('lodash/fp');
const newError = require('http-errors');
const {
  createVerifiableCredentials,
  ensureExchangeStateValid,
  finalizeExchange,
  filterObjectIds,
  resolveSubject,
  ExchangeStates,
  ExchangeErrorCodeState,
} = require('../../../../entities');

const {
  newVendorOfferSchema,
} = require('../../../operator/tenants/_tenantId/offers/schemas');

const controller = async (fastify) => {
  const { addDocSchema } = fastify;

  fastify.addHook('preHandler', async (req) =>
    ensureExchangeStateValid(ExchangeErrorCodeState.EXCHANGE_INVALID, req)
  );

  addDocSchema(newOfferRelatedResourceSchema);
  addDocSchema(newVendorOfferSchema);

  fastify.post(
    '/finalize-offers',
    {
      schema: fastify.autoSchema({
        body: {
          type: 'object',
          properties: {
            approvedOfferIds: {
              type: 'array',
              items: { type: 'string' },
            },
            rejectedOfferIds: {
              type: 'array',
              items: { type: 'string' },
            },
            exchangeId: { type: 'string' },
            proof: {
              type: 'object',
              properties: {
                proof_type: { type: 'string', enum: ['jwt'] },
                jwt: { type: 'string' },
              },
            },
          },
          required: ['exchangeId'],
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          502: { $ref: 'error#' },
        },
      }),
    },
    async (req) => {
      const { repos, body, exchange } = req;

      const approvedOfferIds = filterObjectIds(body.approvedOfferIds, exchange);
      const rejectedOfferIds = filterObjectIds(body.rejectedOfferIds, exchange);

      await repos.exchanges.addState(
        exchange._id,
        ExchangeStates.CLAIMING_IN_PROGRESS
      );

      await rejectOffers(exchange, rejectedOfferIds, req);

      const signedCredentials = await approveOffers(
        approvedOfferIds,
        body.proof,
        req
      );

      await finalizeExchange(
        exchange,
        concat(approvedOfferIds, rejectedOfferIds),
        req
      );
      return signedCredentials;
    }
  );

  const rejectOffers = async (exchange, offerIds, context) => {
    if (isEmpty(offerIds)) {
      return [];
    }

    const { repos } = context;
    return repos.offers.rejectOffers(exchange.vendorUserId, offerIds, context);
  };
};

const approveOffers = async (offerIds, proof, context) => {
  const { repos, log } = context;
  const offers = await repos.offers.findUnexpiredOffersById(offerIds);
  if (isEmpty(offers)) {
    log.info('issuing no offers');
    return [];
  }

  let subject;
  if (!isEmpty(proof)) {
    subject = await resolveSubject(proof, context);
  }
  log.info(
    { credentialSubjectId: subject?.id, offers },
    'issuing these offers'
  );

  checkOffersToBeApproved(offers);

  return createVerifiableCredentials(offers, subject?.id, null, context);
};

const initCheckOffers = (prop, errorMessageSuffix) => (offers) => {
  const errorOfferIds = flow(
    filter((offer) => !!offer[prop]),
    map('_id')
  )(offers);

  if (!isEmpty(errorOfferIds)) {
    throw newError(
      400,
      buildCheckOffersErrorMessage(errorOfferIds, errorMessageSuffix)
    );
  }
};

const checkOffersToBeApproved = initCheckOffers('rejectedAt', 'rejected');

const buildCheckOffersErrorMessage = (offerIds, suffix) =>
  offerIds.length === 1
    ? `offer ${offerIds} has already been ${suffix}`
    : `offers ${offerIds} have already been ${suffix}`;

module.exports = controller;

module.exports.autoPrefix = '/issue';
