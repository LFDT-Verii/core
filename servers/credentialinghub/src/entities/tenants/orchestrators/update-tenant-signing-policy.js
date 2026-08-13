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
const {
  resolveCredentialSigningAlgorithm,
  TenantErrors,
} = require('../domain');
const { scopeTenantFilter } = require('../domain/operator-tenant-scope');

const updateTenantSigningPolicy = async (
  tenantId,
  credentialSigningAlgorithm,
  expectedUpdatedAt,
  context,
) => {
  if (credentialSigningAlgorithm != null) {
    resolveCredentialSigningAlgorithm({
      tenant: { credentialSigningAlgorithm },
    });
  }

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

  const updatedAt = new Date(
    Math.max(Date.now(), new Date(existingTenant.updatedAt).getTime() + 1),
  );
  const updatedTenant = await context.repos.tenants.updateSigningPolicy({
    auditEvent: buildSigningPolicyAuditEvent(
      existingTenant,
      credentialSigningAlgorithm,
      updatedAt,
      context,
    ),
    credentialSigningAlgorithm,
    filter: {
      ...tenantFilter,
      updatedAt: new Date(expectedUpdatedAt),
    },
    updatedAt,
  });
  if (updatedTenant == null) {
    throw newError(409, TenantErrors.TENANT_UPDATE_CONFLICT, {
      errorCode: TenantErrors.TENANT_UPDATE_CONFLICT,
    });
  }
  return updatedTenant;
};

const buildSigningPolicyAuditEvent = (
  existingTenant,
  credentialSigningAlgorithm,
  timestamp,
  context,
) => ({
  actor: {
    authenticationMethod:
      context.operatorPrincipal.authenticationMethod ?? null,
    caoDid: context.operatorPrincipal.caoDid,
    subject: context.operatorPrincipal.subject ?? null,
    subjectType: context.operatorPrincipal.subjectType ?? null,
  },
  credentialSigningAlgorithm,
  previousCredentialSigningAlgorithm:
    existingTenant.credentialSigningAlgorithm ?? null,
  timestamp,
  type: 'credential_signing_algorithm_updated',
});

const throwTenantNotFound = () => {
  throw newError(404, TenantErrors.TENANT_NOT_FOUND, {
    errorCode: TenantErrors.TENANT_NOT_FOUND,
  });
};

module.exports = { updateTenantSigningPolicy };
