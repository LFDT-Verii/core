const {
  each,
  every,
  map,
  omit,
  isEmpty,
  isString,
  some,
} = require('lodash/fp');
const newError = require('http-errors');
const {
  hexFromJwk,
  jwkFromSecp256k1Key,
  publicKeyFromPrivateKey,
} = require('@verii/crypto');
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

  if (!every(isMatchingPublicKey, keysTransformed)) {
    throwErrorPublicKeyNotMatched();
  }

  return keysTransformed;
};

const isMatchingPublicKey = ({ key, publicKey }) => {
  try {
    const derivedPublicKey = publicKeyFromPrivateKey(key);
    return (
      publicKey == null ||
      hexFromJwk(publicKey, false) === hexFromJwk(derivedPublicKey, false)
    );
  } catch {
    return false;
  }
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

  if (!isString(privateKey)) {
    return privateKey;
  }

  try {
    return jwkFromSecp256k1Key(privateKey, true);
  } catch {
    return throwErrorPrivateKeyNotMatched();
  }
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
