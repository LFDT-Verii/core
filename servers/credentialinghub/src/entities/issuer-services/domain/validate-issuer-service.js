const newError = require('http-errors');
const { isEmpty } = require('lodash/fp');
const {
  validateServiceConfiguration,
} = require('../../service-configurations');
const { IssuerServicesErrors } = require('./issuer-services-errors');

const validateIssuerService = ({ service, didDoc, otherServices }) => {
  if (
    service.authMode === 'internal' &&
    service.authMethods.includes('verifiable_presentation') &&
    isEmpty(service.verifiablePresentationAuthRules)
  ) {
    throw newError(400, IssuerServicesErrors.SERVICE_VP_AUTH_RULES_REQUIRED, {
      errorCode: IssuerServicesErrors.SERVICE_VP_AUTH_RULES_REQUIRED,
    });
  }
  validateServiceConfiguration({ service, didDoc, otherServices });
};

module.exports = {
  validateIssuerService,
};
