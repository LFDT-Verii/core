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

const {
  KeyEncodings,
  publicKeyFromPrivateKey,
  jwkFromSecp256k1Key,
} = require('@verii/crypto');
const { KeyErrors } = require('./key-errors');

const normalizeTenantKey = (key) => {
  const privateJwk = key.jwk != null ? key.jwk : jwkFromSecp256k1Key(key.key);
  return {
    _id: new ObjectId(),
    ...omit(['key', 'jwk'], key),
    encoding: KeyEncodings.JWK,
    publicJwk: derivePublicJwk(privateJwk),
    jwk: privateJwk,
  };
};

const derivePublicJwk = (privateJwk) => {
  try {
    return publicKeyFromPrivateKey(privateJwk);
  } catch (error) {
    throw newError(400, error.message, { errorCode: KeyErrors.KEY_INVALID });
  }
};

module.exports = { normalizeTenantKey };
