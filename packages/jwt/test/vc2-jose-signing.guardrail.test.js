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

const { verify } = require('node:crypto');
const { describe, it } = require('node:test');
const { expect } = require('expect');
const { KeyAlgorithms } = require('@verii/crypto');
const {
  jsonLdToUnsignedVcJwtContent,
  jsonLdToUnsignedVcV2JwsContent,
  jwsSign,
  jwsVerify,
} = require('../index');
const {
  vc2JoseSigningVectors,
} = require('./fixtures/vc2-jose-signing-vectors');

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

// Adapted from the W3C VC JOSE/COSE Recommendation credential example.
const w3cV2Credential = Object.freeze({
  '@context': Object.freeze([
    'https://www.w3.org/ns/credentials/v2',
    'https://www.w3.org/ns/credentials/examples/v2',
  ]),
  id: 'http://university.example/credentials/3732',
  type: Object.freeze([
    'VerifiableCredential',
    'ExampleDegreeCredential',
    'ExamplePersonCredential',
  ]),
  issuer: 'https://university.example/issuers/14',
  validFrom: '2010-01-01T19:23:24Z',
  credentialSubject: Object.freeze({
    id: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
    degree: Object.freeze({
      type: 'ExampleBachelorDegree',
      name: 'Bachelor of Science and Arts',
    }),
    alumniOf: Object.freeze({
      name: 'Example University',
    }),
  }),
  credentialSchema: Object.freeze([
    Object.freeze({
      id: 'https://example.org/examples/degree.json',
      type: 'JsonSchema',
    }),
    Object.freeze({
      id: 'https://example.org/examples/alumni.json',
      type: 'JsonSchema',
    }),
  ]),
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
    const keyPair = vc2JoseSigningVectors[1];
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

  for (const vector of vc2JoseSigningVectors) {
    it(`signs a deterministic ${vector.joseAlgorithm} cross-library vector`, async () => {
      const unsigned = jsonLdToUnsignedVcV2JwsContent(
        v2Credential,
        vector.keyAlgorithm,
        'did:velocity:v2:credential-123#key-1',
      );
      const compact = await jwsSign(
        unsigned.payload,
        vector.privateKey,
        unsigned.header,
      );
      const [headerSegment, payloadSegment, signatureSegment] =
        compact.split('.');
      const signingInput = `${headerSegment}.${payloadSegment}`;
      const verificationOptions =
        vector.joseAlgorithm === 'RS256'
          ? { format: 'jwk', key: vector.publicKey }
          : {
              dsaEncoding: 'ieee-p1363',
              format: 'jwk',
              key: vector.publicKey,
            };

      expect(headerSegment).toBe(
        Buffer.from(JSON.stringify(unsigned.header)).toString('base64url'),
      );
      expect(payloadSegment).toBe(
        Buffer.from(JSON.stringify(v2Credential)).toString('base64url'),
      );
      expect(
        verify(
          'sha256',
          Buffer.from(signingInput),
          verificationOptions,
          Buffer.from(signatureSegment, 'base64url'),
        ),
      ).toBe(true);
    });
  }

  it('signs exact caller-provided JSON bytes without injecting claims', async () => {
    const vector = vc2JoseSigningVectors[1];
    const payloadBytes = Buffer.from('{"z":1,"a":2}');
    const compact = await jwsSign(payloadBytes, vector.privateKey, {
      alg: 'ES256',
      custom: 'preserved',
    });
    const [headerSegment, payloadSegment] = compact.split('.');

    expect(Buffer.from(headerSegment, 'base64url').toString()).toBe(
      '{"alg":"ES256","custom":"preserved"}',
    );
    expect(Buffer.from(payloadSegment, 'base64url')).toEqual(payloadBytes);
    expect(JSON.parse(Buffer.from(payloadSegment, 'base64url'))).toEqual({
      a: 2,
      z: 1,
    });
  });

  it('builds unsigned JOSE content for the applicable W3C v2 fixture', () => {
    expect(
      jsonLdToUnsignedVcV2JwsContent(
        w3cV2Credential,
        KeyAlgorithms.SECP256K1,
        'http://university.example/credentials/3732#key-1',
      ),
    ).toEqual({
      header: {
        alg: 'ES256K',
        cty: 'vc',
        kid: 'http://university.example/credentials/3732#key-1',
        typ: 'vc+jwt',
      },
      payload: w3cV2Credential,
    });
  });

  it('rejects an unsupported internal algorithm at the JOSE boundary', () => {
    expect(() =>
      jsonLdToUnsignedVcV2JwsContent(
        v2Credential,
        'ES256K',
        'did:velocity:v2:credential-123#key-1',
      ),
    ).toThrow('signing algorithm is not supported: ES256K');
  });

  it('rejects a kid that does not identify the credential key', () => {
    expect(() =>
      jsonLdToUnsignedVcV2JwsContent(
        v2Credential,
        KeyAlgorithms.ES256,
        'did:velocity:v2:other#key-1',
      ),
    ).toThrow('kid must identify the credential key');
  });

  for (const [name, overrides, error] of [
    ['an audience claim', { aud: 'did:example:verifier' }, 'compatibility'],
    ['a compatibility claim', { iss: 'did:example:issuer' }, 'compatibility'],
    ['a legacy subject key claim', { sub_jwk: { kty: 'EC' } }, 'compatibility'],
    ['a proof', { proof: {} }, 'must not contain proof'],
    [
      'issuanceDate',
      { issuanceDate: '2026-01-02T03:04:05.000Z' },
      'must not contain issuanceDate',
    ],
    [
      'expirationDate',
      { expirationDate: '2027-01-02T03:04:05.000Z' },
      'must not contain expirationDate',
    ],
    [
      'the v1 context',
      { '@context': [legacyCredential['@context'][0]] },
      'context',
    ],
  ]) {
    it(`rejects ${name} in a v2 payload`, () => {
      expect(() =>
        jsonLdToUnsignedVcV2JwsContent(
          { ...v2Credential, ...overrides },
          KeyAlgorithms.ES256,
          'did:velocity:v2:credential-123#key-1',
        ),
      ).toThrow(error);
    });
  }

  it('rejects a protected header without alg', async () => {
    await expect(
      jwsSign(v2Credential, vc2JoseSigningVectors[1].privateKey, {
        typ: 'vc+jwt',
      }),
    ).rejects.toThrow('protected header must contain alg');
  });

  it('rejects a non-JSON raw payload', async () => {
    await expect(
      jwsSign(undefined, vc2JoseSigningVectors[1].privateKey, {
        alg: 'ES256',
      }),
    ).rejects.toThrow('payload must be JSON or JSON bytes');
  });

  for (const [name, payload] of [
    ['malformed JSON', Buffer.from('{')],
    ['invalid UTF-8', Buffer.from([0xff])],
  ]) {
    it(`rejects raw payload bytes containing ${name}`, async () => {
      await expect(
        jwsSign(payload, vc2JoseSigningVectors[1].privateKey, {
          alg: 'ES256',
        }),
      ).rejects.toThrow('payload bytes must contain valid JSON');
    });
  }

  for (const alg of ['', 'none', 'NONE']) {
    it(`rejects the insecure or empty protected alg ${String(alg)}`, async () => {
      await expect(
        jwsSign(v2Credential, vc2JoseSigningVectors[1].privateKey, { alg }),
      ).rejects.toThrow('protected header must contain alg');
    });
  }

  it('propagates a signing key and algorithm mismatch', async () => {
    await expect(
      jwsSign(v2Credential, vc2JoseSigningVectors[2].privateKey, {
        alg: 'ES256',
      }),
    ).rejects.toThrow();
  });

  it('detects a tampered direct payload', async () => {
    const vector = vc2JoseSigningVectors[1];
    const unsigned = jsonLdToUnsignedVcV2JwsContent(
      v2Credential,
      vector.keyAlgorithm,
      'did:velocity:v2:credential-123#key-1',
    );
    const compact = await jwsSign(
      unsigned.payload,
      vector.privateKey,
      unsigned.header,
    );
    const [headerSegment, , signatureSegment] = compact.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...v2Credential, issuer: 'did:example:attacker' }),
    ).toString('base64url');

    await expect(
      jwsVerify(
        `${headerSegment}.${tamperedPayload}.${signatureSegment}`,
        vector.publicKey,
      ),
    ).rejects.toThrow('signature verification failed');
  });
});
