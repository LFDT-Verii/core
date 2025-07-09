const { all, includes, uniq, values } = require('lodash/fp');
const newError = require('http-errors');
const { KeyPurposes, isStringHex } = require('@verii/crypto');
const { KeyErrorMessages } = require('./constants');

const validKeyPurposes = values(KeyPurposes);

const arePurposesRecognized = (purposes) => {
  return all((purpose) => includes(purpose, validKeyPurposes), purposes);
};

const containsDuplicatePurposes = (purposes) =>
  !(uniq(purposes).length === purposes.length);

const validatePublicKeyAndEncoding = (key) => {
  if (!key.publicKey) {
    return;
  }

  if (!isStringHex(key.publicKey)) {
    throw newError(
      400,
      KeyErrorMessages.PUBLIC_KEY_ENCODING_DOES_NOT_MATCH_SPECIFIED_ENCODING
    );
  }
};

const validateOrganizationKey = (key) => {
  const { purposes } = key;
  if (!arePurposesRecognized(purposes)) {
    throw newError(400, KeyErrorMessages.UNRECOGNIZED_PURPOSE_DETECTED);
  }
  if (containsDuplicatePurposes(purposes)) {
    throw newError(400, KeyErrorMessages.DUPLICATE_PURPOSE_DETECTED);
  }

  validatePublicKeyAndEncoding(key);
};

module.exports = {
  validateOrganizationKey,
};
