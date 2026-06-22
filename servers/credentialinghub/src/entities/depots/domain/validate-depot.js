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
const { isEmpty } = require('lodash/fp');
const { DepotErrors } = require('./depot-errors');

const validateDepot = (depot, service) => {
  if (service == null) {
    throw newError(400, DepotErrors.REFERENCED_SERVICE_NOT_FOUND, {
      errorCode: DepotErrors.REFERENCED_SERVICE_NOT_FOUND,
    });
  }
  if (
    service.authMode === 'internal' &&
    service.authMethods.includes('verifiable_presentation') &&
    isEmpty(depot.authValues)
  ) {
    throw newError(400, DepotErrors.INVALID_AUTH_VALUES, {
      errorCode: DepotErrors.INVALID_AUTH_VALUES,
    });
  }
};

module.exports = { validateDepot };
