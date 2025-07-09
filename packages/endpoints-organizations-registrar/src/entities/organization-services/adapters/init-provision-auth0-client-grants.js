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

const { find, map, isEmpty } = require('lodash/fp');

const initProvisionAuth0ClientGrants =
  ({ provisionAuth0SystemClientGrants }) =>
  async (organization, activatedServiceIds = []) => {
    const { authClients, services } = organization;
    return Promise.all(
      map(async (authClient) => {
        if (
          !activatedServiceIds.includes(authClient.serviceId) ||
          !isEmpty(authClient.clientGrantIds)
        ) {
          return authClient;
        }

        const service = find({ id: authClient.serviceId }, services);
        const clientGrant = await provisionAuth0SystemClientGrants(
          authClient.clientId,
          service?.type
        );

        return { ...authClient, clientGrantIds: [clientGrant.id] };
      }, authClients)
    );
  };

module.exports = { initProvisionAuth0ClientGrants };
