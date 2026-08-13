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

const { describe, it } = require('node:test');
const { expect } = require('expect');
const { generateJWAKeyPair, KeyAlgorithms } = require('@verii/crypto');
const {
  jsonLdToUnsignedVcJwtContent,
  jsonLdToUnsignedVcV2JwsContent,
  jwsSign,
  jwsVerify,
} = require('../index');

const legacyCredential = Object.freeze({
  '@context': Object.freeze([
    'https://www.w3.org/2018/credentials/v1',
    'https://example.com/contexts/employment-v1.jsonld',
  ]),
  id: 'did:velocity:v2:credential-123',
  type: Object.freeze(['EmploymentCredential', 'VerifiableCredential']),
  issuer: Object.freeze({
    id: 'did:example:issuer',
    name: 'Example Issuer',
  }),
  issuanceDate: '2026-01-02T03:04:05.000Z',
  expirationDate: '2027-01-02T03:04:05.000Z',
  credentialSubject: Object.freeze({
    id: 'did:example:holder',
    jwk: Object.freeze({
      crv: 'P-256',
      kty: 'EC',
      x: 'x',
      y: 'y',
    }),
    role: 'Engineer',
  }),
  credentialSchema: Object.freeze({
    id: 'https://example.com/schema.json',
    type: 'JsonSchemaValidator2018',
  }),
  credentialStatus: Object.freeze({
    id: 'https://example.com/status/1',
    type: 'VelocityRevocationListJan2021',
  }),
  contentHash: Object.freeze({
    type: 'VelocityContentHash2020',
    value: 'abc123',
  }),
  vnfProtocolVersion: 2,
});

const expectedLegacyUnsigned = Object.freeze({
  header: Object.freeze({
    kid: 'did:velocity:v2:credential-123#key-1',
    alg: 'ES256K',
    typ: 'JWT',
  }),
  payload: Object.freeze({
    vc: Object.freeze({
      '@context': legacyCredential['@context'],
      id: legacyCredential.id,
      type: legacyCredential.type,
      issuer: legacyCredential.issuer,
      issuanceDate: legacyCredential.issuanceDate,
      expirationDate: legacyCredential.expirationDate,
      credentialSchema: legacyCredential.credentialSchema,
      credentialStatus: legacyCredential.credentialStatus,
      contentHash: legacyCredential.contentHash,
      vnfProtocolVersion: legacyCredential.vnfProtocolVersion,
      credentialSubject: Object.freeze({
        id: 'did:example:holder',
        role: 'Engineer',
      }),
    }),
    iss: 'did:example:issuer',
    jti: 'did:velocity:v2:credential-123',
    iat: 1767323045,
    nbf: 1767323045,
    sub: 'did:example:holder',
    sub_jwk: legacyCredential.credentialSubject.jwk,
    exp: 1798859045,
  }),
});

const v2Credential = Object.freeze({
  '@context': Object.freeze([
    'https://www.w3.org/ns/credentials/v2',
    'https://example.com/contexts/employment-v2.jsonld',
  ]),
  id: 'did:velocity:v2:credential-123',
  type: Object.freeze(['VerifiableCredential', 'EmploymentCredential']),
  issuer: Object.freeze({ id: 'did:example:issuer' }),
  validFrom: '2026-01-02T03:04:05.000Z',
  credentialSubject: Object.freeze({
    id: 'did:example:holder',
    role: 'Engineer',
  }),
});

describe('VC JOSE signing guardrails', () => {
  it('freezes the v1 mapper byte and registered-claim contract', () => {
    const unsigned = jsonLdToUnsignedVcJwtContent(
      legacyCredential,
      KeyAlgorithms.SECP256K1,
      'did:velocity:v2:credential-123#key-1',
    );

    expect(JSON.stringify(unsigned)).toBe(
      JSON.stringify(expectedLegacyUnsigned),
    );
  });

  it('builds and signs the W3C direct-payload VC 2.0 JOSE profile', async () => {
    const keyPair = generateJWAKeyPair(KeyAlgorithms.ES256);
    const unsigned = jsonLdToUnsignedVcV2JwsContent(
      v2Credential,
      KeyAlgorithms.ES256,
      'did:velocity:v2:credential-123#key-1',
    );
    const compact = await jwsSign(
      unsigned.payload,
      keyPair.privateKey,
      unsigned.header,
    );

    expect(await jwsVerify(compact, keyPair.publicKey)).toEqual({
      header: {
        alg: 'ES256',
        cty: 'vc',
        kid: 'did:velocity:v2:credential-123#key-1',
        typ: 'vc+jwt',
      },
      payload: v2Credential,
    });
    expect(Object.keys(v2Credential)).not.toEqual(
      expect.arrayContaining(['exp', 'iss', 'jti', 'nbf', 'sub', 'vc', 'vp']),
    );
  });
});
