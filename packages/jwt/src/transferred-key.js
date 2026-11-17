/*
 * Copyright 2026 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const { isEmpty, isString } = require('lodash/fp');
const {
  hexFromJwk,
  jwkFromSecp256k1Key,
  jwkFromSecp256k1PublicKey,
} = require('@verii/crypto');

/**
 * Resolves a transferred key to JWKs. `jwk` and `publicJwk` take precedence over
 * the legacy secp256k1 hex members `key`, `hexKey` and `publicKey`. When a key is
 * sent in both forms, both must encode the same key. Empty members count as not sent.
 * @param {{jwk?: JsonWebKey, key?: string|JsonWebKey, hexKey?: string, publicJwk?: JsonWebKey, publicKey?: string|JsonWebKey}} transferredKey
 * @returns {{privateJwk: JsonWebKey, publicJwk?: JsonWebKey}} the private JWK, and the public JWK when one was sent
 */
const resolveTransferredKey = ({ jwk, key, hexKey, publicJwk, publicKey }) => ({
  privateJwk: resolvePrivateJwk(sent(jwk), sent(key) ?? sent(hexKey)),
  publicJwk: resolvePublicJwk(sent(publicJwk), sent(publicKey)),
});

class TransferredKeyError extends Error {
  constructor(errorCode, message) {
    super(message);
    this.errorCode = errorCode;
    this.name = 'TransferredKeyError';
  }
}

const TransferredKeyErrorCodes = Object.freeze({
  KEY_FORMATS_MISMATCH: 'key_formats_mismatch',
  PRIVATE_KEY_INVALID: 'private_key_invalid',
  PRIVATE_KEY_NOT_FOUND: 'private_key_not_found',
  PUBLIC_KEY_INVALID: 'public_key_invalid',
});

const sent = (member) => (isEmpty(member) ? undefined : member);

const resolvePrivateJwk = (jwk, legacyKey) => {
  if (jwk == null && legacyKey == null) {
    throw new TransferredKeyError(
      TransferredKeyErrorCodes.PRIVATE_KEY_NOT_FOUND,
      'Private key not found',
    );
  }
  const legacyJwk = isString(legacyKey)
    ? privateJwkFromHex(legacyKey)
    : legacyKey;
  return preferJwk(jwk, legacyJwk, isSamePrivateKey);
};

const resolvePublicJwk = (publicJwk, legacyPublicKey) => {
  const legacyPublicJwk = isString(legacyPublicKey)
    ? publicJwkFromHex(legacyPublicKey)
    : legacyPublicKey;
  return preferJwk(publicJwk, legacyPublicJwk, isSamePublicKey);
};

const preferJwk = (jwk, legacyJwk, isSameKey) => {
  if (jwk == null) {
    return legacyJwk;
  }
  if (legacyJwk != null && !isSameKey(jwk, legacyJwk)) {
    throw new TransferredKeyError(
      TransferredKeyErrorCodes.KEY_FORMATS_MISMATCH,
      'The JWK and legacy encodings of the key do not match',
    );
  }
  return jwk;
};

const privateJwkFromHex = (hex) => {
  try {
    return jwkFromSecp256k1Key(hex, true);
  } catch {
    throw new TransferredKeyError(
      TransferredKeyErrorCodes.PRIVATE_KEY_INVALID,
      'Private key is not a secp256k1 hex key',
    );
  }
};

const publicJwkFromHex = (hex) => {
  try {
    return jwkFromSecp256k1PublicKey(hex);
  } catch {
    throw new TransferredKeyError(
      TransferredKeyErrorCodes.PUBLIC_KEY_INVALID,
      'Public key is not a secp256k1 hex key',
    );
  }
};

// Compares values rather than strings, so a JWK member that dropped a leading
// zero byte still matches its hex. The curve is compared too: hex is always read
// as secp256k1, so a P-256 scalar sent as hex must not match its P-256 JWK.
const isSamePrivateKey = (jwk, otherJwk) =>
  isSamePublicKey(jwk, otherJwk) &&
  compareMembers(() => hexFromJwk(jwk) === hexFromJwk(otherJwk));

const isSamePublicKey = (jwk, otherJwk) =>
  jwk.crv === otherJwk.crv &&
  compareMembers(() => hexFromJwk(jwk, false) === hexFromJwk(otherJwk, false));

const compareMembers = (compare) => {
  try {
    return compare();
  } catch {
    return false;
  }
};

module.exports = {
  resolveTransferredKey,
  TransferredKeyError,
  TransferredKeyErrorCodes,
};
