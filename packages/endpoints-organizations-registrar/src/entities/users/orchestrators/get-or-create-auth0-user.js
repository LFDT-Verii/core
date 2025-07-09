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

const { first, isEmpty } = require('lodash/fp');
const { initUserManagement } = require('./user-management');
const { RoleNames, initAuth0Provisioner } = require('../../oauth');
const { initCreateAuth0User } = require('./create-auth0-user');

const initGetOrCreateAuth0User = (fastify) => {
  const createAuth0User = initCreateAuth0User(fastify);
  const { createPasswordChangeTicket } = initAuth0Provisioner(fastify.config);
  const { getUserByEmail } = initUserManagement(fastify.config);

  return async (email, givenName, familyName, req) => {
    const existingUser = first(await getUserByEmail(email));

    if (!isEmpty(existingUser)) {
      if (existingUser.isRegistered) {
        return { user: existingUser };
      }

      const { ticket } = await createPasswordChangeTicket({
        user: existingUser,
        resultUrl: fastify.config.registrarAppUiUrl,
      });

      return { user: existingUser, ticket };
    }

    const { user, ticket } = await createAuth0User(
      {
        userPayload: {
          email,
          givenName,
          familyName,
        },
        registrarRole: RoleNames.RegistrarClientAdmin,
        tokenWalletRole: RoleNames.TokenWalletClientFinanceAdmin,
      },
      req
    );

    return { user, ticket };
  };
};

module.exports = {
  initGetOrCreateAuth0User,
};
