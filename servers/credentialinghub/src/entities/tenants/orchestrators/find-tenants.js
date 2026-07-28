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
const { scopeTenantFilter } = require('../domain/operator-tenant-scope');

const findTenants = (tenantIds, context) => {
  const identifierFilter = tenantIds == null ? {} : { _id: { $in: tenantIds } };
  const filter = scopeTenantFilter(identifierFilter, context);
  return context.repos.tenants.find({ filter });
};

module.exports = { findTenants };
