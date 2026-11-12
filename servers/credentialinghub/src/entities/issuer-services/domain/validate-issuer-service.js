const newError = require('http-errors');
const {
  every,
  includes,
  isEqual,
  map,
  range,
  size,
  sortBy,
} = require('lodash/fp');
const {
  IssuerServicesErrors,
} = require('@verii/credentialing-hub-operator-api');
const {
  validateServiceConfiguration,
} = require('../../service-configurations');
const { isInternalVpAuth } = require('./is-internal-vp-auth');

// The new-issuer-service schema already requires an internal VP service to
// have a disclosureRequest and at least one rule, and refuses a
// presentationDefinition. The VP handler checks and matches only credentials
// of the disclosureRequest types, and the manifest would ask for a
// presentationDefinition in their place without enforcing its constraints.
// What a schema can't express is checked here.
const validateIssuerService = ({ service, didDoc, otherServices }) => {
  if (isInternalVpAuth(service)) {
    validateVpAuthRules(service.verifiablePresentationAuthRules);
    validateVpAuthRuleReads(service);
  }
  validateServiceConfiguration({ service, didDoc, otherServices });
};

const validateVpAuthRules = (rules) => {
  if (!hasOneRulePerPosition(rules)) {
    throw newError(400, IssuerServicesErrors.SERVICE_VP_AUTH_RULES_INVALID, {
      errorCode: IssuerServicesErrors.SERVICE_VP_AUTH_RULES_INVALID,
    });
  }
};

// Each rule reads one of the requested types. Its claims path pointers are
// checked by the request schema.
const validateVpAuthRuleReads = ({
  verifiablePresentationAuthRules,
  disclosureRequest,
}) => {
  const requestedTypes = map('type', disclosureRequest.types);
  if (
    !every(
      (rule) => includes(rule.type, requestedTypes),
      verifiablePresentationAuthRules,
    )
  ) {
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
