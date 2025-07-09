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

const { vendorRoutesAuthPlugin } = require('../../../plugins');
const {
  secretKeySchema,
  secretKeyMetadataSchema,
  secretNewTenantSchema,
  secretKidSchema,
  modifySecretSchema,
  modifyTenantSchema,
  newTenantSchema,
  newTenantResponse200Schema,
  tenantSchema,
  tenantKeySchema,
  secretTenantKeySchema,
} = require('./schemas');
const { kmsPlugin } = require('../../../plugins/kms-plugin');

module.exports = async (fastify) => {
  fastify
    .register(vendorRoutesAuthPlugin)
    .register(kmsPlugin)
    .decorateRequest('registrarFetch', null)
    .decorateRequest('fetch', null)
    .decorateRequest('vendorFetch', null)
    .decorateRequest('libFetch', null)
    .addHook('preValidation', async (req) => {
      req.registrarFetch = fastify.baseRegistrarFetch(req);
    })
    .addHook('preValidation', async (req) => {
      req.fetch = fastify.baseFetch(req);
    })
    .addHook('preValidation', async (req) => {
      req.vendorFetch = fastify.baseVendorFetch(req);
    })
    .addHook('preValidation', async (req) => {
      req.libFetch = fastify.baseLibFetch(req);
    })
    .addSchema(secretKeySchema)
    .addSchema(secretKeyMetadataSchema)
    .addSchema(secretKidSchema)
    .addSchema(modifySecretSchema)
    .addSchema(modifyTenantSchema)
    .addSchema(newTenantSchema)
    .addSchema(newTenantResponse200Schema)
    .addSchema(secretNewTenantSchema)
    .addSchema(tenantSchema)
    .addSchema(tenantKeySchema)
    .addSchema(secretTenantKeySchema)
    .autoSchemaPreset({ tags: ['tenants'], security: [{ bearerAuth: [] }] });
};
