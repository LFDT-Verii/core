/**
 * Copyright 2023 Velocity Team
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
 */

const { all, includes, values, uniq } = require('lodash/fp');
const newError = require('http-errors');
const {
  KeyPurposes,
  KeyAlgorithms,
  KeyEncodings,
} = require('@verii/crypto');
const { KeyErrorMessages } = require('./constants');

const validKeyPurposes = values(KeyPurposes);

const arePurposesRecognized = (purposes) => {
  return all((purpose) => includes(purpose, validKeyPurposes), purposes);
};

const isAlgorithmRecognized = (algorithm) => {
  return algorithm === KeyAlgorithms.SECP256K1;
};

const isEncodingRecognized = (encoding) => {
  return encoding === KeyEncodings.HEX || encoding === KeyEncodings.JWK;
};

const hasDuplicatePurposes = (purposes) =>
  !(uniq(purposes).length === purposes.length);

const validateKey = (key) => {
  const { purposes, algorithm, encoding } = key;
  if (!arePurposesRecognized(purposes)) {
    throw newError(400, KeyErrorMessages.UNRECOGNIZED_PURPOSE_DETECTED);
  }
  if (hasDuplicatePurposes(purposes)) {
    throw newError(400, KeyErrorMessages.DUPLICATE_PURPOSE_DETECTED);
  }
  if (!isAlgorithmRecognized(algorithm)) {
    throw newError(400, KeyErrorMessages.UNRECOGNIZED_ALGORITHM);
  }
  if (!isEncodingRecognized(encoding)) {
    throw newError(400, KeyErrorMessages.UNRECOGNIZED_ENCODING);
  }
};

module.exports = {
  hasDuplicatePurposes,
  validateKey,
};
