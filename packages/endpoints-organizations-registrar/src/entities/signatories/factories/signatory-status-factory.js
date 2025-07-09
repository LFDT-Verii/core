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

const { ObjectId } = require('mongodb');
const initOrganizationFactory = require('../../organizations/factories/organizations-factory');
const { SignatoryEventStatus } = require('../../index');
const signatoryStatusPlugin = require('../repos/repo');

module.exports = (app) =>
  register(
    'signatoryStatus',
    signatoryStatusPlugin(app)({ config: app.config }),
    async (overrides, { getOrBuild }) => {
      const organization = await getOrBuild(
        'organization',
        initOrganizationFactory(app)
      );

      return {
        organizationDid: organization.didDoc.id,
        organizationId: new ObjectId(organization._id),
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: new Date(),
          },
        ],
        authCodes: [
          {
            code: '12345',
            timestamp: new Date(),
          },
        ],
        ...overrides(),
      };
    }
  );
