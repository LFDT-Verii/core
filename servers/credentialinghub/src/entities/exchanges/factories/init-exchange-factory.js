/*
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
 *
 */

const { register } = require('@spencejs/spence-factories');
const { ObjectId } = require('mongodb');
const { initTenantFactory } = require('../../tenants');
const { exchangesRepoPlugin } = require('../repo');
const { ExchangeStates, ExchangeTypes } = require('../domain');
const {
  initIssuerServiceFactory,
} = require('../../issuer-services/factories/issuer-service-factory');
const {
  initRelyingPartyServiceFactory,
} = require('../../relying-party-services/factories/relying-party-service-factory');

const initExchangeFactory = (
  app,
  defaultExchangeType = ExchangeTypes.ISSUER,
) => {
  const initRepo = exchangesRepoPlugin(app);
  return register('exchange', async (overrides, { getOrBuild }) => {
    const service = await getOrBuild(
      'service',
      defaultExchangeType === ExchangeTypes.ISSUER
        ? initIssuerServiceFactory(app)
        : initRelyingPartyServiceFactory(app),
    );
    const tenant = await getOrBuild('tenant', initTenantFactory(app));
    const offerExchange = {
      type: defaultExchangeType,
      events: [{ state: ExchangeStates.NEW, timestamp: new Date() }],
      tenantId: new ObjectId(tenant._id),
      serviceId: new ObjectId(service._id),
      ...overrides(),
    };

    return {
      item: offerExchange,
      repo: initRepo({ tenant: { ...tenant, _id: new ObjectId(tenant._id) } }),
    };
  });
};

module.exports = { initExchangeFactory };
