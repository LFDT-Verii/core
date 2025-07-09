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

const {
  tenantLoaderPlugin,
  kmsPlugin,
  groupLoaderPlugin,
  ensureTenantPrimaryAddressPlugin,
} = require('../../plugins');

module.exports = async (fastify) =>
  fastify
    .register(tenantLoaderPlugin)
    .register(ensureTenantPrimaryAddressPlugin)
    .register(kmsPlugin)
    .register(groupLoaderPlugin)
    .decorateRequest('vendorFetch', null)
    .decorateRequest('universalResolverFetch', null)
    .decorateRequest('registrarFetch', null)
    .decorateRequest('fetch', null)
    .decorateRequest('libFetch', null)
    .addHook('preValidation', async (req) => {
      req.vendorFetch = fastify.baseVendorFetch(req);
    })
    .addHook('preValidation', async (req) => {
      req.universalResolverFetch = fastify.baseUniversalResolverFetch(req);
    })
    .addHook('preValidation', async (req) => {
      req.registrarFetch = fastify.baseRegistrarFetch(req);
    })
    .addHook('preValidation', async (req) => {
      req.fetch = fastify.baseFetch(req);
    })
    .addHook('preValidation', async (req) => {
      req.libFetch = fastify.baseLibFetch(req);
    })
    .autoSchemaPreset({
      params: {
        type: 'object',
        properties: { organizationDID: { type: 'string' } },
      },
    });
