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

const { compact, map, isEmpty } = require('lodash/fp');
const { RoleNames, initAuth0Provisioner } = require('../../oauth');

const initCreateAuth0User = (fastify) => {
  const { createAuth0User, addRoleToAuth0User, createPasswordChangeTicket } =
    initAuth0Provisioner(fastify.config);

  return async (
    { userPayload, registrarRole = null, tokenWalletRole = null, groupId },
    context
  ) => {
    const { tokenWalletBaseUrl, registrarAppUiUrl } = fastify.config;
    const { repos } = context;
    const user = await createAuth0User({ user: userPayload });

    const roles = compact([registrarRole, tokenWalletRole]);

    await Promise.all(
      map((roleName) => addRoleToAuth0User({ user, roleName }), roles)
    );

    if (groupId != null && registrarRole === RoleNames.RegistrarClientAdmin) {
      await repos.groups.addUserToGroupClientAdmins(groupId, user.id);
    }

    const { ticket } = await createPasswordChangeTicket({
      user,
      resultUrl:
        isEmpty(registrarRole) && !isEmpty(tokenWalletRole)
          ? tokenWalletBaseUrl
          : registrarAppUiUrl,
    });

    return {
      user,
      ticket,
    };
  };
};

module.exports = {
  initCreateAuth0User,
};
