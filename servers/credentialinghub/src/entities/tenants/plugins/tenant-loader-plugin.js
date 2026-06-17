/**
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
 */

const fp = require('fastify-plugin');
const newError = require('http-errors');

const extractTenantId = (req) => {
  if (req.params.tenantId != null) {
    return req.params.tenantId;
  }
  if (req.query.tenantId != null) {
    return req.query.tenantId;
  }
  if (req.body.tenantId != null) {
    return req.body.tenantId;
  }
  return null;
};

const loadTenant = async (options, req) => {
  const tenantId = extractTenantId(req);
  if (tenantId == null) {
    throwTenantNotFound(options);
  }

  const filter = options.useDID ? { did: tenantId } : { _id: tenantId };
  const tenant = await req.repos.tenants.findOne({ filter });
  if (tenant == null) {
    throwTenantNotFound(options);
  }
  return tenant;
};

const tenantLoaderPlugin = async (fastify, options = { useDID: false }) => {
  fastify.decorateRequest('tenant', null);
  fastify.addHook('preHandler', async (req) => {
    req.tenant = await loadTenant(options, req);
  });
};

const throwTenantNotFound = ({ notFoundStatusCode = 404 }) => {
  throw newError(notFoundStatusCode, 'Tenant not found', {
    errorCode: 'tenant_not_found',
  });
};

module.exports = {
  tenantLoaderPlugin: fp(tenantLoaderPlugin, {
    name: 'tenant-loader-plugin',
  }),
};
