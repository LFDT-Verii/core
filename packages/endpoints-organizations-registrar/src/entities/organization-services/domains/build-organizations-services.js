const { map, pick } = require('lodash/fp');
const { toRelativeServiceId } = require('@verii/did-doc');

const ImmutableOrganizationServiceProperties = [
  'id',
  'type',
  'invitationId',
  'createdAt',
  'updatedAt',
];

const buildOrganizationServiceForUpdate = (updates, existingService) => {
  return {
    ...updates,
    ...pick(ImmutableOrganizationServiceProperties, existingService),
  };
};

const buildOrganizationService = (service, invitation) => {
  const organizationService = {
    ...service,
    id: toRelativeServiceId(service.id),
  };
  if (invitation != null) {
    // eslint-disable-next-line better-mutation/no-mutation
    organizationService.invitationId = invitation._id;
  }
  return organizationService;
};

const buildOrganizationServices = (services, invitation) =>
  map((service) => buildOrganizationService(service, invitation), services);

module.exports = {
  buildOrganizationServices,
  buildOrganizationService,
  buildOrganizationServiceForUpdate,
};
