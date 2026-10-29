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
const { omit } = require('lodash/fp');
const newError = require('http-errors');
const { ObjectId } = require('mongodb');

const { KeyEncodings } = require('@verii/crypto');
const {
  isMatchingKeyPair,
  publicJwkFromPrivateJwk,
  resolveTransferredKey,
  TransferredKeyErrorCodes,
} = require('@verii/jwt');
const { KeyErrors } = require('./key-errors');

// Keys forwarded from a create_tenant message can carry the key as hex and as
// JWKs. The JWKs are imported, and the transport members aren't stored.
const normalizeTenantKey = async (key) => {
  const { privateJwk, publicJwk: transferredPublicJwk } = resolveKey(key);
  const publicJwk = publicJwkFromPrivateJwk(privateJwk);
  if (
    !(await isMatchingKeyPair(privateJwk, publicJwk)) ||
    !(await isTransferredPublicKeyMatching(privateJwk, transferredPublicJwk))
  ) {
    throw keyError(KeyErrors.KEY_INVALID);
  }
  return {
    _id: new ObjectId(),
    ...omit(['key', 'jwk', 'publicKey', 'publicJwk'], key),
    encoding: KeyEncodings.JWK,
    publicJwk,
    jwk: privateJwk,
  };
};

const resolveKey = (key) => {
  try {
    return resolveTransferredKey(key);
  } catch (error) {
    if (error.errorCode === TransferredKeyErrorCodes.KEY_FORMATS_MISMATCH) {
      throw keyError(KeyErrors.KEY_FORMATS_MISMATCH);
    }
    if (error.errorCode != null) {
      throw keyError(KeyErrors.KEY_INVALID);
    }
    throw error;
  }
};

const isTransferredPublicKeyMatching = async (privateJwk, publicJwk) =>
  publicJwk == null || isMatchingKeyPair(privateJwk, publicJwk);

const keyError = (errorCode) => newError(400, errorCode, { errorCode });

module.exports = { normalizeTenantKey };
