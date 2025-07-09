const { isEmpty, some } = require('lodash/fp');
const newError = require('http-errors');
const { DisclosureErrors } = require('./errors');
const {
  identificationMethodsIncludesPreauth,
} = require('./validate-by-identification-method');

const validatePresentationDefinition = (disclosure) => {
  const { presentationDefinition, types } = disclosure;
  validatePresentationDefinitionXorTypes(disclosure);
  if (
    types ||
    identificationMethodsIncludesPreauth(disclosure.identificationMethods)
  ) {
    return true;
  }
  const {
    submission_requirements: submissionRequirements,
    input_descriptors: inputDescriptors,
  } = presentationDefinition;

  if (isEmpty(submissionRequirements)) {
    return true;
  }

  if (inputDescriptorWithoutGroup(inputDescriptors)) {
    return throwValidationError(
      DisclosureErrors.PRESENTATION_DEFINITION_GROUP_IF_SUBMISSION_REQUIREMENTS
    );
  }
  return true;
};

const validatePresentationDefinitionXorTypes = (disclosure) => {
  const { presentationDefinition, types } = disclosure;
  if (presentationDefinition && types) {
    return throwValidationError(
      DisclosureErrors.PRESENTATION_DEFINITION_XOR_TYPES
    );
  }
  return true;
};

const inputDescriptorWithoutGroup = some(({ group }) => isEmpty(group));

const throwValidationError = (reason) => {
  throw newError(400, reason, {
    errorCode: 'request_validation_failed',
  });
};

module.exports = {
  validatePresentationDefinition,
};
