/*
 * Copyright 2025 Velocity Team
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

const { compact, uniq } = require('lodash/fp');
const { DEFAULT_GROUP_ID } = require('@verii/tests-helpers');
const initOrganizationFactory = require('../../organizations/factories/organizations-factory');
const groupsRepoPlugin = require('../repo');

module.exports = (app) =>
  register(
    'group',
    groupsRepoPlugin(app)({ config: app.config }),
    async (overrides, { getOrBuild }) => {
      const resolvedOverrides = overrides();
      let organization;
      if (!resolvedOverrides.skipOrganization) {
        organization = await getOrBuild(
          'organization',
          initOrganizationFactory(app),
        );
      }

      const groupId = await getOrBuild('groupId', () => DEFAULT_GROUP_ID);

      return {
        groupId,
        dids: uniq(compact([groupId, organization?.didDoc?.id])),
        clientAdminIds: [],
        ...resolvedOverrides,
      };
    },
  );
