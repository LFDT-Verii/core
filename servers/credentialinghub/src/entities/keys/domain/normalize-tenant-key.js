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

const { KeyEncodings, jwkFromSecp256k1Key } = require('@verii/crypto');
const { isMatchingKeyPair } = require('@verii/jwt');
const { KeyErrors } = require('./key-errors');

const normalizeTenantKey = async (key) => {
  const privateJwk = key.jwk != null ? key.jwk : jwkFromSecp256k1Key(key.key);
  const publicJwk = omit(['d'], privateJwk);
  if (!(await isMatchingKeyPair(privateJwk, publicJwk))) {
    throw newError(400, KeyErrors.KEY_INVALID, {
      errorCode: KeyErrors.KEY_INVALID,
    });
  }
  return {
    _id: new ObjectId(),
    ...omit(['key', 'jwk'], key),
    encoding: KeyEncodings.JWK,
    publicJwk,
    jwk: privateJwk,
  };
};

module.exports = { normalizeTenantKey };
