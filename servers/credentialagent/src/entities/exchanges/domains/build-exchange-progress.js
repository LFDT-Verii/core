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

const { reduce } = require('lodash/fp');

const { ExchangeStates } = require('./states');
const { ExchangeTypes } = require('./types');

const buildExchangeProgress = (exchange) => {
  const { type, _id } = exchange;
  return { id: _id, type, ...buildCompletionStates(exchange) };
};

const buildCompletionStates = (exchange) =>
  reduce(
    (acc, event) => {
      // if already seen complete in any form short circuit iteration
      if (acc.exchangeComplete) {
        return acc;
      }

      switch (event.state) {
        case ExchangeStates.IDENTIFIED:
          acc.disclosureComplete = exchange.type === ExchangeTypes.ISSUING;
          break;
        case ExchangeStates.COMPLETE:
          acc.exchangeComplete = true;
          acc.disclosureComplete = true;
          break;
        case ExchangeStates.NOT_IDENTIFIED:
        case ExchangeStates.UNEXPECTED_ERROR:
          acc.exchangeError = event.state;
          break;
        default:
          break;
      }
      return acc;
    },
    { exchangeComplete: false, disclosureComplete: false },
    exchange.events
  );

module.exports = { buildExchangeProgress };
