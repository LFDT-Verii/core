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

const modifySecretSchema = require('./modify-secret.schema.json');
const secretKeySchema = require('./secret-key.schema.json');
const secretKeyMetadataSchema = require('./secret-key-metadata.schema.json');
const secretKidSchema = require('./secret-kid.schema.json');
const newTenantSchema = require('./new-tenant-v0.8.schema.json');
const newTenantResponse200Schema = require('./new-tenant.response.200.schema.json');
const modifyTenantSchema = require('./modify-tenant-v0.8.schema.json');
const secretNewTenantSchema = require('./secret-new-tenant-v0.8.schema.json');
const tenantSchema = require('./tenant-v0.8.schema.json');
const tenantKeySchema = require('./tenant-key-v0.8.schema.json');
const secretTenantKeySchema = require('./secret-tenant-key-v0.8.schema.json');

module.exports = {
  modifySecretSchema,
  secretKeySchema,
  secretKeyMetadataSchema,
  secretKidSchema,
  newTenantSchema,
  newTenantResponse200Schema,
  modifyTenantSchema,
  secretNewTenantSchema,
  tenantSchema,
  tenantKeySchema,
  secretTenantKeySchema,
};
