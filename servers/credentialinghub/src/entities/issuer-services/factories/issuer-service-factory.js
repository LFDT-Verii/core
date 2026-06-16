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
const { initTenantFactory } = require('../../tenants');
const { issuerServicesRepoPlugin } = require('../repo');

const initIssuerServiceFactory = (app) => {
  const initRepo = issuerServicesRepoPlugin(app);
  return register('issuerService', async (overrides, { getOrBuild }) => {
    const tenant = await getOrBuild('tenant', initTenantFactory(app));
    return {
      item: {
        velocityNetworkServiceId: '#foo-issuer-service-1',
        termsUrl: 'https://www.example.com/terms-of-service',
        authTokensExpireIn: 100000,
        authMethods: ['verifiable_presentation'],
        authMode: 'internal',
        challengesExpireIn: 1000,
        ...overrides(),
      },
      repo: initRepo({
        tenant: { ...tenant, _id: new ObjectId(tenant._id) },
        config: app.config,
      }),
    };
  });
};

module.exports = { initIssuerServiceFactory };
