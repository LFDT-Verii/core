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

const { applyOverrides } = require('@verii/common-functions');
const {
  VelocityRevocationListType,
  VeriiProtocolVersions,
} = require('@verii/vc-checks');

const openBadgeCredentialContent = {
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    'https://www.openbadges.org/jsonld-context.json',
  ],
  type: ['OpenBadgeCredential', 'VerifiableCredential'],
  expirationDate: '2050-01-01T00:00:00.000Z',
  credentialSubject: {
    type: 'OpenBadgeCredentialSubject',
    name: 'Influenza Vaccine Immunization Education (IVIE)',
    image: 'http://example.com/ivie.png',
    description:
      // eslint-disable-next-line max-len
      'Influenza Vaccine Immunization Education (IVIE) is a self-guided learning module for nursing students to gain training specific to the administration of influenza vaccine in organized clinics for communities of people',
    criteria: 'https://example.com/ivie/criteria.html',
  },
  credentialStatus: {
    type: VelocityRevocationListType,
    id: 'ethereum:URL:2',
  },
  vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
};

const buildOpenBadgeCredential = (
  tenant,
  credentialDid,
  holderDid,
  content = openBadgeCredentialContent,
) =>
  applyOverrides(content, {
    id: credentialDid,
    issuer: { id: tenant.did, name: tenant.name },
    credentialSubject: {
      ...content.credentialSubject,
      id: holderDid,
      authority: {
        id: tenant.did,
      },
    },
    vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
  });

module.exports = { buildOpenBadgeCredential, openBadgeCredentialContent };
