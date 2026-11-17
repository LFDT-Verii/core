const { each, map, omit, some } = require('lodash/fp');
const newError = require('http-errors');
const { extractVerificationMethod } = require('@verii/did-doc');
const {
  isMatchingKeyPair,
  publicJwkFromPrivateJwk,
  resolveTransferredKey,
  TransferredKeyErrorCodes,
} = require('@verii/jwt');
const { validateKey, isMatchingPrivateKeyKid } = require('../domains');

const validateDidDocKeys = async (didDoc, keys) => {
  each(validateKey, keys);
  const keysTransformed = transformKeys(keys);

  each((key) => {
    if (!extractVerificationMethod(didDoc, key.kidFragment)) {
      throwErrorKidFragment(key.kidFragment);
    }
  }, keys);

  // Runs before the DID document check so a JWK whose x/y don't belong to
  // its d is reported as public_key_not_matched.
  const publicKeyValidations = await Promise.all(
    map(isMatchingPublicKey, keysTransformed),
  );

  if (some((valid) => !valid, publicKeyValidations)) {
    throwErrorPublicKeyNotMatched();
  }

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

const isMatchingPublicKey = async ({ key, publicKey }) =>
  (await isMatchingKeyPair(key, publicJwkFromPrivateJwk(key))) &&
  (publicKey == null || isMatchingKeyPair(key, publicKey));

// The transport members are replaced by `key` and `publicKey` JWKs, so they
// never reach the key records.
const transformKeys = map((key) => {
  const { privateJwk, publicJwk } = resolveKey(key);
  return {
    ...omit(['key', 'hexKey', 'jwk', 'publicKey', 'publicJwk'], key),
    publicKey: publicJwk,
    key: privateJwk,
  };
});

const resolveKey = (key) => {
  try {
    return resolveTransferredKey(key);
  } catch (error) {
    throw toHttpError(error);
  }
};

const toHttpError = (error) => {
  const buildHttpError = TransferredKeyHttpErrors[error.errorCode];
  return buildHttpError == null ? error : buildHttpError(error);
};

const TransferredKeyHttpErrors = {
  [TransferredKeyErrorCodes.PRIVATE_KEY_NOT_FOUND]: () =>
    newError(400, 'Private key not found', {
      errorCode: 'private_key_not_found',
    }),
  [TransferredKeyErrorCodes.PRIVATE_KEY_INVALID]: () =>
    newError(400, 'Private key not matched to document'),
  [TransferredKeyErrorCodes.PUBLIC_KEY_INVALID]: () =>
    newError(400, 'Public key not matched to private key', {
      errorCode: 'public_key_not_matched',
    }),
  [TransferredKeyErrorCodes.KEY_FORMATS_MISMATCH]: (error) =>
    newError(400, error.message, {
      errorCode: TransferredKeyErrorCodes.KEY_FORMATS_MISMATCH,
    }),
};

const throwErrorKidFragment = (kidFragment) => {
  throw newError(400, `kid fragment: ${kidFragment} not found on document`);
};

const throwErrorPrivateKeyNotMatched = () => {
  throw newError(400, 'Private key not matched to document');
};

const throwErrorPublicKeyNotMatched = () => {
  throw newError(400, 'Public key not matched to private key', {
    errorCode: 'public_key_not_matched',
  });
};

module.exports = {
  validateDidDocKeys,
};
