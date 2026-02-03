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
const {
  toRelativeServiceId,
  removeServiceFromDidDoc,
} = require('@verii/did-doc');
const { remove, pull, partition, first } = require('lodash/fp');
const newError = require('http-errors');
const {
  updateBlockchainPermissionsFromPermittedServices,
} = require('../adapters');
const {
  initBuildOrganizationModificationsOnServiceChange,
} = require('../../organizations/domains');
const { removeMonitor } = require('../../monitors');
const { initAuth0Provisioner } = require('../../oauth');

const initDeleteService = async (fastify) => {
  const { removeAuth0Client } = await initAuth0Provisioner(fastify.config);
  const buildOrganizationModificationsOnServiceChange =
    initBuildOrganizationModificationsOnServiceChange(fastify);

  return async (did, serviceId, context) => {
    const { repos, log, sendError } = context;

    const organization = await repos.organizations.findOneByDid(did, {
      didDoc: 1,
      services: 1,
      activatedServiceIds: 1,
      authClients: 1,
      didNotCustodied: 1,
    });

    const relativeServiceId = toRelativeServiceId(serviceId);
    const services = remove({ id: relativeServiceId }, organization.services);
    if (services.length === organization.services.length) {
      throw new newError.NotFound(
        `Service ${relativeServiceId} was not found in organization ${organization.didDoc.id}`,
      );
    }

    let updatedOrganization = await repos.organizations.update(
      organization._id,
      {
        services,
      },
    );

    if (!organization.didNotCustodied) {
      const { didDoc } = removeServiceFromDidDoc({
        didDoc: organization.didDoc,
        serviceId: relativeServiceId,
      });
      updatedOrganization = await repos.organizations.update(organization._id, {
        didDoc,
      });
    }

    // Update Profile
    const activatedServiceIds = pull(
      relativeServiceId,
      organization.activatedServiceIds,
    );

    const organizationModifications =
      await buildOrganizationModificationsOnServiceChange({
        organization: updatedOrganization,
        activatedServiceIds,
      });

    const updatedOrganizationWithRemovedService =
      await repos.organizations.update(
        organization._id,
        organizationModifications,
      );

    await updateBlockchainPermissionsFromPermittedServices(
      {
        organization: updatedOrganizationWithRemovedService,
      },
      context,
    );

    // Update Auth0
    log.info(
      {
        relativeServiceId,
        authClients: organization.authClients,
        oldServices: organization.services,
        newServices: updatedOrganization.services,
      },
      'Updating "authClients"',
    );
    const [authClientsToDelete, remainingAuthClients] = partition(
      { serviceId: relativeServiceId },
      organization.authClients,
    );

    try {
      log.info({ authClientsToDelete }, 'Removing authClient');
      await removeAuth0Client(first(authClientsToDelete));
      await repos.organizations.update(organization._id, {
        authClients: remainingAuthClients,
      });
    } catch (error) {
      const message = 'Error Provisioning Auth0 Apps';
      const messageContext = { authClientsToDelete };
      log.error({ err: error, ...messageContext }, message);
      sendError(error, messageContext);
    }

    try {
      await removeMonitor(
        {
          orgId: organization.didDoc.id,
          serviceId: relativeServiceId,
        },
        context,
      );
    } catch (error) {
      const message = 'Failed to remove organization service monitor';
      log.error({ err: error }, message);
      sendError(error, { message });
    }
  };
};

module.exports = { initDeleteService };
