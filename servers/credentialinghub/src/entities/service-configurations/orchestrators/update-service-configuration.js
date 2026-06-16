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

const { partition } = require('lodash/fp');
const { ObjectId } = require('mongodb');
const { loadTenantDidDoc } = require('../../tenants');
const { canonicalizeServiceConfiguration } = require('../domain');

const updateServiceConfiguration =
  (repoName, validator) => async (serviceId, service, context) => {
    const { tenant, repos } = context;
    const [didDoc, existingServices] = await Promise.all([
      loadTenantDidDoc(tenant.did, context),
      repos[repoName].findServices(),
    ]);
    const [[existingService], otherServices] = partition(
      { _id: new ObjectId(serviceId) },
      existingServices,
    );
    validator({ service, didDoc, existingService, otherServices });

    const finalService = canonicalizeServiceConfiguration(service);
    return repos[repoName].update(serviceId, finalService);
  };

module.exports = { updateServiceConfiguration };
