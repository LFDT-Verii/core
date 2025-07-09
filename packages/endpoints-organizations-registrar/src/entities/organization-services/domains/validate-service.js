const { forEach } = require('lodash/fp');
const { serviceExists } = require('@verii/did-doc');
const newError = require('http-errors');
const { validateServiceType } = require('./validate-service-type');
const { validateServiceEndpoint } = require('./validate-service-endpoint');
const {
  validateServiceCredentialType,
} = require('./validate-service-credential-type');
const {
  validateServiceFieldsByServiceType,
} = require('./validate-service-fields-by-service-type');
const { validateCaoServiceRefs } = require('./validate-cao-service-refs');
const {
  validateServiceKeyPurposes,
} = require('./validate-service-key-purposes');
const {
  validateServiceIdUniqueness,
} = require('./validate-service-id-uniqueness');

const validateService = (service, caoServiceRefs, context) => {
  validateServiceType(service);
  validateServiceEndpoint(service);
  validateServiceCredentialType(service, context);
  validateServiceFieldsByServiceType(service);
  validateCaoServiceRefs(service, caoServiceRefs);
};

const validateServices = (services, caoServiceRefs, context) => {
  forEach(
    (service) => validateService(service, caoServiceRefs, context),
    services
  );
};

const validateAdditionalService = (
  service,
  existingServices,
  caoServiceRefs,
  context
) => {
  validateService(service, caoServiceRefs, context);
  validateServiceIdUniqueness(service, existingServices);
};

const validateInviteeService = (service, caoServiceRefs, context) => {
  try {
    validateServiceType(service);
    validateServiceEndpoint(service, true);
    validateServiceCredentialType(service, context);
    validateCaoServiceRefs(service, caoServiceRefs);
  } catch (error) {
    if (error.errorCode == null) {
      // eslint-disable-next-line better-mutation/no-mutation
      error.errorCode = 'invitee_service_invalid';
    }
    throw error;
  }
};

const validateByoDidDocService = (didDoc, serviceId, keys) => {
  const didDocService = serviceExists(didDoc, serviceId);
  if (didDocService == null) {
    throw newError.BadRequest(`Service with ID ${serviceId} does not exist`, {
      didDoc,
      serviceId,
    });
  }
  validateServiceType(didDocService);
  validateServiceEndpoint(didDocService);
  validateServiceKeyPurposes(didDocService, keys);
  return didDocService;
};

module.exports = {
  validateAdditionalService,
  validateService,
  validateServices,
  validateInviteeService,
  validateByoDidDocService,
};
