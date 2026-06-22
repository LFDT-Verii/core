/*
 * Copyright 2024 Velocity Team
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
const { split } = require('lodash/fp');
const newError = require('http-errors');
const { isPreauthCodeAuth } = require('../../links');
const {
  ExchangeErrors,
  ExchangeStates,
  validatePreauth,
  validateReferencedService,
} = require('../domain');

const authenticate = async (exchangeId, authJwtPayload, context) => {
  const { repos } = context;
  const exchange = await repos.exchanges.addState(
    exchangeId,
    ExchangeStates.AUTHENTICATION_REQUEST,
    {
      disclosureConsentedAt: new Date(),
    },
  );
  const issuerService = await repos.issuerServices.findOne({
    filter: { _id: exchange.serviceId },
  });

  validateReferencedService(issuerService);
  if (!isPreauthCodeAuth(issuerService)) {
    throw newError(400, ExchangeErrors.AUTHENTICATION_METHOD_UNSUPPORTED, {
      errorCode: ExchangeErrors.AUTHENTICATION_METHOD_UNSUPPORTED,
    });
  }
  const depot = await preauthCodeAuthHandler(authJwtPayload, context);

  const authenticatedExchange = await repos.exchanges.addState(
    exchangeId,
    ExchangeStates.AUTHENTICATION_SUCCESS,
    { depotId: depot._id },
  );

  return [issuerService, authenticatedExchange];
};

const preauthCodeAuthHandler = async ({ vendorOriginContext }, context) => {
  const { repos } = context;
  const preauthCodeParts = split(':', vendorOriginContext);
  const depot = await repos.depots.findOne({
    filter: { _id: preauthCodeParts?.[1] },
  });
  validatePreauth(preauthCodeParts?.[2], depot, context);
  return depot;
};

module.exports = { authenticate };
