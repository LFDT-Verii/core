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

const { addServiceToDidDoc } = require('@verii/did-doc');
const { concat, first, isEmpty } = require('lodash/fp');
const { createStakesAccount } = require('@verii/fineract-client');
const { initAuth0Provisioner } = require('../../oauth');
const {
  initBuildOrganizationModificationsOnServiceChange,
} = require('../../organizations/domains');
const {
  initProvisionAuth0Clients,
  updateBlockchainPermissionsFromPermittedServices,
} = require('../adapters');
const {
  activateServices,
  isNewNodeOperatorService,
  getServiceConsentType,
} = require('../domains');

const initAddServiceToOrganization = async (fastify) => {
  const auth0Provisioner = await initAuth0Provisioner(fastify.config);
  const provisionAuth0Clients = initProvisionAuth0Clients(auth0Provisioner);

  const buildOrganizationModificationsOnServiceChange =
    initBuildOrganizationModificationsOnServiceChange(fastify);

  return async ({ organization, newService }, context) => {
    const { repos, user, config } = context;

    const createdService = await repos.organizations.addService(
      organization._id,
      newService
    );

    if (!organization.didNotCustodied) {
      const { didDoc } = addServiceToDidDoc({
        didDoc: organization.didDoc,
        service: newService,
      });

      await repos.organizations.update(organization._id, { didDoc });
    }

    // add consent
    await repos.registrarConsents.registerConsent({
      userId: user.sub,
      organizationId: organization._id,
      type: getServiceConsentType(createdService),
      version: config.serviceConsentVersion,
      serviceId: createdService.id,
    });

    // add stakes account
    if (isNewNodeOperatorService(organization, createdService)) {
      const stakesAccountId = await createStakesAccount(
        organization.ids.fineractClientId,
        organization.didDoc.id,
        context
      );

      await context.repos.organizations.update(organization._id, {
        ids: { ...organization.ids, stakesAccountId },
      });
    }

    // Get activated services ids
    const newActivatedServiceIds = activateServices(
      organization.didDoc.id,
      [createdService],
      context
    );

    const createdAuthClients = await provisionAuth0Clients(
      organization,
      [createdService],
      newActivatedServiceIds,
      context
    );

    const organizationModifications =
      await buildOrganizationModificationsOnServiceChange({
        organization,
        services: concat(organization.services, [createdService]),
        activatedServiceIds: concat(
          organization.activatedServiceIds ?? [],
          newActivatedServiceIds
        ),
        authClients: concat(organization.authClients ?? [], createdAuthClients),
      });

    const activatedOrganization = await context.repos.organizations.update(
      organization._id,
      organizationModifications,
      {
        _id: 1,
        didDoc: 1,
        profile: 1,
        services: 1,
        activatedServiceIds: 1,
        verifiableCredentialJwt: 1,
        adminEmail: 1,
        ids: 1,
        authClients: 1,
      }
    );

    if (!isEmpty(newActivatedServiceIds)) {
      await updateBlockchainPermissionsFromPermittedServices(
        {
          organization: activatedOrganization,
        },
        context
      );
    }

    return {
      authClient: first(createdAuthClients),
      createdService,
      newActivatedServiceIds,
    };
  };
};

module.exports = {
  initAddServiceToOrganization,
};
