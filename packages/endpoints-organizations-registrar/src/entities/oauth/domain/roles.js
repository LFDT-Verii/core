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

const { reduce, flow, map } = require('lodash/fp');
const { RoleNames } = require('./constants');

const initRoleIdToRoleName = ({
  auth0SuperuserRoleId,
  auth0ClientAdminRoleId,
  auth0ClientFinanceAdminRoleId,
  auth0ClientSystemUserRoleId,
}) => {
  return (roleId) => {
    switch (roleId) {
      case auth0SuperuserRoleId:
        return RoleNames.Superuser;
      case auth0ClientFinanceAdminRoleId:
        return RoleNames.TokenWalletClientFinanceAdmin;
      case auth0ClientSystemUserRoleId:
        return RoleNames.TokenWalletClientSystemUser;
      case auth0ClientAdminRoleId:
      default:
        return RoleNames.RegistrarClientAdmin;
    }
  };
};

const roleObjMapping = {
  registrarRole: {
    [RoleNames.RegistrarClientAdmin]: true,
    [RoleNames.Superuser]: true,
  },
  tokenWalletRole: {
    [RoleNames.TokenWalletClientFinanceAdmin]: true,
    [RoleNames.TokenWalletClientSystemUser]: true,
  },
};

const roleNamesToRoleObj = (roleNames) => {
  return reduce(
    (roleObj, currentRoleName) => {
      return {
        registrarRole: roleObjMapping.registrarRole[currentRoleName]
          ? currentRoleName
          : roleObj.registrarRole,
        tokenWalletRole: roleObjMapping.tokenWalletRole[currentRoleName]
          ? currentRoleName
          : roleObj.tokenWalletRole,
      };
    },
    {
      registrarRole: undefined,
      tokenWalletRole: undefined,
    },
    roleNames
  );
};

const initAuth0RoleArrToRolesObj = ({
  auth0SuperuserRoleId,
  auth0ClientAdminRoleId,
  auth0ClientFinanceAdminRoleId,
  auth0ClientSystemUserRoleId,
}) => {
  const roleIdToRoleName = initRoleIdToRoleName({
    auth0SuperuserRoleId,
    auth0ClientAdminRoleId,
    auth0ClientFinanceAdminRoleId,
    auth0ClientSystemUserRoleId,
  });
  return flow(map('id'), map(roleIdToRoleName), roleNamesToRoleObj);
};

module.exports = {
  initRoleIdToRoleName,
  roleNamesToRoleObj,
  initAuth0RoleArrToRolesObj,
};
