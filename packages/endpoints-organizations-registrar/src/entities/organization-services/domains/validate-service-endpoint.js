const newError = require('http-errors');
const { isEmpty } = require('lodash/fp');
const { isDidUrlWithFragment } = require('@verii/did-doc');
const { isIssuingOrInspectionService } = require('./is-service-category');

const validateServiceEndpoint = (
  service,
  issuingAndInspectionRequiresCaoServiceRef = false,
  // eslint-disable-next-line complexity
) => {
  if (isEmpty(service.serviceEndpoint)) {
    throw newError(400, 'Service must have a serviceEndpoint', {
      errorCode: 'service_endpoint_required',
    });
  }

  if (isIssuingOrInspectionService(service)) {
    if (isDidUrlWithFragment(service.serviceEndpoint)) {
      return;
    }
    if (issuingAndInspectionRequiresCaoServiceRef) {
      throw newError(400, 'serviceEndpoint must be a did service reference', {
        errorCode: 'service_endpoint_must_be_ref',
      });
    }
  }

  const url = new URL(service.serviceEndpoint);
  if (url.protocol !== 'https:') {
    throw newError(400, 'serviceEndpoint is invalid format', {
      errorCode: 'service_endpoint_invalid',
    });
  }
};

module.exports = { validateServiceEndpoint };
