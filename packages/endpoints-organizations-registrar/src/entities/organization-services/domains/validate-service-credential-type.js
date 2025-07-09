const newError = require('http-errors');
const { difference, isEmpty } = require('lodash/fp');
const {
  ServiceTypesOfServiceCategory,
  ServiceCategories,
} = require('@verii/organizations-registry');
const { identityCategories } = require('./constants');

const validateServiceCredentialType = (
  newService,
  { registeredCredentialTypes, config: { idCredentialTypes } }
) => {
  const expectedCredentialTypes = computeExpectedCredentialTypes(
    newService.type,
    { registeredCredentialTypes, idCredentialTypes }
  );
  if (expectedCredentialTypes == null) {
    return;
  }

  const unsupportedCredentialTypes = difference(
    newService.credentialTypes,
    expectedCredentialTypes
  );
  if (!isEmpty(unsupportedCredentialTypes)) {
    throw newError.BadRequest(
      `Cannot add issuer that issues unsupported credential types ${unsupportedCredentialTypes}`
    );
  }
};

const computeExpectedCredentialTypes = (
  type,
  { registeredCredentialTypes, idCredentialTypes }
) => {
  if (identityCategories.includes(type)) {
    return idCredentialTypes;
  }
  if (ServiceTypesOfServiceCategory[ServiceCategories.Issuer].includes(type)) {
    return difference(registeredCredentialTypes, idCredentialTypes);
  }
  return undefined;
};

module.exports = {
  validateServiceCredentialType,
};
