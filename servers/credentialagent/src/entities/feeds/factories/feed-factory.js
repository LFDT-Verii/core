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
const { ObjectId } = require('mongodb');
const { feedRepoPlugin } = require('../repos');
const { initTenantFactory } = require('../../tenants');
const { initDisclosureFactory } = require('../../disclosures');

const initFeedFactory = (app) => {
  const initRepo = feedRepoPlugin(app);
  return register('feed', async (overrides, { getOrBuild }) => {
    const tenant = await getOrBuild('tenant', initTenantFactory(app));
    const disclosure = await getOrBuild(
      'disclosure',
      initDisclosureFactory(app)
    );

    return {
      item: {
        vendorUserId: 'fooVendorUserId',
        preauthCode: 'fooPreauthCode',
        disclosureId: new ObjectId(disclosure._id),
        ...overrides(),
      },
      repo: initRepo({
        tenant: { ...tenant, _id: new ObjectId(tenant._id) },
        disclosure: { ...disclosure, _id: new ObjectId(disclosure._id) },
      }),
    };
  });
};

module.exports = { initFeedFactory };
