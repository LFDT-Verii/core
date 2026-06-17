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
  validateReferencedService,
} = require('../../exchanges/domain/validate-referenced-service');
const { LinkErrors } = require('./link-errors');

const validatePresentationLink = (service, serviceId, depotId, depot) => {
  validateReferencedService(service);

  if (depotId != null && !isMatchingDepot(depot, serviceId)) {
    throw newError(400, LinkErrors.referenced_depot_not_found, {
      errorCode: LinkErrors.referenced_depot_not_found,
    });
  }
};

const isMatchingDepot = (depot, serviceId) =>
  depot != null && depot.serviceId?.toString() === serviceId.toString();

module.exports = {
  validatePresentationLink,
};
