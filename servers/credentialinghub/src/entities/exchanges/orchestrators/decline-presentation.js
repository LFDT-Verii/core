/*
 * Copyright 2026 Velocity Team
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
 *
 */
const newError = require('http-errors');
const { some } = require('lodash/fp');
const {
  ExchangeErrors,
  ExchangeProtocols,
  ExchangeStates,
  ExchangeTypes,
  cleanDeclineReason,
} = require('../domain');
const {
  buildPresentationDeclinedEvent,
  enqueueNotificationEvents,
} = require('../../notifications');

// Declining doesn't complete the exchange: the holder can still submit later.
const declinePresentation = async (exchangeId, reason, context) => {
  const exchange = await context.repos.exchanges.addStateUsingFilter(
    {
      _id: exchangeId,
      type: ExchangeTypes.RELYING_PARTY,
      'protocolMetadata.protocol': ExchangeProtocols.VN_API,
      'events.state': {
        $nin: [
          ExchangeStates.PRESENTATION_SUBMISSION_RECEIVED,
          ExchangeStates.PRESENTATION_DECLINED,
        ],
      },
    },
    ExchangeStates.PRESENTATION_DECLINED,
    { declinedAt: new Date(), declineReason: cleanDeclineReason(reason) },
  );

  if (exchange == null) {
    await validateRepeatedDecline(exchangeId, context);
    return;
  }

  await enqueueNotificationEvents(
    () => buildPresentationDeclinedEvent({ tenant: context.tenant, exchange }),
    context,
  );
};

// Nothing was updated. A repeat decline is a no-op; anything else is an error.
const validateRepeatedDecline = async (exchangeId, { repos }) => {
  const exchange = await repos.exchanges.findOne({
    filter: { _id: exchangeId },
  });

  if (exchange == null) {
    throw newError(400, 'Referenced exchange not found', {
      errorCode: ExchangeErrors.REFERENCED_EXCHANGE_NOT_FOUND,
    });
  }

  if (!some({ state: ExchangeStates.PRESENTATION_DECLINED }, exchange.events)) {
    throw newError(400, 'Exchange cannot be declined', {
      errorCode: ExchangeErrors.EXCHANGE_NOT_DECLINABLE,
    });
  }
};

module.exports = { declinePresentation };
