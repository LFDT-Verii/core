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
const {
  concat,
  filter,
  flow,
  fromPairs,
  includes,
  isEmpty,
  isNil,
  map,
  omit,
  size,
  some,
  isString,
  all,
  values,
  pick,
} = require('lodash/fp');
const { hashOffer } = require('@verii/verii-issuing');
const {
  ensureExchangeStateValid,
  initValidateOffer,
  prepareLinkedCredentialsForHolder,
  prepareOffers,
  ExchangeStates,
  OfferType,
  OfferMode,
  generateIssuingChallenge,
  ExchangeErrorCodeState,
} = require('../../../../../entities');

const { requestOffersFromVendor } = require('../../../../../fetchers');

const controller = async (fastify) => {
  fastify.addHook('preHandler', async (req) =>
    ensureExchangeStateValid(ExchangeErrorCodeState.OFFERS_CLIAMED_SYNCH, req)
  );
  const validateOffer = initValidateOffer(fastify);

  fastify.post(
    '/',
    {
      schema: fastify.autoSchema({
        body: {
          type: 'object',
          properties: {
            // TODO remove after 15/12/2021
            types: {
              type: 'array',
              items: {
                type: 'string',
                maxLength: 64,
              },
              description:
                'deprecated - provided on earlier step `get-credential-manifest` and saved in Exchange document in DB (`Exchanges` collection)',
              deprecated: true,
            },
            exchangeId: { type: 'string' },
            offerHashes: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
          required: ['exchangeId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              offers: {
                type: 'array',
                items: {
                  $ref: 'https://velocitycareerlabs.io/holder-offer.schema.json#',
                },
              },
              challenge: {
                type: 'string',
              },
            },
            required: ['offers'],
          },
          502: {
            $ref: 'error#',
          },
        },
      }),
    },
    async (req, reply) => {
      const {
        user: { vendorUserId },
        body: { types = [], offerHashes = [] },
        exchange,
        repos,
        log,
      } = req;
      const { challenge, challengeIssuedAt } = generateIssuingChallenge();

      await repos.exchanges.addState(
        exchange._id,
        ExchangeStates.OFFERS_REQUESTED
      );

      const offerMode = loadOfferMode(req);
      const {
        offers,
        status = 200,
        vendorOfferStatuses,
      } = await loadingOffersToModeMap[offerMode](
        {
          vendorUserId,
          types,
          offerHashes,
        },
        req
      );

      if (status === 202) {
        await repos.exchanges.addState(
          exchange._id,
          ExchangeStates.OFFERS_WAITING_ON_VENDOR,
          { offerHashes, vendorUserId }
        );
      } else {
        const $set = {
          vendorUserId,
          offerIds: map('_id', offers),
          challenge,
          challengeIssuedAt,
        };
        if (!isEmpty(vendorOfferStatuses)) {
          $set.vendorOfferStatuses = vendorOfferStatuses;
          log.info({
            exchangeId: exchange._id,
            vendorOfferStatuses,
          });
        }
        await repos.exchanges.addState(
          exchange._id,
          ExchangeStates.OFFERS_SENT,
          $set
        );
      }

      validateInvalidWebhookOffers(vendorOfferStatuses, req);

      const holderOffers = mapToHolderRepresentation(offers);
      reply.code(status);
      return {
        challenge: isEmpty(holderOffers) ? undefined : challenge,
        offers: holderOffers,
      };
    }
  );

  const loadOfferMode = (context) => {
    const {
      config: { offerType },
      disclosure: { offerMode },
    } = context;

    if (isEmpty(offerMode)) {
      return offerType;
    }

    return offerMode;
  };

  const loadAllOffers = async (
    { vendorUserId, types, offerHashes },
    context
  ) => {
    const { exchange } = context;
    const skipVendorOffers =
      some({ state: ExchangeStates.OFFERS_RECEIVED }, exchange.events) &&
      some({ state: ExchangeStates.OFFERS_WAITING_ON_VENDOR }, exchange.events);
    return loadOffers(
      {
        vendorUserId,
        types,
        offerHashes,
        skipVendorOffers,
      },
      context
    );
  };

  const loadWebhookOffers = async (
    { vendorUserId, types, offerHashes },
    context
  ) => {
    const { exchange } = context;
    const skipPrepreparedOffers = !some(
      { state: ExchangeStates.OFFERS_RECEIVED },
      exchange.events
    );
    return loadOffers(
      {
        vendorUserId,
        types,
        offerHashes,
        skipPrepreparedOffers,
      },
      context
    );
  };

  const loadPreparedOffers = async (
    { vendorUserId, types, offerHashes },
    context
  ) =>
    loadOffers(
      {
        vendorUserId,
        types,
        offerHashes,
        skipVendorOffers: true,
      },
      context
    );

  const loadLegacyOffers = async (
    { vendorUserId, types, offerHashes },
    context
  ) => {
    const { exchange } = context;
    const skipVendorOffers = some(
      { state: ExchangeStates.OFFERS_RECEIVED },
      exchange.events
    );
    return loadOffers(
      {
        vendorUserId,
        types,
        offerHashes,
        filterByExchange: true,
        skipVendorOffers,
      },
      context
    );
  };

  const loadOffers = async (
    {
      vendorUserId,
      types,
      offerHashes,
      filterByExchange = false,
      skipVendorOffers = false,
      skipPrepreparedOffers = false,
    },
    context
  ) => {
    const vendorOfferResults = skipVendorOffers
      ? { offers: [], status: 200 }
      : await getVendorOffers(vendorUserId, types, offerHashes, context);
    if (vendorOfferResults.status === 202) {
      return vendorOfferResults;
    }
    const preparedOffers = skipPrepreparedOffers
      ? []
      : await context.repos.offers.findUniquePreparedOffers(
          {
            vendorUserId,
            types,
            offerHashes: concat(
              offerHashes,
              map('contentHash.value', vendorOfferResults.offers)
            ),
            exchangeId: filterByExchange ? context.exchange._id : undefined,
          },
          context
        );
    return {
      ...vendorOfferResults,
      offers: mapOffer(
        [...vendorOfferResults.offers, ...preparedOffers],
        context
      ),
    };
  };

  const mapIssuer = (offer) => ({
    ...omit(['issuer'], offer),
    issuer: isString(offer.issuer)
      ? offer.issuer
      : pick(['id', 'name', 'image', 'type'], offer.issuer),
  });

  const mapOffer = (offers, context) => {
    const { storeIssuerAsString } = context.config;

    if (!storeIssuerAsString) {
      return map((offer) => mapIssuer(offer), offers);
    }

    return map(
      (offer) => ({
        ...omit(['issuer'], offer),
        issuer: isString(offer.issuer)
          ? offer.issuer
          : offer.issuer.id.toString(),
      }),
      offers
    );
  };

  const getVendorOffers = async (vendorUserId, types, offerHashes, context) => {
    const { exchange, tenant, repos } = context;

    const vendorFilter = {
      vendorUserId,
      vendorOrganizationId: tenant.vendorOrganizationId,
      tenantDID: tenant.did,
      tenantId: tenant._id,
      exchangeId: exchange._id,
    };
    if (types) {
      vendorFilter.types = types;
    }

    const offersResponse =  await requestOffersFromVendor(
      vendorFilter,
      context
    );

    if (offersResponse.statusCode === 202) {
      return { status: 202, offers: [], offerStatuses: {} };
    }

    const { offers: vendorOffers } = await offersResponse.json();

    const countOffersWithoutOfferId = flow(
      filter(({ offerId }) => isNil(offerId)),
      size
    )(vendorOffers);
    if (countOffersWithoutOfferId) {
      const err = `${countOffersWithoutOfferId} offer(s) without offerId received from vendor`;
      await repos.exchanges.addState(
        exchange._id,
        ExchangeStates.OFFER_ID_UNDEFINED_ERROR,
        {
          vendorUserId,
          err,
        }
      );
      throw newError(500, err, {
        errorCode: 'upstream_offers_offer_id_missing',
      });
    }

    const validatedOffersWithStatuses = await buildVendorOfferStatuses(
      vendorOffers,
      offerHashes,
      context
    );

    const vendorOfferStatuses = flow(
      map(([{ offerId }, status]) => [offerId, status]),
      fromPairs
    )(validatedOffersWithStatuses);

    const validOffers = flow(
      filter(([, status]) => status === 'OK'),
      map(([offer]) => offer)
    )(validatedOffersWithStatuses);

    if (isEmpty(validOffers)) {
      return {
        offers: [],
        vendorOfferStatuses,
      };
    }
    const preparedOffers = await prepareOffers(validOffers, context);
    const offers = await repos.offers.insertMany(preparedOffers);
    return {
      offers,
      vendorOfferStatuses,
    };
  };

  const buildVendorOfferStatuses = async (offers, offerHashes, context) => {
    const doOfferValidation = async (vendorOffer) => {
      try {
        const validatedOffer = await validateOffer(
          vendorOffer,
          true,
          false,
          context
        );
        if (includes(hashOffer(validatedOffer), offerHashes)) {
          return [validatedOffer, 'Duplicate'];
        }
        return [validatedOffer, 'OK'];
      } catch (error) {
        return [vendorOffer, error.message];
      }
    };
    const proms = map(doOfferValidation, offers);
    return Promise.all(proms);
  };

  const loadingOffersToModeMap = {
    [OfferMode.PRELOADED]: loadPreparedOffers,
    [OfferMode.WEBHOOK]: loadWebhookOffers,
    [OfferType.PREPREPARED_ONLY]: loadPreparedOffers,
    [OfferType.ALL]: loadAllOffers,
    [OfferType.LEGACY]: loadLegacyOffers,
  };
};

const validateInvalidWebhookOffers = (vendorOfferStatuses, context) => {
  const { errorOnInvalidWebhookOffers } = context.config;

  const allValid = all(
    (status) => status === 'OK',
    values(vendorOfferStatuses)
  );

  if (!errorOnInvalidWebhookOffers || allValid) {
    return;
  }

  throw newError(400, 'Invalid webhook offers', {
    errorCode: 'upstream_offers_invalid',
  });
};

const mapToHolderRepresentation = map((offer) => ({
  ...omit([
    '_id',
    'issuer.vendorOrganizationId',
    'contentHash',
    'credentialSubject.vendorUserId',
    'createdAt',
    'updatedAt',
  ])(offer),
  id: offer._id,
  hash: offer.contentHash.value,
  linkedCredentials: prepareLinkedCredentialsForHolder(offer.linkedCredentials),
}));

module.exports = controller;

module.exports.autoPrefix = '/issue/credential-offers';
