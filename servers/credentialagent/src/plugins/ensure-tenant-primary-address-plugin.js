/**
 * Copyright 2023 Velocity Team
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
 */

const fp = require('fastify-plugin');
const { KeyPurposes } = require('@verii/crypto');
const { isEmpty } = require('lodash/fp');
const { addPrimaryAddressToTenant } = require('../entities');

const ensureTenantPrimaryAddressPlugin = (fastify, options, next) => {
  fastify.addHook('preValidation', async (req) => {
    const { tenant, repos } = req;
    if (tenant.primaryAddress) {
      return;
    }
    const key = await repos.keys.findOne({
      filter: {
        purposes: KeyPurposes.DLT_TRANSACTIONS,
      },
    });
    if (isEmpty(key)) {
      return;
    }
    await addPrimaryAddressToTenant(tenant, req);
    req.tenant = await req.repos.tenants.findOne({ _id: tenant._id });
  });
  next();
};

module.exports = {
  ensureTenantPrimaryAddressPlugin: fp(ensureTenantPrimaryAddressPlugin),
};
