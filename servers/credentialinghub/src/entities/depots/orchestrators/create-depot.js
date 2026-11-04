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
const { ObjectId } = require('mongodb');
const newError = require('http-errors');
const {
  isInternalVpAuth,
} = require('../../issuer-services/domain/is-internal-vp-auth');
const {
  buildAuthMatchValues,
  DepotErrors,
  validateDepot,
} = require('../domain');

const createDepot = async (newDepot, serviceId, context) => {
  const { repos } = context;
  const issuerService = await repos.issuerServices.findOne({
    filter: { _id: serviceId },
  });
  const service =
    issuerService ??
    (await repos.relyingPartyServices.findOne({
      filter: { _id: serviceId },
    }));
  validateDepot(newDepot, service);
  const depot = { ...newDepot, serviceId: new ObjectId(serviceId) };
  if (issuerService == null || !isInternalVpAuth(issuerService)) {
    return repos.depots.insert(depot);
  }

  const authMatchValues = buildAuthMatchValues(newDepot.authValues);
  await validateAuthMatchValuesUnused(serviceId, authMatchValues, context);
  return repos.depots.insert({ ...depot, authMatchValues });
};

const validateAuthMatchValuesUnused = async (
  serviceId,
  authMatchValues,
  { repos },
) => {
  const [existingDepot] = await repos.depots.findDepotsByAuthMatchTuples(
    serviceId,
    [authMatchValues],
  );
  if (existingDepot != null) {
    throw newError(409, DepotErrors.AUTH_VALUES_ALREADY_USED, {
      errorCode: DepotErrors.AUTH_VALUES_ALREADY_USED,
      depotId: existingDepot._id.toString(),
    });
  }
};

module.exports = { createDepot };
