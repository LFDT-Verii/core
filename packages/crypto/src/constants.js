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

// TODO If we create a keys entity package, KeyPurposes should probably be moved there
const KeyPurposes = {
  DLT_TRANSACTIONS: 'DLT_TRANSACTIONS',
  EXCHANGES: 'EXCHANGES',
  ISSUING_METADATA: 'ISSUING_METADATA',
  REVOCATIONS_FALLBACK: 'REVOCATIONS_FALLBACK',
  ROTATION: 'ROTATION',
  PERMISSIONING: 'PERMISSIONING',
};

// TODO If we create a keys entity package, KeyAlgorithms should probably be moved there
const KeyAlgorithms = {
  // Could be renamed to JsonWebAlgorithms
  SECP256K1: 'SECP256K1', // Also ES256K
  ES256: 'ES256',
  RS256: 'RS256',
};

// TODO If we create a keys entity package, KeyEncodings should probably be moved there
const KeyEncodings = {
  HEX: 'hex',
  JWK: 'jwk',
  BASE64: 'base64',
  BASE64URL: 'base64url',
};

module.exports = {
  KeyAlgorithms,
  KeyEncodings,
  KeyPurposes,
};
