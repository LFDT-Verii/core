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
const { tenantRepoPlugin } = require('../repos');

const initTenantFactory = (app) =>
  register(
    'tenant',
    tenantRepoPlugin(app)({ config: app.config }),
    (overrides) => {
      const didSuffix = Array(40)
        .fill(0)
        .map(() => Math.random().toString(36).charAt(2))
        .join('');
      return {
        did: `did:velocity:${didSuffix}`,
        primaryAddress: `0x${didSuffix}`,
        ...overrides(),
      };
    }
  );

module.exports = { initTenantFactory };
