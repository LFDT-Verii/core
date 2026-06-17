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
const { hashOffer } = require('@verii/verii-issuing');
const { credentialRepoPlugin } = require('../repo');
const { initTenantFactory } = require('../../tenants');
const { initDepotFactory } = require('../../depots');

const DefaultContent = () => ({
  type: ['Employment'],
  credentialSubject: {
    legalEmployer: { name: 'ExampleEmployer', identifier: 'did:example.com' },
    roleName: 'CEO',
  },
});

const initCredentialFactory = (app) =>
  register(
    'credential',
    credentialRepoPlugin(app)({ config: app.config }),
    async (overrides, { getOrBuild }) => {
      const tenant = await getOrBuild('tenant', initTenantFactory(app));
      const depot = await getOrBuild('depot', initDepotFactory(app));
      const content = await getOrBuild('content', DefaultContent);
      const contentHash = hashOffer(content);
      return {
        credentialReference: 'cred1',
        content,
        contentHash,
        typeMetadata: { credentialType: 'Employment' },
        tenantId: new ObjectId(tenant._id),
        depotId: new ObjectId(depot._id),
        ...overrides(),
      };
    },
  );

module.exports = { initCredentialFactory };
