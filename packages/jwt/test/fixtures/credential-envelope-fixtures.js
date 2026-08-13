/**
 * Copyright 2026 Velocity Team
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

const VC_V1_CONTEXT = 'https://www.w3.org/2018/credentials/v1';
const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';

const base64UrlJson = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const compactCredentialFixture = (header, payload) =>
  `${base64UrlJson(header)}.${base64UrlJson(payload)}.c2lnbmF0dXJl`;

const createCredential = (context, overrides = {}) => ({
  '@context': [
    context,
    'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.json',
  ],
  id: 'did:velocity:v2:credential-123',
  type: ['VerifiableCredential', 'EducationDegree'],
  issuer: {
    id: 'did:velocity:v2:issuer-from-vc',
    name: 'Velocity University',
  },
  ...(context === VC_V1_CONTEXT
    ? {
        expirationDate: '2027-01-02T03:04:05.000Z',
        issuanceDate: '2026-01-02T03:04:05.000Z',
      }
    : {
        validFrom: '2026-01-02T03:04:05.000Z',
        validUntil: '2027-01-02T03:04:05.000Z',
      }),
  credentialSubject: {
    id: 'did:velocity:v2:subject-from-vc',
    degree: 'Computer Science',
  },
  credentialSchema: {
    id: 'https://example.com/schemas/education-degree',
    type: 'JsonSchemaValidator2018',
  },
  credentialStatus: {
    id: 'https://example.com/status/123',
    type: 'VelocityRevocationListJan2021',
  },
  ...overrides,
});

const legacyPayload = Object.freeze({
  vc: createCredential(VC_V1_CONTEXT),
  iss: 'did:velocity:v2:issuer-from-registered-claim',
  sub: 'did:velocity:v2:subject-from-registered-claim',
  jti: 'did:velocity:v2:credential-from-registered-claim',
  nbf: 1767323045,
  exp: 1798859045,
});

const expectedLegacyCredential = Object.freeze({
  ...legacyPayload.vc,
  id: legacyPayload.jti,
  issuer: {
    ...legacyPayload.vc.issuer,
    id: legacyPayload.iss,
  },
  credentialSubject: {
    ...legacyPayload.vc.credentialSubject,
    id: legacyPayload.sub,
  },
  issuanceDate: legacyPayload.vc.issuanceDate,
  expirationDate: '2027-01-02T03:04:05.000Z',
});

const legacyCredentialFixtures = Object.freeze([
  Object.freeze({
    compact: compactCredentialFixture(
      { alg: 'ES256K', kid: 'did:example:issuer#key-1', typ: 'JWT' },
      legacyPayload,
    ),
    header: Object.freeze({
      alg: 'ES256K',
      kid: 'did:example:issuer#key-1',
      typ: 'JWT',
    }),
    name: 'ES256K with typ JWT',
  }),
  Object.freeze({
    compact: compactCredentialFixture(
      { alg: 'ES256', kid: 'did:example:issuer#key-2' },
      legacyPayload,
    ),
    header: Object.freeze({
      alg: 'ES256',
      kid: 'did:example:issuer#key-2',
    }),
    name: 'ES256 without typ',
  }),
  Object.freeze({
    compact: compactCredentialFixture(
      {
        alg: 'RS256',
        jwk: { e: 'AQAB', kty: 'RSA', n: 'fixture-modulus' },
        typ: 'JWT',
      },
      legacyPayload,
    ),
    header: Object.freeze({
      alg: 'RS256',
      jwk: Object.freeze({ e: 'AQAB', kty: 'RSA', n: 'fixture-modulus' }),
      typ: 'JWT',
    }),
    name: 'RS256 with embedded historical jwk',
  }),
]);

const v2Credential = Object.freeze(createCredential(VC_V2_CONTEXT));

const v2CredentialFixture = compactCredentialFixture(
  {
    alg: 'ES256',
    cty: 'vc',
    kid: 'did:velocity:v2:credential-123#key-1',
    typ: 'vc+jwt',
  },
  v2Credential,
);

module.exports = {
  VC_V1_CONTEXT,
  VC_V2_CONTEXT,
  compactCredentialFixture,
  expectedLegacyCredential,
  legacyCredentialFixtures,
  legacyPayload,
  v2Credential,
  v2CredentialFixture,
};
