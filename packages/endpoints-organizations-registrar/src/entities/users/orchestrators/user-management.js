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

const { ManagementClient } = require('auth0');
const {
  camelCase,
  flow,
  omitBy,
  isNil,
  map,
  mapKeys,
  pick,
  omit,
} = require('lodash/fp');
const { initAuth0RoleArrToRolesObj } = require('../../oauth');

const initManagementClient = ({ domain, clientId, clientSecret, audience }) => {
  return new ManagementClient({
    audience,
    domain,
    clientId,
    clientSecret,
  });
};

const initUserManagement = ({
  auth0ManagementApiAudience,
  auth0Domain,
  auth0ClientId,
  auth0ClientSecret,
  auth0SuperuserRoleId,
  auth0ClientAdminRoleId,
  auth0ClientFinanceAdminRoleId,
  auth0ClientSystemUserRoleId,
} = {}) => {
  const managementClient = initManagementClient({
    audience: auth0ManagementApiAudience,
    domain: auth0Domain,
    clientId: auth0ClientId,
    clientSecret: auth0ClientSecret,
  });

  const auth0RolesArrToRolesObj = initAuth0RoleArrToRolesObj({
    auth0SuperuserRoleId,
    auth0ClientAdminRoleId,
    auth0ClientFinanceAdminRoleId,
    auth0ClientSystemUserRoleId,
  });

  const softDeleteUser = async ({ id }, context) => {
    const { data: user } = await managementClient.users.get({ id });
    if (isUserAccessPermitted(mapUser(user), context)) {
      await managementClient.users.update(
        { id },
        {
          blocked: true,
        }
      );
    }
  };

  // defaults for dodgy invitations that were created without correct names. See VL-7602
  const defaultUserValues = {
    given_name: '',
    family_name: '',
  };

  const getUser = async ({ id }, context) => {
    const { data: user } = await managementClient.users.get({ id });
    return scopeUser(mapUser(user), context);
  };

  const getUserWithRoles = async ({ id }, context) => {
    const [{ data: user }, roles] = await Promise.all([
      managementClient.users.get({ id }),
      getRolesOfUser({ id, page: 0, perPage: 10 }),
    ]);
    const currentRolesObj = auth0RolesArrToRolesObj(roles);
    return scopeUser(mapUser(user, currentRolesObj), context);
  };

  const getUserByEmail = async (email, context) => {
    const { data: users } = await managementClient.usersByEmail.getByEmail({
      email,
    });
    return map((user) => scopeUser(mapUser(user), context), users);
  };

  const mapUser = (user, otherProps) => {
    const obj = {
      id: user.user_id,
      groupId: user.app_metadata?.groupId,
      isRegistered: user.logins_count > 0,
      ...defaultUserValues,
      ...omit(['user_id', 'app_metadata'], user),
      ...otherProps,
    };
    return flow(omitBy(isNil), mapKeys(camelCase))(obj);
  };

  const scopeUser = (user, context) => {
    if (isUserAccessPermitted(user, context)) {
      return user;
    }

    return pick(
      ['email', 'givenName', 'familyName', 'id', 'isRegistered'],
      user
    );
  };

  const getRolesOfUser = async ({ id, page, perPage }) => {
    const { data: roles } = await managementClient.users.getRoles(
      {
        id,
      },
      {
        page,
        per_page: perPage,
        // sort: 'date:-1',
        // include_totals: true,
      }
    );
    return roles;
  };

  return {
    getUser,
    getUserWithRoles,
    softDeleteUser,
    getUserByEmail,
  };
};

const isUserAccessPermitted = (user, context) =>
  context != null &&
  (context.scope == null ||
    (context.scope?.userId != null && context.scope.userId === user.id) ||
    (context.scope?.groupId != null && context.scope.groupId === user.groupId));

module.exports = {
  initUserManagement,
};
