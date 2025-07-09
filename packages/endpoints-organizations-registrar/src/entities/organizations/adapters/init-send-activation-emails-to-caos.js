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

const { map, isEmpty } = require('lodash/fp');
const { initAuth0Provisioner } = require('../../oauth');
const {
  selectActivatedServices,
} = require('../../organization-services/domains');
const {
  initOrganizationRegistrarEmails,
} = require('./init-organization-registrar-emails');

const initSendActivationEmailsToCAOs = (initCtx) => {
  const { sendEmail, config, sendError } = initCtx;
  const { emailToCAOsForServicesActivation } =
    initOrganizationRegistrarEmails(config);

  const { getUsersByIds } = initAuth0Provisioner(config);

  return async (
    organization,
    services,
    serviceIds = [],
    caoServiceRefs,
    context
  ) => {
    const { repos, log } = context;

    const activatedServices = selectActivatedServices(serviceIds, services);

    const emailRequests = map(async (service) => {
      const caoOrganization =
        caoServiceRefs?.[service.serviceEndpoint]?.caoOrganization;
      if (isEmpty(caoOrganization)) {
        return;
      }

      const group = await repos.groups.findGroupByDid(
        caoOrganization.didDoc.id
      );
      if (isEmpty(group?.clientAdminIds)) {
        return;
      }

      const emails = map(
        'email',
        await getUsersByIds({ userIds: group?.clientAdminIds })
      );

      try {
        await sendEmail(
          emailToCAOsForServicesActivation(
            {
              organization,
              activatedService: service,
              emails,
            },
            context
          )
        );
      } catch (e) {
        sendError(e, { message: e.message });
        log.warn(
          `Unable to send email for organization ${organization?.didDoc?.id} service ${service?.id}`
        );
      }
    }, activatedServices);

    await Promise.all(emailRequests);
  };
};

module.exports = {
  initSendActivationEmailsToCAOs,
};
