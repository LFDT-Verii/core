const newError = require('http-errors');
const { isDidUrlWithFragment } = require('@verii/did-doc');
const {
  isIssuingOrInspectionService,
  isCaoService,
} = require('./is-service-category');

const validateCaoServiceRefs = (service, caoServiceRefs) => {
  if (!isDidUrlWithFragment(service.serviceEndpoint)) {
    return;
  }

  const referencedService = caoServiceRefs[service.serviceEndpoint];

  if (
    isIssuingOrInspectionService(service) &&
    !isCaoService(referencedService?.caoService)
  ) {
    throw newError(400, 'Service endpoint is not pointing to CAO', {
      errorCode: 'service_endpoint_ref_not_found',
    });
  }
};

module.exports = { validateCaoServiceRefs };
