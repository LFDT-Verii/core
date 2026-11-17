const newError = require('http-errors');
const {
  ServiceConfigurationErrors,
} = require('@verii/credentialing-hub-operator-api');

const validateUpdateServiceConfiguration =
  (validator) =>
  ({ service, didDoc, existingService, otherServices }) => {
    if (existingService == null) {
      throw newError(400, ServiceConfigurationErrors.SERVICE_NOT_FOUND, {
        errorCode: ServiceConfigurationErrors.SERVICE_NOT_FOUND,
      });
    }
    validator({ service, didDoc, otherServices });
  };

module.exports = {
  validateUpdateServiceConfiguration,
};
