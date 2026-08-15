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
 */

const newError = require('http-errors');
const { ObjectId } = require('mongodb');
const { loadTenantProfile } = require('../adapters');
const { TenantErrors, validateNewTenant } = require('../domain');
const { scopeTenantFilter } = require('../domain/operator-tenant-scope');

const updateTenant = async (tenantId, tenant, context) => {
  const tenantFilter = scopeTenantFilter(
    { _id: new ObjectId(tenantId) },
    context,
  );
  const existingTenant = await context.repos.tenants.findOne({
    filter: tenantFilter,
  });
  if (existingTenant == null) {
    throwTenantNotFound();
  }

  const orgProfile = await loadTenantProfile(existingTenant.did, context);
  validateNewTenant(tenant, orgProfile);

  return context.repos.tenants.update(existingTenant._id, tenant);
};

const throwTenantNotFound = () => {
  throw newError(404, TenantErrors.TENANT_NOT_FOUND, {
    errorCode: TenantErrors.TENANT_NOT_FOUND,
  });
};

module.exports = { updateTenant };
