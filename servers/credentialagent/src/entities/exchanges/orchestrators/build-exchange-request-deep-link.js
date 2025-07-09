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

const { last, flow, map, uniq } = require('lodash/fp');
const newError = require('http-errors');
const {
  buildIssuingDeepLink,
} = require('../../offers/domains/build-deeplink-url');
const { ExchangeStates } = require('../domains/states');

const validateExchange = (exchange) => {
  if (last(exchange.events).state !== ExchangeStates.OFFERS_RECEIVED) {
    throw new newError.BadRequest(
      'Exchange in invalid state. Perhaps you forgot to call /offers/complete'
    );
  }
};

const buildExchangeRequestDeepLink = async (context) => {
  const { exchange, repos, query } = context;
  validateExchange(exchange);

  const offers = await repos.offers.find(
    { filter: { exchangeId: exchange._id } },
    { type: 1 }
  );
  const types = flow(map('type.0'), uniq)(offers);
  return buildIssuingDeepLink(
    exchange.disclosureId,
    exchange._id,
    types,
    query.vendorOriginContext,
    context
  );
};

module.exports = { buildExchangeRequestDeepLink };
