/*
 * Copyright 2025 Velocity Team
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
const credentialVerificationSchema = {
  title: 'credential-verification',
  $id: 'credential-verification',
  type: 'object',
  additionalProperties: false,
  required: [
    'verified',
    'tamperCheck',
    'trustedIssuerCheck',
    'trustedHolderCheck',
    'revocationCheck',
    'expiryCheck',
    'format',
    'credential',
    'w3cCredential',
  ],
  properties: {
    format: {
      enum: ['JWT_VC'],
    },
    credential: {
      type: 'string',
    },
    w3cCredential: {
      $ref: 'disclosed-w3c-vc#',
    },
    verified: {
      type: 'boolean',
    },
    // Every UNTAMPERED value verifyCredentials returns, except
    // VOUCHER_RESERVE_EXHAUSTED, which fails the request with a 402 instead.
    tamperCheck: {
      type: 'string',
      enum: [
        'PASS',
        'FAIL',
        'DATA_INTEGRITY_ERROR',
        'DEPENDENCY_RESOLUTION_ERROR',
      ],
    },
    // Each check lists every value verifyCredentials returns for it.
    // NOT_CHECKED is reported for all four when the tamper check fails.
    trustedIssuerCheck: {
      type: 'string',
      enum: [
        'PASS',
        'FAIL',
        'SELF_SIGNED',
        'DATA_INTEGRITY_ERROR',
        'DEPENDENCY_RESOLUTION_ERROR',
        'NOT_CHECKED',
      ],
    },
    trustedHolderCheck: {
      type: 'string',
      enum: ['PASS', 'FAIL', 'NOT_APPLICABLE', 'NOT_CHECKED'],
    },
    revocationCheck: {
      type: 'string',
      enum: [
        'PASS',
        'FAIL',
        'NOT_APPLICABLE',
        'DEPENDENCY_RESOLUTION_ERROR',
        'NOT_CHECKED',
      ],
    },
    expiryCheck: {
      type: 'string',
      enum: ['PASS', 'FAIL', 'NOT_APPLICABLE', 'NOT_CHECKED'],
    },
  },
};

module.exports = {
  credentialVerificationSchema,
};
