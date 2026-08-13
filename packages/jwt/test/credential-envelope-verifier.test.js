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
  CredentialVerificationStatuses,
  CredentialVerificationWarningCodes,
  verifyCredentialEnvelope,
} = require('../src/credential-envelope-verifier');
const { jwkToPublicBase64Url } = require('../src/core');

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
    kid: `did:example:issuer-${joseAlgorithm}#key-1`,
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
  id: `https://example.com/credentials/${signing.joseAlgorithm}`,
  type: ['VerifiableCredential', 'EmploymentCredential'],
  issuer: signing.kid.split('#')[0],
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

const expectFailure = async (promise, assessment, code) => {
  const result = await promise;
  expect(result).toMatchObject({
    [assessment]: {
      errors: expect.arrayContaining([expect.objectContaining({ code })]),
      status: CredentialVerificationStatuses.FAIL,
    },
  });
  expect(result).not.toHaveProperty('credential');
  return result;
};

// eslint-disable-next-line complexity
describe('credential envelope verifier', () => {
  for (const algorithmConfig of algorithmConfigs) {
    const { joseAlgorithm } = algorithmConfig;

    it(`verifies VC 2.0 with ${joseAlgorithm}`, async () => {
      const signing = prepareSigning(algorithmConfig);

      await expect(
        verifyCredentialEnvelope(signV2(signing), signing.keyPair.publicKey),
      ).resolves.toMatchObject({
        conformance: { errors: [], status: 'PASS', warnings: [] },
        credential: buildV2Credential(signing),
        dataModelVersion: '2.0',
        envelopeFormat: 'vc+jwt',
        policy: {
          errors: [],
          profile: 'velocity-vc-v2',
          status: 'PASS',
          warnings: [],
        },
        proof: { errors: [], status: 'PASS' },
        signingAlgorithm: joseAlgorithm,
      });
    });
  }

  it('preserves VC 1.1 verification without applying v2 rules', async () => {
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
    ).resolves.toMatchObject({
      conformance: { status: 'NOT_APPLICABLE' },
      credential: {
        ...credential,
        issuer: { id: 'did:example:issuer' },
      },
      dataModelVersion: '1.1',
      envelopeFormat: 'jwt_vc_json-ld',
      policy: { status: 'NOT_APPLICABLE' },
      proof: { status: 'PASS' },
      signingAlgorithm: 'ES256K',
    });
  });

  it('reports an algorithm outside the version allowlist as a proof failure', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);

    await expectFailure(
      verifyCredentialEnvelope(
        signV2(signing, {}, { alg: 'HS256' }),
        signing.keyPair.publicKey,
      ),
      'proof',
      CredentialVerificationErrorCodes.UNSUPPORTED_ALGORITHM,
    );
  });

  it('accepts optional core properties and object/list forms', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const compact = signV2(signing, {
      credentialSchema: undefined,
      credentialSubject: [{ id: 'did:example:holder' }],
      issuer: { id: signing.kid.split('#')[0], name: 'Example Issuer' },
      validUntil: undefined,
    });

    await expect(
      verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
    ).resolves.toMatchObject({ credential: expect.any(Object) });
  });

  for (const [name, signingConfig, keyConfig] of [
    ['ES256 with secp256k1', algorithmConfigs[1], algorithmConfigs[0]],
    ['ES256K with P-256', algorithmConfigs[0], algorithmConfigs[1]],
    ['RS256 with EC', algorithmConfigs[2], algorithmConfigs[1]],
  ]) {
    it(`reports ${name} as a proof failure`, async () => {
      const signing = prepareSigning(signingConfig);
      const wrongKey = prepareSigning(keyConfig).keyPair.publicKey;

      await expectFailure(
        verifyCredentialEnvelope(signV2(signing), wrongKey),
        'proof',
        CredentialVerificationErrorCodes.ALGORITHM_KEY_MISMATCH,
      );
    });
  }

  for (const [name, headerOverrides, warningCode] of [
    [
      'an expanded typ',
      { typ: 'application/vc+jwt' },
      CredentialVerificationWarningCodes.TYP_NOT_RECOMMENDED,
    ],
    [
      'a generic JWT typ',
      { typ: 'JWT' },
      CredentialVerificationWarningCodes.TYP_NOT_RECOMMENDED,
    ],
    [
      'a missing typ',
      { typ: undefined },
      CredentialVerificationWarningCodes.TYP_MISSING,
    ],
    ['a missing cty', { cty: undefined }, undefined],
    [
      'an alternate cty',
      { cty: 'application/vc' },
      CredentialVerificationWarningCodes.CTY_NOT_RECOMMENDED,
    ],
  ]) {
    it(`accepts ${name}`, async () => {
      const signing = prepareSigning(algorithmConfigs[1]);
      const result = await verifyCredentialEnvelope(
        signV2(signing, {}, headerOverrides),
        signing.keyPair.publicKey,
      );

      expect(result).toMatchObject({
        conformance: { status: 'PASS' },
        credential: expect.any(Object),
      });
      if (warningCode == null) {
        expect(result.conformance.warnings).toEqual([]);
      } else {
        expect(result.conformance.warnings).toContainEqual(
          expect.objectContaining({ code: warningCode }),
        );
      }
    });
  }

  it('rejects a malformed cty value as a conformance failure', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);

    await expectFailure(
      verifyCredentialEnvelope(
        signV2(signing, {}, { cty: 42 }),
        signing.keyPair.publicKey,
      ),
      'conformance',
      CredentialVerificationErrorCodes.HEADER_INVALID,
    );
  });

  it('rejects a malformed typ value as a conformance failure', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);

    await expectFailure(
      verifyCredentialEnvelope(
        signV2(signing, {}, { typ: 42 }),
        signing.keyPair.publicKey,
      ),
      'conformance',
      CredentialVerificationErrorCodes.HEADER_INVALID,
    );
  });

  for (const [name, overrides, expectedCode] of [
    ['a missing issuer', { issuer: undefined }, 'CREDENTIAL_MODEL_INVALID'],
    [
      'a missing subject',
      { credentialSubject: undefined },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'a missing VerifiableCredential type',
      { type: ['EmploymentCredential'] },
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
      { credentialSchema: { id: 'not a uri', type: 'JsonSchema' } },
      'CREDENTIAL_MODEL_INVALID',
    ],
    [
      'an empty schema list',
      { credentialSchema: [] },
      'CREDENTIAL_MODEL_INVALID',
    ],
    ['a prohibited vc claim', { vc: {} }, 'CREDENTIAL_MODEL_INVALID'],
    ['a prohibited vp claim', { vp: {} }, 'CREDENTIAL_MODEL_INVALID'],
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
    it(`reports ${name} as a conformance failure`, async () => {
      const signing = prepareSigning(algorithmConfigs[1]);
      await expectFailure(
        verifyCredentialEnvelope(
          signV2(signing, overrides),
          signing.keyPair.publicKey,
        ),
        'conformance',
        expectedCode,
      );
    });
  }

  for (const [name, overrides] of [
    ['a missing id', { id: undefined }],
    ['a missing validFrom', { validFrom: undefined }],
  ]) {
    it(`reports ${name} as a Velocity policy failure`, async () => {
      const signing = prepareSigning(algorithmConfigs[1]);
      await expectFailure(
        verifyCredentialEnvelope(
          signV2(signing, overrides),
          signing.keyPair.publicKey,
        ),
        'policy',
        CredentialVerificationErrorCodes.PROFILE_INVALID,
      );
    });
  }

  it('accepts registered JWT claims and reports SHOULD mismatches as warnings', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const result = await verifyCredentialEnvelope(
      signV2(signing, {
        aud: ['https://verifier.example'],
        exp: 4070908800,
        iat: 1767225600,
        iss: signing.kid.split('#')[0],
        jti: 'https://example.com/another-credential-id',
        nbf: 1767225600,
        sub: 'did:example:another-holder',
      }),
      signing.keyPair.publicKey,
      { audience: 'https://verifier.example', currentTime: 1798761600000 },
    );

    expect(result).toMatchObject({
      conformance: { errors: [], status: 'PASS' },
      credential: expect.any(Object),
      policy: { errors: [], status: 'PASS' },
    });
    expect(result.conformance.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CREDENTIAL_JTI_ID_MISMATCH' }),
        expect.objectContaining({ code: 'CREDENTIAL_NBF_NOT_RECOMMENDED' }),
        expect.objectContaining({ code: 'CREDENTIAL_SUBJECT_ID_MISMATCH' }),
      ]),
    );
  });

  it('reports an iss mismatch as a warning', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const result = await verifyCredentialEnvelope(
      signV2(signing, { iss: 'did:example:another-issuer' }),
      signing.keyPair.publicKey,
    );

    expect(result).toMatchObject({
      conformance: { errors: [], status: 'PASS' },
      credential: expect.any(Object),
    });
    expect(result.conformance.warnings).toContainEqual(
      expect.objectContaining({
        code: CredentialVerificationWarningCodes.ISSUER_CLAIM_MISMATCH,
      }),
    );
  });

  for (const [claim, value] of [
    ['aud', []],
    ['exp', '2099-01-01T00:00:00Z'],
    ['iat', '2026-01-01T00:00:00Z'],
    ['iss', 42],
    ['jti', 42],
    ['nbf', '2026-01-01T00:00:00Z'],
    ['sub', 42],
  ]) {
    it(`reports a malformed ${claim} claim as conformance`, async () => {
      const signing = prepareSigning(algorithmConfigs[1]);
      await expectFailure(
        verifyCredentialEnvelope(
          signV2(signing, { [claim]: value }),
          signing.keyPair.publicKey,
        ),
        'conformance',
        CredentialVerificationErrorCodes.JWT_CLAIM_INVALID,
      );
    });
  }

  it('evaluates registered time and audience claims as policy', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);

    await expectFailure(
      verifyCredentialEnvelope(
        signV2(signing, { exp: 1, nbf: 4070908800 }),
        signing.keyPair.publicKey,
        { audience: 'https://verifier.example', currentTime: 1798761600000 },
      ),
      'policy',
      CredentialVerificationErrorCodes.TOKEN_EXPIRED,
    );
  });

  for (const [name, options, message] of [
    [
      'a NaN current time',
      { currentTime: Number.NaN },
      'currentTime must be a finite number',
    ],
    [
      'an infinite current time',
      { currentTime: Number.POSITIVE_INFINITY },
      'currentTime must be a finite number',
    ],
    [
      'a NaN clock tolerance',
      { clockToleranceMilliseconds: Number.NaN },
      'clockToleranceMilliseconds must be a finite non-negative number',
    ],
    [
      'an infinite clock tolerance',
      { clockToleranceMilliseconds: Number.POSITIVE_INFINITY },
      'clockToleranceMilliseconds must be a finite non-negative number',
    ],
    [
      'a negative clock tolerance',
      { clockToleranceMilliseconds: -1 },
      'clockToleranceMilliseconds must be a finite non-negative number',
    ],
  ]) {
    it(`rejects ${name}`, async () => {
      const signing = prepareSigning(algorithmConfigs[1]);

      await expect(
        verifyCredentialEnvelope(
          signV2(signing, { exp: 1, nbf: 4070908800 }),
          signing.keyPair.publicKey,
          options,
        ),
      ).rejects.toThrow(new TypeError(message));
    });
  }

  it('does not bind kid to the credential id', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const compact = signV2(
      signing,
      {},
      { kid: 'did:example:issuer#other-key' },
    );

    await expect(
      verifyCredentialEnvelope(compact, signing.keyPair.publicKey),
    ).resolves.toMatchObject({ credential: expect.any(Object) });
  });

  it('enforces did:jwk self-signed issuer binding as conformance', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const didJwk = `did:jwk:${jwkToPublicBase64Url(signing.keyPair.publicKey)}`;
    const didJwkSigning = { ...signing, kid: `${didJwk}#0` };

    await expectFailure(
      verifyCredentialEnvelope(
        signV2(didJwkSigning, { issuer: 'did:example:another-issuer' }),
        signing.keyPair.publicKey,
      ),
      'conformance',
      CredentialVerificationErrorCodes.SELF_SIGNED_ISSUER_INVALID,
    );

    await expect(
      verifyCredentialEnvelope(
        signV2(didJwkSigning, { issuer: didJwk }),
        signing.keyPair.publicKey,
      ),
    ).resolves.toMatchObject({ credential: expect.any(Object) });
  });

  it('rejects a did:jwk controller that encodes a different key', async () => {
    const attacker = prepareSigning(algorithmConfigs[1]);
    const claimedKey = prepareSigning(algorithmConfigs[1]);
    const claimedDid = `did:jwk:${jwkToPublicBase64Url(
      claimedKey.keyPair.publicKey,
    )}`;
    const attackerSigning = { ...attacker, kid: `${claimedDid}#0` };

    await expectFailure(
      verifyCredentialEnvelope(
        signV2(attackerSigning, { issuer: claimedDid }),
        attacker.keyPair.publicKey,
      ),
      'conformance',
      CredentialVerificationErrorCodes.SELF_SIGNED_ISSUER_INVALID,
    );
  });

  it('accepts an externally resolved kid with an empty fragment', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);

    await expect(
      verifyCredentialEnvelope(
        signV2(signing, {}, { kid: `${signing.kid.split('#')[0]}#` }),
        signing.keyPair.publicKey,
      ),
    ).resolves.toMatchObject({ credential: expect.any(Object) });
  });

  it('reports a kid over the local resolution bound as conformance', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    await expectFailure(
      verifyCredentialEnvelope(
        signV2(signing, {}, { kid: `${'a'.repeat(2048)}#key` }),
        signing.keyPair.publicKey,
      ),
      'conformance',
      CredentialVerificationErrorCodes.KID_INVALID,
    );
  });

  for (const [name, context] of [
    [
      'a malformed context URL',
      ['https://www.w3.org/ns/credentials/v2', 'not a URL'],
    ],
    [
      'too many contexts',
      [
        'https://www.w3.org/ns/credentials/v2',
        ...Array.from(
          { length: 16 },
          (_, index) => `https://example.com/context-${index}`,
        ),
      ],
    ],
  ]) {
    it(`reports ${name} as conformance`, async () => {
      const signing = prepareSigning(algorithmConfigs[1]);
      await expectFailure(
        verifyCredentialEnvelope(
          signV2(signing, { '@context': context }),
          signing.keyPair.publicKey,
        ),
        'conformance',
        CredentialVerificationErrorCodes.CONTEXT_INVALID,
      );
    });
  }

  it('reports an unexpected RSA curve as a proof failure', async () => {
    const signing = prepareSigning(algorithmConfigs[2]);
    await expectFailure(
      verifyCredentialEnvelope(signV2(signing), {
        ...signing.keyPair.publicKey,
        crv: 'P-256',
      }),
      'proof',
      CredentialVerificationErrorCodes.ALGORITHM_KEY_MISMATCH,
    );
  });

  it('reports a tampered signed payload as proof failure', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const segments = signV2(signing).split('.');
    const tampered = `${segments[0]}.${Buffer.from(
      JSON.stringify(buildV2Credential(signing, { issuer: 'did:attacker' })),
    ).toString('base64url')}.${segments[2]}`;

    await expectFailure(
      verifyCredentialEnvelope(tampered, signing.keyPair.publicKey),
      'proof',
      CredentialVerificationErrorCodes.SIGNATURE_INVALID,
    );
  });

  it('does not accept a caller-controlled signature verifier', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const segments = signV2(signing).split('.');
    const tampered = `${segments[0]}.${Buffer.from(
      JSON.stringify(
        buildV2Credential(signing, {
          credentialSubject: { id: 'did:example:attacker', role: 'admin' },
        }),
      ),
    ).toString('base64url')}.${segments[2]}`;

    await expectFailure(
      verifyCredentialEnvelope(
        tampered,
        signing.keyPair.publicKey,
        async () => undefined,
      ),
      'proof',
      CredentialVerificationErrorCodes.SIGNATURE_INVALID,
    );
  });

  it('does not expose the decoded credential to a key resolver', async () => {
    const signing = prepareSigning(algorithmConfigs[1]);
    const mutateEnvelope = (envelope) => {
      envelope.credential.credentialSubject.role = 'admin';
      return signing.keyPair.publicKey;
    };

    await expectFailure(
      verifyCredentialEnvelope(signV2(signing), mutateEnvelope),
      'proof',
      CredentialVerificationErrorCodes.ALGORITHM_KEY_MISMATCH,
    );
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
