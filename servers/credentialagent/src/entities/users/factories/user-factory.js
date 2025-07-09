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
const { userRepoPlugin } = require('../repos');
const { initTenantFactory } = require('../../tenants');

const initUserFactory = (app) => {
  const initRepo = userRepoPlugin(app);

  return register('vendorUserIdMapping', async (overrides, { getOrBuild }) => {
    const tenant = await getOrBuild('tenant', initTenantFactory(app));
    return {
      item: {
        vendorUserId: 'abcdefg123454',
        ...overrides(),
      },
      repo: initRepo({ tenant: { ...tenant, _id: new ObjectId(tenant._id) } }),
    };
  });
};
module.exports = { initUserFactory };
