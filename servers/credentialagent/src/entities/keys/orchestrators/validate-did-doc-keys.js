const { each, map, omit, isEmpty, isString, some } = require('lodash/fp');
const newError = require('http-errors');
const { jwkFromSecp256k1Key } = require('@verii/jwt');
const { extractVerificationMethod } = require('@verii/did-doc');
const { validateKey, isMatchingPrivateKeyKid } = require('../domains');

const validateDidDocKeys = async (didDoc, keys) => {
  each(validateKey, keys);
  const keysTransformed = transformKeys(keys);

  each((key) => {
    if (!extractVerificationMethod(didDoc, key.kidFragment)) {
      throwErrorKidFragment(key.kidFragment);
    }
  }, keys);

  const validations = await Promise.all(
    map((key) => {
      const kid = `${didDoc.id}${key.kidFragment}`;
      return isMatchingPrivateKeyKid(didDoc, key.key, kid);
    }, keysTransformed),
  );

  if (some((valid) => !valid, validations)) {
    throwErrorPrivateKeyNotMatched();
  }

  return keysTransformed;
};

// eslint-disable-next-line complexity
const transformKeys = map((key) => ({
  ...omit(['key', 'hexKey', 'jwk'], key),
  publicKey: transformPublicKeyToJwk(key?.publicKey),
  key: transformKeyToJwk(key?.key ?? key?.hexKey ?? key?.jwk),
}));

const transformPublicKeyToJwk = (publicKey) => {
  if (isEmpty(publicKey)) {
    return undefined;
  }

  return isString(publicKey)
    ? jwkFromSecp256k1Key(publicKey, false)
    : publicKey;
};

const transformKeyToJwk = (privateKey) => {
  if (isEmpty(privateKey)) {
    throw newError(400, 'Private key not found', {
      errorCode: 'private_key_not_found',
    });
  }

  return isString(privateKey)
    ? jwkFromSecp256k1Key(privateKey, true)
    : privateKey;
};

const throwErrorKidFragment = (kidFragment) => {
  throw newError(400, `kid fragment: ${kidFragment} not found on document`);
};

const throwErrorPrivateKeyNotMatched = () => {
  throw newError(400, 'Private key not matched to document');
};

module.exports = {
  validateDidDocKeys,
};
