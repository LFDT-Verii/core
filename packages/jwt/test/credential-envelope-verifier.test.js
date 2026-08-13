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

const crypto = require('node:crypto');
const { describe, it } = require('node:test');
const { expect } = require('expect');
const { generateJWAKeyPair, KeyAlgorithms } = require('@verii/crypto');
const {
  CredentialVerificationErrorCodes,
  verifyCredentialEnvelope,
} = require('../src/credential-envelope-verifier');

const algorithmConfigs = [
  { algorithm: KeyAlgorithms.SECP256K1, joseAlgorithm: 'ES256K' },
  { algorithm: KeyAlgorithms.ES256, joseAlgorithm: 'ES256' },
  { algorithm: KeyAlgorithms.RS256, joseAlgorithm: 'RS256' },
];

const compactSign = (payload, privateJwk, protectedHeader) => {
  const encodedHeader = Buffer.from(JSON.stringify(protectedHeader)).toString(
    'base64url',
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = crypto.createPrivateKey({ key: privateJwk, format: 'jwk' });
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    dsaEncoding: 'ieee-p1363',
    key,
  });
  return `${signingInput}.${signature.toString('base64url')}`;
};

const prepareSigning = ({ algorithm, joseAlgorithm }) => {
  const keyPair = generateJWAKeyPair(algorithm);
  return {
    joseAlgorithm,
    keyPair,
    kid: `did:example:credential-${joseAlgorithm}#key-1`,
  };
};

const buildV2Credential = (signing, overrides = {}) => ({
  '@context': [
    'https://www.w3.org/ns/credentials/v2',
    {
      EmploymentCredential: 'https://example.com/EmploymentCredential',
      employer: 'https://example.com/employer',
    },
  ],
  id: signing.kid.split('#')[0],
  type: ['VerifiableCredential', 'EmploymentCredential'],
  issuer: 'did:example:issuer',
  validFrom: '2026-01-01T00:00:00.000Z',
  validUntil: '2099-01-01T00:00:00.000Z',
  credentialSubject: {
    id: 'did:example:holder',
    employer: 'Example Corp',
  },
  credentialSchema: {
    id: 'https://example.com/employment.schema.json',
    type: 'JsonSchema',
  },
  ...overrides,
});

const signV2 = (signing, overrides = {}, headerOverrides = {}) =>
  compactSign(
    buildV2Credential(signing, overrides),
    signing.keyPair.privateKey,
    {
      alg: signing.joseAlgorithm,
      cty: 'vc',
      kid: signing.kid,
      typ: 'vc+jwt',
      ...headerOverrides,
    },
  );

