/*
 * Copyright 2025 Velocity Team
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
const { ObjectId } = require('mongodb');
const newError = require('http-errors');
const { map, split, startsWith } = require('lodash/fp');
const {
  ExchangeErrors,
  ExchangeTypes,
  ExchangeProtocols,
  ExchangeStates,
  buildPresentationRequest,
  validateMessagingSettings,
} = require('../domain');
const { fetchCredentialTypeDescriptors } = require('../../credential-types');
const {
  validateReferencedService,
} = require('../domain/validate-referenced-service');

const getPresentationRequest = async (
  serviceId,
  locale,
  messagingSettings,
  vendorOriginContext,
  context,
) => {
  const { repos, tenant } = context;

  // load issuer service
  const relyingPartyService = await repos.relyingPartyServices.findOne({
    filter: { _id: serviceId },
  });

  validateMessagingSettings(messagingSettings);
  validateReferencedService(relyingPartyService);

  const depot = await loadDepot(serviceId, vendorOriginContext, context);

  // setup exchange
  const newExchange = {
    type: ExchangeTypes.RELYING_PARTY,
    serviceId: new ObjectId(serviceId),
    protocolMetadata: {
      protocol: ExchangeProtocols.VN_API,
    },
    locale,
    messagingSettings,
    depotId: depot._id,
  };

  const exchange = await repos.exchanges.insertWithInitialState(newExchange, [
    ExchangeStates.PRESENTATION_REQUEST_REQUESTED,
  ]);
  // eslint-disable-next-line better-mutation/no-mutation
  context.exchange = exchange; // added onto the request for the exchange error handler

  const inputDescriptors = await fetchCredentialTypeDescriptors(
    map('type', relyingPartyService?.disclosureRequest?.types),
    false,
    undefined,
    context,
  );

  return buildPresentationRequest(
    tenant,
    relyingPartyService,
    exchange,
    inputDescriptors,
  );
};

const loadDepot = async (serviceId, vendorOriginContext, context) => {
  const depotId = parseDepotId(vendorOriginContext);
  if (depotId == null) {
    return context.repos.depots.insert({
      serviceId: new ObjectId(serviceId),
    });
  }

  const depot = await context.repos.depots.findOne({
    filter: { _id: depotId },
  });
  if (!isMatchingDepot(depot, serviceId)) {
    throw newError(400, ExchangeErrors.REFERENCED_DEPOT_NOT_FOUND, {
      errorCode: ExchangeErrors.REFERENCED_DEPOT_NOT_FOUND,
    });
  }
  return depot;
};

const parseDepotId = (vendorOriginContext) => {
  if (!startsWith('depot:', vendorOriginContext)) {
    return undefined;
  }
  return split(':', vendorOriginContext)[1];
};

const isMatchingDepot = (depot, serviceId) =>
  depot != null && depot.serviceId?.toString() === serviceId.toString();

module.exports = { getPresentationRequest };
