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
const {
  filter,
  findIndex,
  flow,
  get,
  includes,
  isEmpty,
  isNil,
  map,
  size,
  toLower,
  toString,
} = require('lodash/fp');
const {
  buildAuthMatchValues,
  DepotErrors,
  ServiceConfigurationErrors,
} = require('@verii/credentialing-hub-operator-api');
const {
  isInternalVpAuth,
} = require('../../issuer-services/domain/is-internal-vp-auth');
const { buildAuthRulesFingerprint, hasValidAuthValues } = require('../domain');

// Finds the depots whose auth values equal any of the tuples, the way
// authentication and the depots/create 409 match them: normalized, in order,
// and only under the service's current auth configuration. With depotIds, only
// those depots. Only counts are logged, never the values.
const findDepotsByAuthValues = async (
  { serviceId, depotIds, authValues },
  context,
) => {
  const service = await loadVpIssuerService(serviceId, context);
  validateAuthValueTuples(authValues, service);
  const tuples = map(buildAuthMatchValues, authValues);
  const matchingDepots = await context.repos.depots.findDepotsByAuthMatchTuples(
    serviceId,
    buildAuthRulesFingerprint(service),
    tuples,
  );
  const depots = filterByIds(depotIds, matchingDepots);
  context.log.info(
    { serviceId, tupleCount: size(tuples), depotCount: size(depots) },
    'find depots by auth values',
  );
  return depots;
};

const loadVpIssuerService = async (serviceId, { repos }) => {
  const service = await repos.issuerServices.findOne({
    filter: { _id: serviceId },
  });
  if (isNil(service)) {
    throw newError(404, `Issuer service ${serviceId} not found`, {
      errorCode: ServiceConfigurationErrors.SERVICE_NOT_FOUND,
    });
  }
  if (!isInternalVpAuth(service)) {
    throw newError(
      400,
      'Only internal verifiable_presentation issuer services filter depots by auth values',
      { errorCode: DepotErrors.AUTH_VALUES_FILTER_NOT_SUPPORTED },
    );
  }
  return service;
};

// Each tuple is validated as depots/create validates a depot's authValues.
// The error names the first invalid tuple by its index, never by its values.
const validateAuthValueTuples = (authValues, service) => {
  const isInvalidTuple = (tuple) => !hasValidAuthValues(tuple, service);
  const index = findIndex(isInvalidTuple, authValues);
  if (index !== -1) {
    throw newError(
      400,
      `authValues[${index}] must hold one valid value per auth rule`,
      { errorCode: DepotErrors.INVALID_AUTH_VALUES },
    );
  }
};

const depotIdOf = flow(get('_id'), toString);

// As in the depotId filter of depots/get: no ids means no filter. Ids compare
// as ObjectIds do, whatever the case of their hex digits.
const filterByIds = (depotIds, depots) => {
  if (isEmpty(depotIds)) {
    return depots;
  }
  const listedIds = map(toLower, depotIds);
  const isListedId = (depotId) => includes(depotId, listedIds);
  const isListedDepot = flow(depotIdOf, isListedId);
  return filter(isListedDepot, depots);
};

module.exports = { findDepotsByAuthValues };
