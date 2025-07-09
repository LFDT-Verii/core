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

const { concat, difference, map, toString, isEmpty } = require('lodash/fp');
const { ExchangeStates } = require('../../exchanges');

const finalizeExchange = async (exchange, newFinalizedOfferIds, context) => {
  const { repos } = context;

  const finalizedOfferIds = concat(
    exchange.finalizedOfferIds ?? [],
    newFinalizedOfferIds
  );

  const remainingOfferIds = difference(
    map(toString, exchange.offerIds),
    map(toString, finalizedOfferIds)
  );

  if (
    isEmpty(remainingOfferIds) ||
    isEmpty(await repos.offers.findUnexpiredOffersById(remainingOfferIds))
  ) {
    return repos.exchanges.addState(exchange._id, ExchangeStates.COMPLETE, {
      finalizedOfferIds,
    });
  }
  return repos.exchanges.update(exchange._id, { finalizedOfferIds });
};

module.exports = { finalizeExchange };
