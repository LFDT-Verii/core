const newError = require('http-errors');
const {
  every,
  includes,
  isEmpty,
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

const validateIssuerService = ({ service, didDoc, otherServices }) => {
  if (isInternalVpAuth(service)) {
    validateVpAuthRules(service.verifiablePresentationAuthRules);
    validateVpDisclosure(service);
    validateVpAuthRuleReads(service);
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

// The VP handler checks and matches only credentials of the disclosureRequest
// types, so internal VP services must request some. The manifest would ask for
// a presentationDefinition in their place, and its constraints aren't
// enforced, so internal VP services can't have one.
const validateVpDisclosure = ({
  disclosureRequest,
  presentationDefinition,
}) => {
  if (isEmpty(disclosureRequest?.types)) {
    throw newError(
      400,
      IssuerServicesErrors.SERVICE_DISCLOSURE_REQUEST_REQUIRED,
      {
        errorCode: IssuerServicesErrors.SERVICE_DISCLOSURE_REQUEST_REQUIRED,
      },
    );
  }
  if (presentationDefinition != null) {
    throw newError(
      400,
      IssuerServicesErrors.SERVICE_PRESENTATION_DEFINITION_NOT_ALLOWED,
      {
        errorCode:
          IssuerServicesErrors.SERVICE_PRESENTATION_DEFINITION_NOT_ALLOWED,
      },
    );
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
