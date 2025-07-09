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

/* eslint-disable max-len */
const credentialExpired = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  id: 'did:velocity:iamacredential5556667770',
  type: ['BadgeClass', 'VerifiableCredential'],
  issuer: 'did:velocity:iamanissuer5556667770',
  issuanceDate: '2000-01-01T00:00:00.000Z',
  expirationDate: '2010-01-01T00:00:00.000Z',
  credentialSubject: {
    holds: {
      type: 'BadgeClass',
      name: 'Influenza Vaccine Immunization Education (IVIE)',
      image: 'http://example.com/ivie.png',
      description:
        'Influenza Vaccine Immunization Education (IVIE) is a self-guided learning module for nursing students to gain training specific to the administration of influenza vaccine in organized clinics for communities of people',
      issuer: {
        type: 'Profile',
        id: 'did:velocity:declanhospital',
        name: 'Declan Hospital',
      },
      criteria: 'https://example.com/ivie/criteria.html',
    },
  },
  credentialStatus: {
    id: 'https://credentialstatus.velocitycareerlabs.io',
    type: 'VelocityRevocationRegistry',
  },
};

const credentialNoExpiration = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  id: 'did:velocity:iamacredential5556667770',
  type: ['BadgeClass', 'VerifiableCredential'],
  issuer: 'did:velocity:iamanissuer5556667770',
  issuanceDate: '2000-01-01T00:00:00.000Z',
  credentialSubject: {
    holds: {
      type: 'BadgeClass',
      name: 'Influenza Vaccine Immunization Education (IVIE)',
      image: 'http://example.com/ivie.png',
      description:
        'Influenza Vaccine Immunization Education (IVIE) is a self-guided learning module for nursing students to gain training specific to the administration of influenza vaccine in organized clinics for communities of people',
      issuer: {
        type: 'Profile',
        id: 'did:velocity:declanhospital',
        name: 'Declan Hospital',
      },
      criteria: 'https://example.com/ivie/criteria.html',
    },
  },
  credentialStatus: {
    id: 'https://credentialstatus.velocitycareerlabs.io',
    type: 'VelocityRevocationRegistry',
  },
};

const credentialUnexpired = {
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    'https://www.openbadges.org/jsonld-context.json',
  ],
  id: 'did:velocity:v2:1:BBB:42:abcdefg',
  type: ['OpenBadgeCredential', 'VerifiableCredential'],
  issuer: { id: 'did:velocity:iamanissuer5556667770', name: 'Declan Hospital' },
  issuanceDate: '2000-01-01T00:00:00.000Z',
  expirationDate: '2030-01-01T00:00:00.000Z',
  credentialSubject: {
    name: 'Influenza Vaccine Immunization Education (IVIE)',
    image: 'http://example.com/ivie.png',
    description:
      'Influenza Vaccine Immunization Education (IVIE) is a self-guided learning module for nursing students to gain training specific to the administration of influenza vaccine in organized clinics for communities of people',
    criteria: 'https://example.com/ivie/criteria.html',
  },
  credentialStatus: {
    id: 'https://credentialstatus.velocitycareerlabs.io',
    type: 'VelocityRevocationRegistry',
  },
};

const credentialSubjectNotExpired = {
  'name:': 'Florida Driver’s License',
  authority: {
    name: 'Florida HSMV',
    place: {
      addressRegion: 'FL',
      addressCountry: 'US',
    },
  },
  validity: {
    validFrom: '2014-04-27',
    validUntil: '2032-04-27',
  },
  identifier: 'Z135791357913',
  person: {
    givenName: 'Carmen',
    familyName: 'Johnson',
    birthDate: '1975-04-27',
    gender: 'Female',
  },
};

module.exports = {
  credentialExpired,
  credentialSubjectNotExpired,
  credentialNoExpiration,
  credentialUnexpired,
};
