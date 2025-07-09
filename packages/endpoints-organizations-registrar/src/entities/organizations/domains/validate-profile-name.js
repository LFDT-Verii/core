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

const newError = require('http-errors');
const { normalizeProfileName } = require('./profile-name-normalization');
const { hasAdminOrganizationScope } = require('../../oauth');

const validateProfileName = async (name, organization, { repos, user }) => {
  const normalizedProfileName = normalizeProfileName(name);

  if (organization != null) {
    if (normalizedProfileName === organization.normalizedProfileName) {
      return;
    }

    if (!hasAdminOrganizationScope(user)) {
      throw newError(400, 'Name change forbidden', {
        errorCode: 'name_change_forbidden',
      });
    }
  }

  const count = await repos.organizations.count({
    filter: { normalizedProfileName },
  });

  if (count > 0) {
    throw newError(400, 'Organization name already exists', {
      errorCode: 'name_change_forbidden',
    });
  }
};

module.exports = { validateProfileName };
