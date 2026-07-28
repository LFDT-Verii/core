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
const { isEmpty, map } = require('lodash/fp');
const newError = require('http-errors');
const { TenantErrors } = require('../domain');
const {
  getOperatorCaoDid,
  scopeTenantFilter,
} = require('../domain/operator-tenant-scope');

const deleteTenant = async (tenantId, context) => {
  const { repos } = context;
  const boxedTenantId = new ObjectId(tenantId);
  const tenantFilter = scopeTenantFilter({ _id: boxedTenantId }, context);
  const tenant = await repos.tenants.findOne({ filter: tenantFilter });
  if (tenant == null) {
    throwTenantNotFound(tenantId, context);
  }

  const issuerServices = await repos.issuerServices.find({
    filter: { tenantId: boxedTenantId },
  });

  if (!isEmpty(issuerServices)) {
    throw newError(
      400,
      `Issuer Service(s) ${map('_id')(
        issuerServices,
      )} must be deleted before deleting tenant`,
      {
        errorCode: TenantErrors.RELATED_SERVICE_UNDELETED,
      },
    );
  }
  return Promise.all([
    repos.keys.delUsingFilter({
      filter: { tenantId: boxedTenantId },
    }),
    repos.tenants.delUsingFilter({
      filter: tenantFilter,
    }),
  ]);
};

const throwTenantNotFound = (tenantId, context) => {
  if (getOperatorCaoDid(context) == null) {
    throw new newError.NotFound(`tenant ${tenantId} not found`);
  }
  throw newError(404, 'Tenant not found', {
    errorCode: 'tenant_not_found',
  });
};

module.exports = { deleteTenant };
