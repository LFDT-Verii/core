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
const {
  updateServiceConfiguration,
  validateUpdateServiceConfiguration,
} = require('../../service-configurations');
const {
  buildAuthRulesFingerprint,
} = require('../../depots/domain/auth-rules-fingerprint');
const { validateIssuerService } = require('../domain');

const updateIssuerServiceConfiguration = updateServiceConfiguration(
  'issuerServices',
  validateUpdateServiceConfiguration(validateIssuerService),
);

const updateIssuerService = async (serviceId, service, context) => {
  const existingService = await context.repos.issuerServices.findOne({
    filter: { _id: serviceId },
  });
  const updatedService = await updateIssuerServiceConfiguration(
    serviceId,
    service,
    context,
  );
  await logInvalidatedDepots(
    { serviceId, existingService, updatedService },
    context,
  );
  return updatedService;
};

// Depots created under another auth configuration no longer match. Log how
// many depots an update invalidates, and never fail the update over it.
const logInvalidatedDepots = async (
  { serviceId, existingService, updatedService },
  context,
) => {
  const authRulesFingerprint = buildAuthRulesFingerprint(updatedService);
  if (buildAuthRulesFingerprint(existingService) === authRulesFingerprint) {
    return;
  }
  try {
    const invalidatedDepotCount = await context.repos.depots.count({
      filter: {
        serviceId: new ObjectId(serviceId),
        authRulesFingerprint: { $ne: authRulesFingerprint },
      },
    });
    context.log.info(
      { serviceId, invalidatedDepotCount },
      'Issuer service auth configuration changed. Depots created under the previous configuration no longer match',
    );
  } catch (err) {
    context.log.warn(
      { err, serviceId },
      'Could not count the depots invalidated by an issuer service update',
    );
  }
};

module.exports = { logInvalidatedDepots, updateIssuerService };
