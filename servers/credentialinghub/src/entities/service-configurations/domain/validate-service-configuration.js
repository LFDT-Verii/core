const newError = require('http-errors');
const { find } = require('lodash/fp');
const {
  ServiceConfigurationErrors,
} = require('./service-configuration-errors');

const validateServiceConfiguration = ({ service, didDoc, otherServices }) => {
  const matchingService = find(
    { id: service.velocityNetworkServiceId },
    didDoc.service,
  );
  if (matchingService == null) {
    throw newError(400, ServiceConfigurationErrors.SERVICE_NOT_MATCHED, {
      errorCode: ServiceConfigurationErrors.SERVICE_NOT_MATCHED,
    });
  }

  const matchingExistingService = find(
    { velocityNetworkServiceId: service.velocityNetworkServiceId },
    otherServices,
  );
  if (matchingExistingService != null) {
    throw newError(400, ServiceConfigurationErrors.SERVICE_MUST_BE_UNIQUE, {
      errorCode: ServiceConfigurationErrors.SERVICE_MUST_BE_UNIQUE,
    });
  }
};

module.exports = {
  validateServiceConfiguration,
};
