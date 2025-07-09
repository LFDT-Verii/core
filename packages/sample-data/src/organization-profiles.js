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

const rootIssuerProfile = {
  name: 'Root Issuer',
  logo: 'https://rootissuer.com/logo.png',
  location: {
    countryCode: 'US',
    regionCode: 'TX',
  },
  founded: 2008,
};

const rootIssuerVerifiedProfile = {
  id: 'did:velocity:rootissuer1234567890',
  type: ['VerifiableCredential'],
  issuer: { id: 'did:velocity:rootissuer1234567890' },
  credentialSubject: {
    name: 'Root Issuer',
    logo: 'https://rootissuer.com/logo.png',
    location: {
      countryCode: 'US',
      regionCode: 'TX',
    },
    founded: 2008,
  },
  issuanceDate: '2021-08-18T05:08:19.000Z',
  credentialChecks: {
    checked: '2021-08-18T05:08:19.360Z',
    TRUSTED_HOLDER: 'PASS',
    TRUSTED_ISSUER: 'PASS',
    UNREVOKED: 'NOT_CHECKED',
    UNEXPIRED: 'NOT_APPLICABLE',
    UNTAMPERED: 'PASS',
  },
};

const sampleOrganizationProfile1 = {
  name: 'ACME Corp',
  logo: 'https://example.com/logo.png',
};

const sampleOrganizationVerifiedProfile1 = {
  // eslint-disable-next-line max-len
  id: 'did:velocity:0437f9f29bfa920d12c30e7801cd6dd6023a0baa83ca44db3cade2506553b99f5fcd4d2a22c548f8f6701c0fc4b5f9f30e12cfd5a76a5fd356bc7d89041a45385c',
  type: ['VerifiableCredential'],
  issuer: { id: 'did:velocity:rootissuer1234567890' },
  credentialSubject: {
    name: 'ACME Corp',
    logo: 'https://example.com/logo.png',
    id: 'did:velocity:0xdafc3acd92a93e50a971457741da697d32b2deb8',
  },
  issuanceDate: '2021-08-18T05:08:19.000Z',
  credentialChecks: {
    checked: '2021-08-18T05:08:19.360Z',
    TRUSTED_HOLDER: 'PASS',
    TRUSTED_ISSUER: 'PASS',
    UNREVOKED: 'NOT_CHECKED',
    UNEXPIRED: 'NOT_APPLICABLE',
    UNTAMPERED: 'PASS',
  },
};

module.exports = {
  rootIssuerProfile,
  rootIssuerVerifiedProfile,
  sampleOrganizationProfile1,
  sampleOrganizationVerifiedProfile1,
};
