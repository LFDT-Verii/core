const { isEmpty } = require('lodash/fp');
const newError = require('http-errors');
const { VendorEndpoint } = require('./constants');
const { DisclosureErrors } = require('./errors');

const validateVendorEndpoint = (disclosure) => {
  const { vendorEndpoint, identityMatchers } = disclosure;

  if (vendorEndpoint !== VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION) {
    return;
  }

  if (isEmpty(identityMatchers)) {
    throw newError(400, DisclosureErrors.IDENTITY_MATCHERS_REQUIRED, {
      errorCode: 'request_validation_failed',
    });
  }
};

module.exports = {
  validateVendorEndpoint,
};
