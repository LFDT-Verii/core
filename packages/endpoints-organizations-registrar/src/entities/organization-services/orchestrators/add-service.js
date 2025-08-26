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
const { resolveDidWeb } = require('@verii/did-web');
const { omit } = require('lodash/fp');
const { publish } = require('@spencejs/spence-events');
const {
  validateByoDidDocService,
  buildOrganizationService,
  validateAdditionalService,
  buildPublicService,
} = require('../domains');
const { acceptInvitation } = require('../../invitations');
const { loadCaoServiceRefs } = require('./load-cao-service-refs');

const {
  initAddServiceToOrganization,
} = require('./init-add-service-to-organization');

const initAddService = async (fastify) => {
  const addServiceToOrganization = await initAddServiceToOrganization(fastify);

  return async (did, newService, context) => {
    const { repos } = context;
    const organization = await repos.organizations.findOneByDid(did, {
      didDoc: 1,
      profile: 1,
      services: 1,
      ids: 1,
      activatedServiceIds: 1,
      adminEmail: 1,
      didNotCustodied: 1,
      authClients: 1,
    });

    if (organization.didNotCustodied) {
      const byoDidDocument = await resolveDidWeb(organization.didDoc.id);

      const organizationKeys = await repos.organizationKeys.find({
        filter: { organizationId: organization._id },
      });

      validateByoDidDocService(byoDidDocument, newService.id, organizationKeys);
    }
    const invitation = await acceptInvitation(
      newService.invitationCode,
      context
    );
    const newOrganizationService = buildOrganizationService(
      omit(['invitationCode'], newService),
      invitation
    );

    const caoServiceRefs = await loadCaoServiceRefs(
      [newOrganizationService],
      context
    );
    validateAdditionalService(
      newOrganizationService,
      organization.services,
      caoServiceRefs,
      context
    );

    const { authClient, createdService, newActivatedServiceIds } =
      await addServiceToOrganization(
        { organization, newService: newOrganizationService, invitation },
        context
      );

    await publish(
      'services',
      'added',
      {
        organization,
        invitation,
        addedServices: [createdService],
        activatedServiceIds: newActivatedServiceIds,
        caoServiceRefs,
      },
      context
    );

    return {
      service: buildPublicService(createdService),
      authClient,
    };
  };
};

module.exports = {
  initAddService,
};
