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
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const {
  initEncryptPropExtension,
} = require('@verii/spencer-mongo-extensions');

const { tenantDefaultProjection } = require('./tenant-default-projection');
const { insertTenantExtension } = require('./insert-tenant-extension');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'tenants',
      entityName: 'tenant',
      defaultProjection: tenantDefaultProjection,
      extensions: [
        autoboxIdsExtension,
        insertTenantExtension,
        initEncryptPropExtension({
          prop: 'webhookAuth.bearerToken',
          encryptedProp: 'webhookAuth.bearerToken',
          secret: app.config.mongoSecret,
          format: 'string',
        }),
        (parent) => ({
          setDefaultIssuingDisclosure: async (id, disclosureId) =>
            parent.update(id, {
              defaultIssuingDisclosureId: disclosureId,
            }),
        }),
      ],
    },
    app
  );
};
