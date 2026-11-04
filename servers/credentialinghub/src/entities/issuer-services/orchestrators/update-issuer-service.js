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
const { ObjectId } = require('mongodb');
const newError = require('http-errors');
const {
  updateServiceConfiguration,
  validateUpdateServiceConfiguration,
} = require('../../service-configurations');
const {
  IssuerServicesErrors,
  validateIssuerService,
  vpAuthRulesChanged,
} = require('../domain');

const updateIssuerServiceConfiguration = updateServiceConfiguration(
  'issuerServices',
  validateUpdateServiceConfiguration(validateIssuerService),
);

const updateIssuerService = async (serviceId, service, context) => {
  await validateVpAuthRulesNotInUse(serviceId, service, context);
  return updateIssuerServiceConfiguration(serviceId, service, context);
};

// A depot's authMatchValues follow the rules' positions. New rules would read
// existing depots differently, and could match them to another holder, so
// the rules can't change while the service has depots.
const validateVpAuthRulesNotInUse = async (serviceId, service, { repos }) => {
  const existingService = await repos.issuerServices.findOne({
    filter: { _id: serviceId },
  });
  if (
    existingService == null ||
    !vpAuthRulesChanged(existingService, service)
  ) {
    return;
  }
  const depot = await repos.depots.findOne({
    filter: { serviceId: new ObjectId(serviceId) },
  });
  if (depot != null) {
    throw newError(409, IssuerServicesErrors.SERVICE_VP_AUTH_RULES_IN_USE, {
      errorCode: IssuerServicesErrors.SERVICE_VP_AUTH_RULES_IN_USE,
    });
  }
};

module.exports = { updateIssuerService };
