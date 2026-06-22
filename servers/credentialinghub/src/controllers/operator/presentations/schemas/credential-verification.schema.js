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
      $ref: 'https://velocitycareerlabs.io/w3c-vc.schema.json',
    },
    verified: {
      type: 'boolean',
    },
    tamperCheck: {
      type: 'string',
      enum: ['PASS', 'FAIL', 'UNCHECKED'],
    },
    trustedIssuerCheck: {
      type: 'string',
      enum: [
        'PASS',
        'FAIL',
        'UNCHECKED',
        'SELF_SIGNED',
        'DATA_INTEGRITY_ERROR',
      ],
    },
    trustedHolderCheck: {
      type: 'string',
      enum: ['PASS', 'FAIL', 'UNCHECKED', 'NOT_APPLICABLE'],
    },
    revocationCheck: {
      type: 'string',
      enum: [
        'PASS',
        'FAIL',
        'UNCHECKED',
        'DEPENDENCY_RESOLUTION_ERROR',
        'NOT_APPLICABLE',
      ],
    },
    expiryCheck: {
      type: 'string',
      enum: ['PASS', 'FAIL', 'UNCHECKED', 'NOT_APPLICABLE'],
    },
  },
};

module.exports = {
  credentialVerificationSchema,
};
