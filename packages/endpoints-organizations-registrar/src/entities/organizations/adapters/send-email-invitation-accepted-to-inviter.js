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

const { map, isEmpty, compact, flow } = require('lodash/fp');
const { initAuth0Provisioner } = require('../../oauth');
const {
  initOrganizationRegistrarEmails,
} = require('./init-organization-registrar-emails');

const mergeCaoServices = async (addedServices, caoServiceRefs) => {
  return flow(
    map((service) => {
      const caoService = caoServiceRefs[service.serviceEndpoint]?.caoService;
      return isEmpty(caoService) ? null : { ...service, caoService };
    }),
    compact
  )(addedServices);
};

const initSendEmailInvitationAcceptedToInviter = (fastify) => {
  const { sendEmail } = fastify;
  const { getUsersByIds } = initAuth0Provisioner(fastify.config);
  const { emailToGroupForInvitationAccepted } = initOrganizationRegistrarEmails(
    fastify.config
  );

  return async (data, context) => {
    const { repos } = context;
    const { invitation, organization, addedServices, caoServiceRefs } = data;
    if (isEmpty(invitation)) {
      return;
    }

    const services = await mergeCaoServices(addedServices, caoServiceRefs);
    if (isEmpty(services)) {
      return;
    }

    const group = await repos.groups.findGroupByDid(invitation.inviterDid);
    if (isEmpty(group?.clientAdminIds)) {
      return;
    }
    const emails = map(
      'email',
      await getUsersByIds({ userIds: group.clientAdminIds })
    );

    await sendEmail(
      emailToGroupForInvitationAccepted({ organization, services, emails })
    );
  };
};

module.exports = {
  initSendEmailInvitationAcceptedToInviter,
};
