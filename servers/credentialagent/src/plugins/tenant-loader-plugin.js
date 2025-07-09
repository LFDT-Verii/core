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

const newError = require('http-errors');
const { ObjectId } = require('mongodb');
const {
  isEmpty,
  flatMap,
  flow,
  fromPairs,
  map,
  startsWith,
} = require('lodash/fp');
const fp = require('fastify-plugin');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { tenantDefaultProjection } = require('../entities');

const buildSearchFilter = ({ tenantId }) => {
  if (isEmpty(tenantId)) {
    throw newError(404, 'Tenant was not specified', {
      errorCode: 'did_not_defined',
    });
  }
  if (startsWith('did:', tenantId)) {
    return { $or: [{ did: tenantId }, { dids: tenantId }] };
  }
  return { _id: new ObjectId(tenantId) };
};

const loadTenant = async (db, params, context) => {
  const searchFilter = buildSearchFilter(params, context);
  const tenant = await db
    .collection('tenants')
    .findOne(searchFilter, tenantDefaultProjection);

  if (isEmpty(tenant)) {
    const { tenantId } = params;
    throw newError(404, `Tenant ${JSON.stringify({ tenantId })} not found`, {
      errorCode: 'tenant_not_found',
    });
  }
  return tenant;
};

const loadTenantKeysByPurpose = async (db, context) => {
  const { tenant } = context;
  const tenantKeysCollection = db.collection('keys');
  const tenantKeys = await tenantKeysCollection
    .find(
      { tenantId: tenant._id },
      { projection: { _id: 1, purposes: 1, kidFragment: 1, publicKey: 1 } }
    )
    .toArray();

  return flow(
    flatMap(({ purposes, _id, kidFragment, publicKey }) => {
      const key = { keyId: _id, kidFragment, publicKey };
      return map((purpose) => [purpose, key], purposes);
    }),
    fromPairs
  )(tenantKeys);
};

const tenantLoaderPlugin = async (fastify) => {
  fastify
    .decorateRequest('tenant', null)
    .decorateRequest('tenantKeysByPurpose', null)
    .addHook('onRequest', async (req) => {
      const db = mongoDb();
      req.tenant = await loadTenant(db, req.params, req);
      req.tenantKeysByPurpose = await loadTenantKeysByPurpose(db, req);
    });
};

module.exports = {
  tenantLoaderPlugin: fp(tenantLoaderPlugin),
  loadTenant,
};
