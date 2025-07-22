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

const { keyBy } = require('lodash/fp');
const { KeyAlgorithms } = require('@verii/crypto/src/constants');

const credentialTypeMetadata = keyBy('credentialType', [
  {
    credentialType: 'EmailV1.0',
    layer1: true,
    schemaUrl:
      'https://velocitynetwork.foundation/schemas/email-v1.0.schema.json',
  },
  {
    credentialType: 'EmploymentCurrentV1.1',
    layer1: true,
    schemaUrl:
      'https://velocitynetwork.foundation/schemas/employment-v1.1.schema.json',
    jsonldContext: [
      'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
    ],
    defaultSignatureAlgorithm: KeyAlgorithms.SECP256K1,
  },
  {
    credentialType: 'OpenBadgeCredential',
    layer1: false,
    schemaUrl: 'https://imsglobal.org/schemas/open-badge-credential.json',
    jsonldContext: ['https://imsglobal.org/schemas/openbadge-context.json'],
    defaultSignatureAlgorithm: KeyAlgorithms.RS256,
  },
  {
    credentialType: '1EdtechCLR2.0',
    layer1: false,
    schemaUrl: 'https://velocitynetwork.foundation/schemas/clr.schema.json',
    jsonldContext: ['https://imsglobal.org/schemas/clr-context.json'],
    defaultSignatureAlgorithm: KeyAlgorithms.RS256,
  },
]);
const credentialTypesMap = keyBy('credentialType', credentialTypeMetadata);

module.exports = { credentialTypesMap, credentialTypeMetadata };
