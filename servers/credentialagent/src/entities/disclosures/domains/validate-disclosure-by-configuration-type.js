const newError = require('http-errors');
const { isEmpty, includes } = require('lodash/fp');
const { ConfigurationType } = require('./constants');

const ValidationByConfigurationType = {
  [ConfigurationType.ISSUING]: (disclosure) => {
    if (isEmpty(disclosure.offerMode)) {
      throw newError(400, 'Offer mode is required', {
        errorCode: 'offer_mode_required',
      });
    }
  },
  [ConfigurationType.INSPECTION]: (disclosure) => {
    if (isEmpty(disclosure.duration)) {
      throw newError(400, 'Duration is required', {
        errorCode: 'duration_required',
      });
    }
    if (isEmpty(disclosure.purpose)) {
      throw newError(400, 'Purpose is required', {
        errorCode: 'purpose_required',
      });
    }
    if (isEmpty(disclosure.types) && !disclosure.presentationDefinition) {
      throw newError(400, 'Types should has minimum one item', {
        errorCode: 'types_required',
      });
    }
  },
};

const validateDisclosureByConfigurationType = (disclosure) => {
  const { configurationType, identificationMethods } = disclosure;
  const isVerifiablePresentationMode = includes(
    'verifiable_presentation',
    identificationMethods
  );
  ValidationByConfigurationType[
    isVerifiablePresentationMode
      ? ConfigurationType.INSPECTION
      : configurationType
  ](disclosure);
};

module.exports = {
  validateDisclosureByConfigurationType,
};
