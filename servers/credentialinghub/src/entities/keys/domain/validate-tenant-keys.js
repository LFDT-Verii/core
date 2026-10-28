/*
 * Copyright 2024 Velocity Team
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
const { flatMap, map, uniq, forEach, some } = require('lodash/fp');
const newError = require('http-errors');
const {
  extractVerificationKey,
  extractVerificationMethod,
} = require('@verii/did-doc');
const { KeyPurposes, publicJwkFromPublicHex } = require('@verii/crypto');
const { isMatchingKeyPair } = require('@verii/jwt');
const { KeyErrors } = require('./key-errors');
const { getKeyWithPurpose } = require('./get-key-with-purpose');

const validateTenantKeys = (tenantKeys, didDoc) => {
  validateAllPurposesUnique(tenantKeys);
  validateAllKidFragmentsUnique(tenantKeys);
  validateDltKeyExists(tenantKeys);
  validateExchangesKeyExists(tenantKeys);
  forEach(
    (key) => validateKidFragmentResolves(key.kidFragment, didDoc),
    tenantKeys,
  );
};

const validateTenantKeysMatchDidDoc = async (normalizedKeys, didDoc) => {
  const matches = await Promise.all(
    map(
      ({ kidFragment, jwk }) =>
        isMatchingKeyPair(jwk, didDocPublicJwk(didDoc, kidFragment)),
      normalizedKeys,
    ),
  );
  if (some((match) => !match, matches)) {
    throw newError(400, KeyErrors.KEY_DOES_NOT_MATCH_DID_DOC, {
      errorCode: KeyErrors.KEY_DOES_NOT_MATCH_DID_DOC,
    });
  }
};

const UNCOMPRESSED_PUBLIC_KEY_HEX = /^04[0-9a-f]{128}$/i;

// publicKeyHex and publicKeyBase58 carry no curve, so they're read as an
// uncompressed secp256k1 public key. Any other encoding or length gives no
// key, which never matches.
const didDocPublicJwk = (didDoc, kidFragment) => {
  const { publicKeyJwk } = extractVerificationMethod(didDoc, kidFragment);
  if (publicKeyJwk != null) {
    return publicKeyJwk;
  }
  try {
    const publicKeyHex = extractVerificationKey(didDoc, kidFragment);
    return UNCOMPRESSED_PUBLIC_KEY_HEX.test(publicKeyHex)
      ? publicJwkFromPublicHex(publicKeyHex)
      : null;
  } catch {
    return null;
  }
};

const initValidateKeyPurposeExists = (purpose, errorCode) => (keys) => {
  if (getKeyWithPurpose(purpose, keys) == null) {
    throw newError(400, errorCode, { errorCode });
  }
};

const validateDltKeyExists = initValidateKeyPurposeExists(
  KeyPurposes.DLT_TRANSACTIONS,
  KeyErrors.DLT_TRANSACTION_KEY_REQUIRED,
);
const validateExchangesKeyExists = initValidateKeyPurposeExists(
  KeyPurposes.EXCHANGES,
  KeyErrors.EXCHANGES_KEY_REQUIRED,
);

const validateKidFragmentResolves = (kidFragment, didDoc) => {
  if (extractVerificationMethod(didDoc, kidFragment) == null) {
    throw newError(400, KeyErrors.KEY_KID_FRAGMENT_NOT_FOUND, {
      errorCode: KeyErrors.KEY_KID_FRAGMENT_NOT_FOUND,
    });
  }
};

const validateAllKidFragmentsUnique = (keys) => {
  const allKidFragments = map('kidFragment', keys);
  if (arrayContainsDuplicates(allKidFragments)) {
    throw newError(400, KeyErrors.KEY_KID_FRAGMENT_NOT_UNIQUE, {
      errorCode: KeyErrors.KEY_KID_FRAGMENT_NOT_UNIQUE,
    });
  }
};

const validateAllPurposesUnique = (keys) => {
  const allPurposes = flatMap('purposes', keys);
  if (arrayContainsDuplicates(allPurposes)) {
    throw newError(400, KeyErrors.KEY_PURPOSES_NOT_UNIQUE, {
      errorCode: KeyErrors.KEY_PURPOSES_NOT_UNIQUE,
    });
  }
};

const arrayContainsDuplicates = (array) => uniq(array).length !== array.length;

module.exports = { validateTenantKeys, validateTenantKeysMatchDidDoc };
