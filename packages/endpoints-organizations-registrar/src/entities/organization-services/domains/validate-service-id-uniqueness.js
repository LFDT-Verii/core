const newError = require('http-errors');
const { find } = require('lodash/fp');
const {
  OrganizationRegistryErrorMessages,
} = require('@verii/organizations-registry');

const validateServiceIdUniqueness = (newService, existingServices = []) => {
  const matchingService = find({ id: newService.id }, existingServices);

  if (matchingService != null) {
    throw newError.BadRequest(
      OrganizationRegistryErrorMessages.SERVICE_ID_ALREADY_EXISTS,
    );
  }
};

module.exports = {
  validateServiceIdUniqueness,
};
