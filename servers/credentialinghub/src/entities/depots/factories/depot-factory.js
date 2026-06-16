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

const { register } = require('@spencejs/spence-factories');
const { nanoid } = require('nanoid');
const { ObjectId } = require('mongodb');
const { calcSha384 } = require('@verii/crypto');
const { depotRepoPlugin } = require('../repo');
const { initTenantFactory } = require('../../tenants');
const { initIssuerServiceFactory } = require('../../issuer-services');

const initDepotFactory = (app) =>
  register(
    'depot',
    depotRepoPlugin(app)({ config: app.config }),
    async (overrides, { getOrBuild }) => {
      const tenant = await getOrBuild('tenant', initTenantFactory(app));
      const service = await getOrBuild(
        'service',
        initIssuerServiceFactory(app),
      );
      const preauthCode = await getOrBuild('preauthCode', () => undefined);
      const depot = {
        tenantId: new ObjectId(tenant._id),
        serviceId: new ObjectId(service._id),
        preauthCodeHash:
          preauthCode != null ? calcSha384(preauthCode) : undefined,
        ...overrides(),
      };
      if (service.authMode) {
        depot.userReference = nanoid();
      }
      return depot;
    },
  );

module.exports = { initDepotFactory };