describe('credential envelope verifier', () => {
  for (const algorithmConfig of algorithmConfigs) {
    const { joseAlgorithm } = algorithmConfig;

    it(`verifies VC 2.0 with ${joseAlgorithm}`, async () => {
      const signing = prepareSigning(algorithmConfig);
      const compact = signV2(signing);

      await expect(
        verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
      ).resolves.toEqual(
        expect.objectContaining({
          credential: buildV2Credential(signing),
          dataModelVersion: '2.0',
          envelopeFormat: 'vc+jwt',
          signingAlgorithm: joseAlgorithm,
        }),
      );
    });
  }

  it('preserves VC 1.1 verification without applying v2 model rules', async () => {
    const signing = prepareSigning(algorithmConfigs[0]);
    const credential = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'EmploymentCredential'],
      issuer: 'did:example:issuer',
      credentialSubject: { id: 'did:example:holder' },
      credentialSchema: 'historically-unvalidated-schema',
    };
    const compact = compactSign(
      { iss: 'did:example:issuer', vc: credential },
      signing.keyPair.privateKey,
      { alg: 'ES256K', typ: 'JWT', jwk: signing.keyPair.publicKey },
    );

    await expect(
      verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
    ).resolves.toEqual(
      expect.objectContaining({
        dataModelVersion: '1.1',
        envelopeFormat: 'jwt_vc_json-ld',
        signingAlgorithm: 'ES256K',
      }),
    );
  });

  it('rejects an algorithm outside the version allowlist before crypto', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const compact = signV2(signing, {}, { alg: 'HS256' });

    await expect(
      verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
    ).rejects.toMatchObject({
      code: CredentialVerificationErrorCodes.UNSUPPORTED_ALGORITHM,
    });
  });

  it('accepts an object issuer, subject list, and absent optional schema and end date', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const compact = signV2(signing, {
      credentialSchema: undefined,
      credentialSubject: [{ id: 'did:example:holder' }],
      issuer: { id: 'did:example:issuer', name: 'Example Issuer' },
      validUntil: undefined,
    });

    await expect(
      verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
    ).resolves.toEqual(expect.objectContaining({ signingAlgorithm: 'ES256' }));
  });

  for (const [name, signingConfig, keyConfig] of [
    ['ES256 with secp256k1', algorithmConfigs[1], algorithmConfigs[0]],
    ['ES256K with P-256', algorithmConfigs[0], algorithmConfigs[1]],
    ['RS256 with EC', algorithmConfigs[2], algorithmConfigs[1]],
  ]) {
    it(`rejects ${name}`, async () => {
      const signing = prepareSigning(signingConfig);
      const wrongKey = prepareSigning(keyConfig).keyPair.publicKey;

      await expect(
        verifyCredentialEnvelope(signV2(signing), wrongKey),
      ).rejects.toMatchObject({
        code: CredentialVerificationErrorCodes.ALGORITHM_KEY_MISMATCH,
      });
    });
  }

  for (const [name, headerOverrides] of [
    ['an expanded typ', { typ: 'application/vc+jwt' }],
    ['a missing cty', { cty: undefined }],
    ['an incorrect cty', { cty: 'application/vc' }],
  ]) {
    it(`rejects ${name}`, async () => {
      const signing = prepareSigning(algorithmConfigs[1]);

      await expect(
        verifyCredentialEnvelope(
          signV2(signing, {}, headerOverrides),
          signing.keyPair.publicKey,
        ),
      ).rejects.toMatchObject({
        code: CredentialVerificationErrorCodes.HEADER_INVALID,
      });
    });
  }

  for (const [name, overrides, expectedCode] of [
    ['a missing id', { id: undefined }, 'CREDENTIAL_MODEL_INVALID'],
    ['a missing issuer', { issuer: undefined }, 'CREDENTIAL_MODEL_INVALID'],
    [
      'a missing subject',
      { credentialSubject: undefined },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'a missing validFrom',
      { validFrom: undefined },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'an invalid validFrom',
      { validFrom: 'yesterday' },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'an oversized validFrom',
      { validFrom: '2'.repeat(65) },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'an invalid validUntil',
      { validUntil: 'tomorrow' },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'an impossible calendar date',
      { validFrom: '2026-02-30T00:00:00Z' },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'a date without a time',
      { validFrom: '2026-01-01Z' },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'an out-of-range timezone offset',
      { validFrom: '2026-01-01T00:00:00+24:00' },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'a leap-second validFrom',
      { validFrom: '2099-12-31T23:59:60Z', validUntil: undefined },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'a reversed validity interval',
      { validUntil: '2025-01-01T00:00:00.000Z' },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'a malformed schema',
      { credentialSchema: 'schema' },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'a schema descriptor with a malformed id URL',
      {
        credentialSchema: { id: 'not a uri', type: 'JsonSchema' },
      },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'an empty schema list',
      { credentialSchema: [] },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'a compatibility claim',
      { iss: 'did:example:issuer' },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'an insecure context',
      {
        '@context': [
          'https://www.w3.org/ns/credentials/v2',
          'http://example.com/context',
        ],
      },
      'CREDENTIAL_CONTEXT_INVALID',
    ],
    [
      'an empty inline context',
      { '@context': ['https://www.w3.org/ns/credentials/v2', {}] },
      'CREDENTIAL_CONTEXT_INVALID',
    ],
    [
      'a non-string context',
      { '@context': ['https://www.w3.org/ns/credentials/v2', 42] },
      'CREDENTIAL_CONTEXT_INVALID',
    ],
    [
      'a duplicated base context',
      {
        '@context': [
          'https://www.w3.org/ns/credentials/v2',
          'https://www.w3.org/ns/credentials/v2',
        ],
      },
      'CREDENTIAL_CONTEXT_INVALID',
    ],
  ]) {
    it(`rejects ${name}`, async () => {
      const signing = prepareSigning(algorithmConfigs[1]);
      await expect(
        verifyCredentialEnvelope(
          signV2(signing, overrides),
          signing.keyPair.publicKey,
        ),
      ).rejects.toMatchObject({ code: expectedCode });
    });
  }

  it('maps malformed contexts and model properties to stable public errors', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);

    await expect(
      verifyCredentialEnvelope(
        signV2(signing, {
          '@context': [
            'https://www.w3.org/ns/credentials/v2',
            'http://example.com/context',
          ],
          issuer: undefined,
        }),
        signing.keyPair.publicKey,
      ),
    ).rejects.toMatchObject({
      code: CredentialVerificationErrorCodes.CONTEXT_INVALID,
      message:
        'VC 2.0 contexts must be a bounded list of HTTPS URLs or inline definitions',
    });

    await expect(
      verifyCredentialEnvelope(
        signV2(signing, { issuer: { name: 'Missing id' } }),
        signing.keyPair.publicKey,
      ),
    ).rejects.toMatchObject({
      code: CredentialVerificationErrorCodes.MODEL_INVALID,
      message:
        'VC 2.0 credential is missing or has invalid required properties',
    });
  });

  it('rejects an unrelated kid even when the signature key is known', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const compact = signV2(signing, {}, { kid: 'did:example:other#key-1' });

    await expect(
      verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
    ).rejects.toMatchObject({
      code: CredentialVerificationErrorCodes.KID_BINDING_INVALID,
    });
  });

  it('rejects a did:jwk self-signed credential with another issuer', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const didJwk = `did:jwk:${Buffer.from(
      JSON.stringify(signing.keyPair.publicKey),
    ).toString('base64url')}`;
    const didJwkSigning = { ...signing, kid: `${didJwk}#0` };
    const compact = signV2(didJwkSigning, {
      issuer: 'did:example:another-issuer',
    });

    await expect(
      verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
    ).rejects.toMatchObject({
      code: CredentialVerificationErrorCodes.KID_BINDING_INVALID,
    });
  });

  it('accepts a did:jwk self-signed credential with the key controller issuer', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const didJwk = `did:jwk:${Buffer.from(
      JSON.stringify(signing.keyPair.publicKey),
    ).toString('base64url')}`;
    const didJwkSigning = { ...signing, kid: `${didJwk}#0` };
    const compact = signV2(didJwkSigning, { issuer: didJwk });

    await expect(
      verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
    ).resolves.toEqual(expect.objectContaining({ signingAlgorithm: 'ES256' }));
  });

  it('rejects a kid with an empty fragment', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const compact = signV2(
      signing,
      {},
      { kid: `${signing.kid.split('#')[0]}#` },
    );

    await expect(
      verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
    ).rejects.toMatchObject({
      code: CredentialVerificationErrorCodes.KID_BINDING_INVALID,
    });
  });

  it('rejects a kid over the resolution bound', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const compact = signV2(signing, {}, { kid: `${'a'.repeat(2048)}#key` });

    await expect(
      verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
    ).rejects.toMatchObject({
      code: CredentialVerificationErrorCodes.KID_BINDING_INVALID,
    });
  });

  it('rejects a malformed context URL', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const compact = signV2(signing, {
      '@context': ['https://www.w3.org/ns/credentials/v2', 'not a URL'],
    });

    await expect(
      verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
    ).rejects.toMatchObject({
      code: CredentialVerificationErrorCodes.CONTEXT_INVALID,
    });
  });

  it('rejects more than the bounded number of contexts', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const compact = signV2(signing, {
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        ...Array.from(
          { length: 16 },
          (_, index) => `https://example.com/context-${index}`,
        ),
      ],
    });

    await expect(
      verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
    ).rejects.toMatchObject({
      code: CredentialVerificationErrorCodes.CONTEXT_INVALID,
    });
  });

  it('rejects an unexpected curve property on an RSA key', async () => {
    const signing = prepareSigning(algorithmConfigs[2]);

    await expect(
      verifyCredentialEnvelope(signV2(signing), {
        ...signing.keyPair.publicKey,
        crv: 'P-256',
      }),
    ).rejects.toMatchObject({
      code: CredentialVerificationErrorCodes.ALGORITHM_KEY_MISMATCH,
    });
  });

  it('rejects a tampered signed payload', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const compact = signV2(signing);
    const segments = compact.split('.');
    const tampered = `${segments[0]}.${Buffer.from(
      JSON.stringify(buildV2Credential(signing, { issuer: 'did:attacker' })),
    ).toString('base64url')}.${segments[2]}`;

    await expect(
      verifyCredentialEnvelope(tampered, signing.keyPair.publicKey),
    ).rejects.toThrow('signature verification failed');
  });

  it('does not accept a caller-controlled signature verifier', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const compact = signV2(signing);
    const segments = compact.split('.');
    const tampered = `${segments[0]}.${Buffer.from(
      JSON.stringify(
        buildV2Credential(signing, {
          credentialSubject: {
            id: 'did:example:attacker',
            role: 'admin',
          },
        }),
      ),
    ).toString('base64url')}.${segments[2]}`;

    await expect(
      verifyCredentialEnvelope(
        tampered,
        signing.keyPair.publicKey,
        async () => undefined,
      ),
    ).rejects.toThrow('signature verification failed');
  });

  it('does not expose the decoded credential to a key resolver', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const compact = signV2(signing);
    const mutateEnvelope = (envelope) => {
      envelope.credential.credentialSubject.role = 'admin';
      return signing.keyPair.publicKey;
    };

    await expect(
      verifyCredentialEnvelope(compact, mutateEnvelope),
    ).rejects.toMatchObject({
      code: CredentialVerificationErrorCodes.ALGORITHM_KEY_MISMATCH,
    });
  });

  it('rejects an unsupported fixed verification mode', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);

    await expect(
      verifyCredentialEnvelope(signV2(signing), signing.keyPair.publicKey, {
        mode: 'no-verification',
      }),
    ).rejects.toThrow('Unsupported credential verification mode');
  });
});
