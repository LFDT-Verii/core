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
const newError = require('http-errors');
const { findIndex, flow, isEmpty, size, sortBy, zip } = require('lodash/fp');
const {
  DepotErrors,
  isInternalVpAuth,
  isServiceDeactivated,
  isValidAuthValue,
} = require('@verii/credentialing-hub-operator-api');

const validateDepot = (depot, service, isIssuerService) => {
  if (isMissingOrDeactivated(service)) {
    throw newError(400, DepotErrors.REFERENCED_SERVICE_NOT_FOUND, {
      errorCode: DepotErrors.REFERENCED_SERVICE_NOT_FOUND,
    });
  }
  if (
    isInternalVpAuth(service) &&
    !hasValidAuthValues(depot.authValues, service)
  ) {
    throw newError(400, invalidAuthValuesMessage(depot.authValues, service), {
      errorCode: DepotErrors.INVALID_AUTH_VALUES,
    });
  }
  validateDeferredCredentials(depot, isIssuerService);
};

const validateDeferredCredentials = (depot, isIssuerService) => {
  if (depot.deferredCredentials === true && !isIssuerService) {
    throw newError(400, DepotErrors.DEFERRED_CREDENTIALS_NOT_SUPPORTED, {
      errorCode: DepotErrors.DEFERRED_CREDENTIALS_NOT_SUPPORTED,
    });
  }
};

// authValues hold exactly one value per rule, and each value suits the rule at
// its valueIndex: it has the rule's valueType and valueFormat, and isn't blank.
const hasValidAuthValues = (authValues, service) =>
  hasOneValuePerRule(authValues, service) &&
  findInvalidAuthValueIndex(authValues, service) === -1;

const hasOneValuePerRule = (authValues, service) =>
  !isEmpty(authValues) &&
  size(authValues) === size(service.verifiablePresentationAuthRules);

// The index of the first value that doesn't suit the rule at its valueIndex, or
// -1 when they all do. The rules' value indexes are 0 to n-1, so ordering the
// rules by them gives each value's rule.
const findInvalidAuthValueIndex = (authValues, service) => {
  const rulesByValueIndex = sortBy(
    'valueIndex',
    service.verifiablePresentationAuthRules,
  );
  const isInvalidForItsRule = ([rule, value]) => !isValidAuthValue(rule, value);
  const indexOfInvalidValue = flow(
    zip(rulesByValueIndex),
    findIndex(isInvalidForItsRule),
  );
  return indexOfInvalidValue(authValues);
};

// Names an invalid value by its index, never by the value.
const invalidAuthValuesMessage = (authValues, service) => {
  if (!hasOneValuePerRule(authValues, service)) {
    return DepotErrors.INVALID_AUTH_VALUES;
  }
  const index = findInvalidAuthValueIndex(authValues, service);
  return `authValues[${index}] must be a non-blank value of its auth rule's valueType and valueFormat`;
};

const isMissingOrDeactivated = (service) =>
  service == null || isServiceDeactivated(service);

module.exports = { hasValidAuthValues, validateDepot };
