const newError = require('http-errors');
const { ServiceTypes } = require('@verii/organizations-registry');

const buildMessage = (serviceType, fieldName) =>
  `${serviceType} service type requires "${fieldName}"`;

const serviceTypeToRequiredFieldsMap = {
  [ServiceTypes.HolderAppProviderType]: [
    'playStoreUrl',
    'appleAppStoreUrl',
    'appleAppId',
    'googlePlayId',
    'logoUrl',
    'name',
    'supportedExchangeProtocols',
  ],
  [ServiceTypes.WebWalletProviderType]: [
    'logoUrl',
    'name',
    'supportedExchangeProtocols',
  ],
};

const validateServiceFieldsByServiceType = (service = {}) => {
  if (!serviceTypeToRequiredFieldsMap[service.type]) {
    return;
  }
  for (const requiredField of serviceTypeToRequiredFieldsMap[service.type]) {
    if (!service[requiredField]) {
      throw newError(400, buildMessage(service.type, requiredField));
    }
  }
};

module.exports = {
  validateServiceFieldsByServiceType,
};
