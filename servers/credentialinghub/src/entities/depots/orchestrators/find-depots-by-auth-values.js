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
const { findIndex, groupBy, map, size } = require('lodash/fp');
const {
  buildAuthMatchValues,
  DepotErrors,
  ServiceConfigurationErrors,
} = require('@verii/credentialing-hub-operator-api');
const {
  isInternalVpAuth,
} = require('../../issuer-services/domain/is-internal-vp-auth');
const { buildAuthRulesFingerprint, hasValidAuthValues } = require('../domain');

// Finds the depots whose auth values equal each tuple, the way authentication
// and the depots/create 409 match them: normalized, in order, and only under
// the service's current auth configuration. The values are never logged or
// returned, only the request indexes that matched.
const findDepotsByAuthValues = async ({ serviceId, authValues }, context) => {
  const service = await loadVpIssuerService(serviceId, context);
  validateAuthValueTuples(authValues, service);
  const tuples = map(buildAuthMatchValues, authValues);
  const depots = await context.repos.depots.findDepotsByAuthMatchTuples(
    serviceId,
    buildAuthRulesFingerprint(service),
    tuples,
  );
  const matches = buildMatches(tuples, depots);
  context.log.info(
    {
      serviceId,
      tupleCount: size(tuples),
      depotCount: size(depots),
      matchCount: size(matches),
    },
    'find depots by auth values',
  );
  return matches;
};

const loadVpIssuerService = async (serviceId, { repos }) => {
  const service = await repos.issuerServices.findOne({
    filter: { _id: serviceId },
  });
  if (service == null) {
    throw newError(404, `Issuer service ${serviceId} not found`, {
      errorCode: ServiceConfigurationErrors.SERVICE_NOT_FOUND,
    });
  }
  if (!isInternalVpAuth(service)) {
    throw newError(
      400,
      'Only internal verifiable_presentation issuer services match depots by auth values',
      { errorCode: DepotErrors.FIND_BY_AUTH_VALUES_NOT_SUPPORTED },
    );
  }
  return service;
};

// Each tuple is validated as depots/create validates a depot's authValues.
// The error names the first invalid tuple by its index, never by its values.
const validateAuthValueTuples = (authValues, service) => {
  const index = findIndex(
    (tuple) => !hasValidAuthValues(tuple, service),
    authValues,
  );
  if (index !== -1) {
    throw newError(
      400,
      `authValues[${index}] must hold one valid value per auth rule`,
      { errorCode: DepotErrors.INVALID_AUTH_VALUES },
    );
  }
};

// The same key for equal tuples, and different keys for "42" and 42.
const toTupleKey = (tuple) => JSON.stringify(tuple);

// Several request tuples can normalize to the same tuple, and concurrent
// creates can leave more than one depot with the same values. Each index gets
// one match per depot whose values equal its tuple.
const buildMatches = (tuples, depots) => {
  const depotsByTupleKey = groupBy(
    ({ authMatchValues }) => toTupleKey(authMatchValues),
    depots,
  );
  return tuples.flatMap((tuple, index) =>
    map(
      ({ _id, userReference }) => ({
        index,
        depotId: `${_id}`,
        userReference,
      }),
      depotsByTupleKey[toTupleKey(tuple)],
    ),
  );
};

module.exports = { findDepotsByAuthValues };
