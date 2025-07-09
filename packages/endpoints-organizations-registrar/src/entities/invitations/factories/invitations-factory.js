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

const { omit } = require('lodash/fp');
const { register } = require('@spencejs/spence-factories');
const { addWeeks } = require('date-fns/fp');
const invitationsRepoPlugin = require('../repo');

module.exports = (app) =>
  register(
    'invitation',
    invitationsRepoPlugin(app)({ config: app.config }),
    async (overrides) => {
      const overridesResult = overrides();
      const inviteeService =
        overridesResult.inviteeOrganization?.didDoc.service;
      const inviteeProfile = overridesResult.inviteeOrganization?.profile;
      const inviterDid = overridesResult.inviterOrganization?.didDoc.id;

      return {
        inviteeEmail: 'foo@example.com',
        invitationUrl: 'https://someurl.com',
        inviteeService,
        inviteeProfile,
        inviterDid,
        code: '1234567812345678',
        expiresAt: addWeeks(1, new Date()),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'sub-123',
        ...omit(
          ['inviterOrganization', 'inviteeOrganization'],
          overridesResult
        ),
      };
    }
  );
