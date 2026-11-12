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
const { every, isEmpty, size } = require('lodash/fp');
const { isBefore } = require('date-fns/fp');
const {
  buildAuthMatchValues,
  DepotErrors,
} = require('@verii/credentialing-hub-operator-api');
const {
  isInternalVpAuth,
} = require('../../issuer-services/domain/is-internal-vp-auth');

const validateDepot = (depot, service, isIssuerService) => {
  if (isMissingOrDeactivated(service)) {
    throw newError(400, DepotErrors.REFERENCED_SERVICE_NOT_FOUND, {
      errorCode: DepotErrors.REFERENCED_SERVICE_NOT_FOUND,
    });
  }
  if (isInternalVpAuth(service) && !hasValidAuthValues(depot, service)) {
    throw newError(400, DepotErrors.INVALID_AUTH_VALUES, {
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

// authValues hold exactly one value per rule, at the rule's valueIndex.
const hasValidAuthValues = ({ authValues }, service) =>
  !isEmpty(authValues) &&
  size(authValues) === size(service.verifiablePresentationAuthRules) &&
  every(isPresent, buildAuthMatchValues(authValues));

const isPresent = (value) => value != null && value !== '';

const isMissingOrDeactivated = (service) =>
  service == null ||
  (service.deactivationDate != null &&
    isBefore(new Date(), service.deactivationDate));

module.exports = { validateDepot };
