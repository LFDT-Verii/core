const newError = require('http-errors');
const { isEmpty, isEqual, map, range, size, sortBy } = require('lodash/fp');
const {
  validateServiceConfiguration,
} = require('../../service-configurations');
const { IssuerServicesErrors } = require('./issuer-services-errors');
const { isInternalVpAuth } = require('./is-internal-vp-auth');

const validateIssuerService = ({ service, didDoc, otherServices }) => {
  if (isInternalVpAuth(service)) {
    validateVpAuthRules(service.verifiablePresentationAuthRules);
  }
  validateServiceConfiguration({ service, didDoc, otherServices });
};

const validateVpAuthRules = (rules) => {
  if (isEmpty(rules)) {
    throw newError(400, IssuerServicesErrors.SERVICE_VP_AUTH_RULES_REQUIRED, {
      errorCode: IssuerServicesErrors.SERVICE_VP_AUTH_RULES_REQUIRED,
    });
  }
  if (!hasOneRulePerPosition(rules)) {
    throw newError(400, IssuerServicesErrors.SERVICE_VP_AUTH_RULES_INVALID, {
      errorCode: IssuerServicesErrors.SERVICE_VP_AUTH_RULES_INVALID,
    });
  }
};

// A depot's authValues hold one value per rule, so the rules' value indexes
// must be exactly 0 to n-1.
const hasOneRulePerPosition = (rules) =>
  isEqual(range(0, size(rules)), sortBy(Number, map('valueIndex', rules)));

module.exports = {
  validateIssuerService,
};
