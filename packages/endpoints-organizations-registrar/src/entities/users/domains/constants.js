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

const { VNF_GROUP_ID_CLAIM } = require('../../oauth');

const UserErrorMessages = {
  USER_NOT_FOUND: 'User not found',
  USER_MUST_HAVE_GROUP_CLAIM: ({ user }) =>
    `User ${user?.sub} must have a group claim`,
  USER_INVALID_GROUP_CLAIM: ({ user }) =>
    `User ${user?.sub} has an invalid group claim ${user[VNF_GROUP_ID_CLAIM]}`,
  USER_NOT_GROUP_CLIENT_ADMIN: ({ user, group }) =>
    `User ${user?.sub} must be in clientAdminIds of group ${
      group?.groupId ?? user[VNF_GROUP_ID_CLAIM]
    }`,
  USER_CANNOT_ACCESS_ORGANIZATION_GROUP: ({ user, did, group }) =>
    `User ${user?.sub} (group claim ${user[VNF_GROUP_ID_CLAIM]}) access forbidden to organization ${did} (groupId ${group?.groupId})`,
  MISSING_REQUIRED_SCOPES_TEMPLATE: ({ requiredScopes }) =>
    `User must have one of the following scopes: ${JSON.stringify(
      requiredScopes
    )}`,
  USER_CANNOT_SPECIFY_GROUP_ID: 'User must not contain a "groupId"',
  USER_MUST_SPECIFY_GROUP_ID: 'User must specify a "groupId"',
};

module.exports = { UserErrorMessages };
