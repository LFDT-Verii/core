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

const { ObjectId } = require('mongodb');
const { register } = require('@spencejs/spence-factories');
const { initTenantFactory } = require('../../tenants');
const { exchangeRepoPlugin } = require('../repos');
const { ExchangeStates, ExchangeTypes } = require('../domains');

const initDisclosureExchangeFactory = (app) => {
  const initRepo = exchangeRepoPlugin(app);
  return register('disclosureExchange', async (overrides, { getOrBuild }) => {
    const disclosure = await getOrBuild('disclosure', () => null);
    const tenant = await getOrBuild('tenant', initTenantFactory(app));
    const disclosureExchange = {
      type: ExchangeTypes.DISCLOSURE,
      events: [{ state: ExchangeStates.NEW, timestamp: new Date() }],
      tenantId: new ObjectId(tenant._id),
      ...overrides(),
    };

    if (disclosure != null) {
      disclosureExchange.disclosureId = new ObjectId(disclosure._id);
    }

    return {
      item: disclosureExchange,
      repo: initRepo({ tenant: { ...tenant, _id: new ObjectId(tenant._id) } }),
    };
  });
};

module.exports = { initDisclosureExchangeFactory };
