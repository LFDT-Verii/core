const { find, isEmpty, map, pick } = require('lodash/fp');
const newError = require('http-errors');
const { KeyEncodings } = require('@verii/crypto');
const {
  isMatchingKeyPair,
  publicJwkFromPrivateJwk,
  resolveTransferredKey,
  TransferredKeyError,
} = require('@verii/jwt');

/**
 * Imports the keys of a create_tenant message the way a CAO receiver should.
 *
 * Each key is imported from `jwk` and `publicJwk` in preference to its hex `key`
 * and `publicKey`, and its private and public keys must form a pair. If any key
 * can't be imported, none is: the first key that fails, in message order, is
 * reported in a 400 that names the key and its errorCode.
 * @param {Object[]} keys the create_tenant keys
 * @returns {Promise<{kidFragment: string, importedFrom: string, publicJwk: JsonWebKey}[]>}
 *   for each key, whether its private key was imported from `jwk` or `hex`, and its public JWK
 */
const importTransferredKeys = async (keys) => {
  const results = await Promise.allSettled(map(importTransferredKey, keys));
  const rejection = find({ status: 'rejected' }, results);
  if (rejection != null) {
    throw rejection.reason;
  }
  return map('value', results);
};

const PUBLIC_KEY_NOT_MATCHED = 'public_key_not_matched';

const PUBLIC_JWK_MEMBERS = ['kty', 'crv', 'x', 'y'];

const importTransferredKey = async (key) => {
  const { privateJwk, publicJwk } = resolveKey(key);
  if (!(await isKeyPair(privateJwk, publicJwk))) {
    throw keyImportError(
      key,
      PUBLIC_KEY_NOT_MATCHED,
      'The public key does not belong to the private key',
    );
  }
  return {
    kidFragment: key.kidFragment,
    importedFrom: isEmpty(key.jwk) ? KeyEncodings.HEX : KeyEncodings.JWK,
    publicJwk: pick(PUBLIC_JWK_MEMBERS, privateJwk),
  };
};

const resolveKey = (key) => {
  try {
    return resolveTransferredKey(key);
  } catch (error) {
    if (error instanceof TransferredKeyError) {
      throw keyImportError(key, error.errorCode, error.message);
    }
    throw error;
  }
};

// The x and y of a JWK must belong to its d, and so must a public key sent with it.
const isKeyPair = async (privateJwk, publicJwk) =>
  (await isMatchingKeyPair(privateJwk, publicJwkFromPrivateJwk(privateJwk))) &&
  (publicJwk == null || isMatchingKeyPair(privateJwk, publicJwk));

const keyImportError = ({ kidFragment }, errorCode, message) =>
  newError(400, `Key ${kidFragment} can't be imported: ${message}`, {
    errorCode,
    kidFragment,
  });

module.exports = { importTransferredKeys };
