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

const { filter, flow, includes, map } = require('lodash/fp');
const { NodeServiceCategories } = require('../domains');

const initProvisionAuth0Clients =
  ({ provisionAuth0SystemClient }) =>
  async (organization, services, activatedServiceIds, context) => {
    const {
      log,
      server: { sendError },
    } = context;
    try {
      return await Promise.all(
        flow(
          filter((service) => includes(service.type, NodeServiceCategories)),
          map((nodeService) =>
            provisionAuth0SystemClient(
              organization.didDoc.id,
              organization.profile,
              nodeService,
              activatedServiceIds.includes(nodeService.id)
            )
          )
        )(services)
      );
    } catch (error) {
      const message = 'Error Provisioning Auth0 Apps';
      const messageContext = {
        did: organization.didDoc.id,
        newServices: services,
      };
      log.error({ err: error, ...messageContext }, message);
      sendError(error, { ...messageContext, message });
      return [];
    }
  };

module.exports = {
  initProvisionAuth0Clients,
};
