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

const { newOfferRelatedResourceSchema } = require('@verii/common-schemas');
const {
  tenantLoaderPlugin,
  ensureTenantDefaultIssuingDisclosureIdPlugin,
  groupLoaderPlugin,
} = require('../../../../plugins');

const { newVendorOfferSchema } = require('./offers/schemas');

module.exports = async (fastify) => {
  fastify
    .register(tenantLoaderPlugin)
    .register(ensureTenantDefaultIssuingDisclosureIdPlugin)
    .register(groupLoaderPlugin)
    .addSchema(newOfferRelatedResourceSchema)
    .addSchema(newVendorOfferSchema)
    .autoSchemaPreset({
      params: {
        type: 'object',
        properties: { tenantId: { type: 'string', minLength: 1 } },
        required: ['tenantId'],
      },
    });
};
