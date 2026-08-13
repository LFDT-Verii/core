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
const { after, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const getRevokedStatus = mock.fn(() => Promise.resolve(0));
const initRevocationRegistry = mock.fn(() => ({ getRevokedStatus }));
mock.module('@verii/metadata-registration', {
  namedExports: {
    initMetadataRegistry: mock.fn(),
    initRevocationRegistry,
    initVerificationCoupon: mock.fn(),
  },
});

const { generateJWAKeyPair, KeyAlgorithms } = require('@verii/crypto');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { generateCredentialJwt, tamperJwt } = require('@verii/jwt');
const {
  CheckResults,
  VeriiProtocolVersions,
  VelocityRevocationListType,
} = require('@verii/vc-checks');
const { verifyCredentials } = require('../src/verify-credentials');

const algorithms = [
  {
    algorithm: KeyAlgorithms.SECP256K1,
    joseAlgorithm: 'ES256K',
  },
  {
    algorithm: KeyAlgorithms.ES256,
    joseAlgorithm: 'ES256',
  },
  {
    algorithm: KeyAlgorithms.RS256,
    joseAlgorithm: 'RS256',
  },
];

const baseCredential = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  id: 'urn:uuid:credential-1',
  type: ['VerifiableCredential', 'EmploymentCredential'],
  issuer: 'did:example:issuer',
  issuanceDate: '2026-01-01T00:00:00.000Z',
  expirationDate: '2099-01-01T00:00:00.000Z',
  credentialSubject: {
    id: 'did:example:holder',
    employer: 'Example Corp',
  },
  credentialSchema: {
    id: 'https://example.com/employment.schema.json',
    type: 'JsonSchemaValidator2018',
  },
  credentialStatus: {
    id: 'wallet:status:1',
    type: 'WalletStatusList',
  },
  vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
};

const context = {
  config: { revocationContractAddress: '0x01' },
  log: {
    error: mock.fn(),
    info: mock.fn(),
    warn: mock.fn(),
  },
  tenant: { did: 'did:example:relying-party' },
};

const fetchers = {
  getCredentialTypeMetadata: mock.fn(() => Promise.resolve([])),
  getOrganizationVerifiedProfile: mock.fn(() => Promise.resolve()),
  resolveDid: mock.fn(() => Promise.resolve()),
};

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

const issueLegacyCredential = async (credential, { algorithm, keyPair, kid }) =>
  generateCredentialJwt(credential, keyPair.privateKey, kid, algorithm);

const issueV2Credential = (credential, { joseAlgorithm, keyPair, kid }) =>
  compactSign(credential, keyPair.privateKey, {
    alg: joseAlgorithm,
    cty: 'vc',
    kid,
    typ: 'vc+jwt',
  });

const prepareAlgorithm = ({ algorithm, joseAlgorithm }) => {
  const keyPair = generateJWAKeyPair(algorithm);
  const did = getDidUriFromJwk(keyPair.publicKey);
  return {
    algorithm,
    did,
    joseAlgorithm,
    keyPair,
    kid: `${did}#0`,
  };
};

const verify = (credential, expectedHolderDid = 'did:example:holder') =>
  verifyCredentials(
    {
      credentials: [credential],
      expectedHolderDid,
    },
    fetchers,
    context,
  );

describe('dual-version verification guardrails', () => {
  beforeEach(() => {
    getRevokedStatus.mock.resetCalls();
    getRevokedStatus.mock.mockImplementation(() => Promise.resolve(0));
  });

  after(() => mock.reset());

  describe('VC 1.1 compatibility outcomes', () => {
    for (const algorithmConfig of algorithms) {
      const { joseAlgorithm } = algorithmConfig;

      it(`preserves valid ${joseAlgorithm} verification`, async () => {
        const signing = prepareAlgorithm(algorithmConfig);
        const credential = {
          ...baseCredential,
          issuer: signing.did,
        };
        const result = await verify(
          await issueLegacyCredential(credential, signing),
        );

        expect(result).toEqual([
          expect.objectContaining({
            credential: {
              ...credential,
              issuer: { id: signing.did },
            },
            credentialChecks: {
              TRUSTED_HOLDER: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.SELF_SIGNED,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.NOT_APPLICABLE,
              UNTAMPERED: CheckResults.PASS,
            },
          }),
        ]);
      });

      it(`preserves expired ${joseAlgorithm} verification`, async () => {
        const signing = prepareAlgorithm(algorithmConfig);
        const credential = {
          ...baseCredential,
          expirationDate: '2020-01-01T00:00:00.000Z',
          issuer: signing.did,
        };
        const result = await verify(
          await issueLegacyCredential(credential, signing),
        );

        expect(result[0].credentialChecks).toEqual(
          expect.objectContaining({
            UNEXPIRED: CheckResults.FAIL,
            UNTAMPERED: CheckResults.PASS,
          }),
        );
      });

      it(`preserves revoked ${joseAlgorithm} verification`, async () => {
        getRevokedStatus.mock.mockImplementation(() => Promise.resolve(1n));
        const signing = prepareAlgorithm(algorithmConfig);
        const credential = {
          ...baseCredential,
          issuer: signing.did,
          credentialStatus: {
            id: 'ethereum:velocity:1',
            type: VelocityRevocationListType,
          },
        };
        const result = await verify(
          await issueLegacyCredential(credential, signing),
        );

        expect(result[0].credentialChecks).toEqual(
          expect.objectContaining({
            UNREVOKED: CheckResults.FAIL,
            UNTAMPERED: CheckResults.PASS,
          }),
        );
      });

      it(`preserves wrong-holder ${joseAlgorithm} verification`, async () => {
        const signing = prepareAlgorithm(algorithmConfig);
        const credential = {
          ...baseCredential,
          issuer: signing.did,
        };
        const result = await verify(
          await issueLegacyCredential(credential, signing),
          'did:example:wrong-holder',
        );

        expect(result[0].credentialChecks).toEqual(
          expect.objectContaining({
            TRUSTED_HOLDER: CheckResults.FAIL,
            UNTAMPERED: CheckResults.PASS,
          }),
        );
      });

      it(`preserves legacy wrong-issuer ${joseAlgorithm} outcome`, async () => {
        const signing = prepareAlgorithm(algorithmConfig);
        const credential = {
          ...baseCredential,
          issuer: 'did:example:wrong-issuer',
        };
        const result = await verify(
          await issueLegacyCredential(credential, signing),
        );

        expect(result[0].credentialChecks).toEqual(
          expect.objectContaining({
            TRUSTED_ISSUER: CheckResults.SELF_SIGNED,
            UNTAMPERED: CheckResults.PASS,
          }),
        );
      });

      it(`preserves legacy invalid-schema ${joseAlgorithm} outcome`, async () => {
        const signing = prepareAlgorithm(algorithmConfig);
        const credential = {
          ...baseCredential,
          issuer: signing.did,
          credentialSchema: 'not-a-v1-schema-object',
        };
        const result = await verify(
          await issueLegacyCredential(credential, signing),
        );

        expect(result[0].credentialChecks).toEqual(
          expect.objectContaining({
            TRUSTED_ISSUER: CheckResults.SELF_SIGNED,
            UNTAMPERED: CheckResults.PASS,
          }),
        );
      });

      it(`preserves tampered ${joseAlgorithm} verification`, async () => {
        const signing = prepareAlgorithm(algorithmConfig);
        const credential = {
          ...baseCredential,
          issuer: signing.did,
        };
        const signed = await issueLegacyCredential(credential, signing);
        const result = await verify(
          tamperJwt(signed, {
            vc: { ...credential, credentialSubject: { id: 'attacker' } },
          }),
        );

        expect(result[0].credentialChecks).toEqual({
          TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
          TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
          UNEXPIRED: CheckResults.NOT_CHECKED,
          UNREVOKED: CheckResults.NOT_CHECKED,
          UNTAMPERED: CheckResults.FAIL,
        });
      });

      it(`preserves unresolved-key ${joseAlgorithm} verification`, async () => {
        const signing = prepareAlgorithm(algorithmConfig);
        const credential = {
          ...baseCredential,
          issuer: signing.did,
        };
        const signed = await issueLegacyCredential(credential, {
          ...signing,
          kid: 'did:web:unsupported.example#key-1',
        });
        const result = await verify(signed);

        expect(result[0].credentialChecks).toEqual({
          TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
          TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
          UNEXPIRED: CheckResults.NOT_CHECKED,
          UNREVOKED: CheckResults.NOT_CHECKED,
          UNTAMPERED: CheckResults.DEPENDENCY_RESOLUTION_ERROR,
        });
      });

      it(`preserves algorithm/key mismatch ${joseAlgorithm} verification`, async () => {
        const signing = prepareAlgorithm(algorithmConfig);
        const mismatchedSigning = prepareAlgorithm(
          algorithmConfig.algorithm === KeyAlgorithms.RS256
            ? algorithms[1]
            : algorithms[2],
        );
        const credential = {
          ...baseCredential,
          issuer: signing.did,
        };
        const signed = await issueLegacyCredential(credential, {
          ...mismatchedSigning,
          kid: signing.kid,
        });
        const result = await verify(signed);

        expect(result[0].credentialChecks).toEqual({
          TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
          TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
          UNEXPIRED: CheckResults.NOT_CHECKED,
          UNREVOKED: CheckResults.NOT_CHECKED,
          UNTAMPERED: CheckResults.FAIL,
        });
      });
    }

    it('preserves legacy expiration-only validity semantics', async () => {
      const signing = prepareAlgorithm(algorithms[1]);
      const credential = {
        ...baseCredential,
        issuer: signing.did,
        validFrom: '2099-01-01T00:00:00.000Z',
      };
      const result = await verify(
        await issueLegacyCredential(credential, signing),
      );

      expect(result[0].credentialChecks).toEqual(
        expect.objectContaining({
          UNEXPIRED: CheckResults.PASS,
          UNTAMPERED: CheckResults.PASS,
        }),
      );
    });
  });

  describe('VC 2.0 desired behavior', () => {
    for (const algorithmConfig of algorithms) {
      const { joseAlgorithm } = algorithmConfig;

      it(`verifies an independently signed ${joseAlgorithm} direct credential`, async () => {
        const signing = prepareAlgorithm(algorithmConfig);
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          id: signing.did,
          type: ['VerifiableCredential', 'EmploymentCredential'],
          issuer: signing.did,
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
          credentialStatus: {
            id: 'wallet:status:1',
            type: 'WalletStatusList',
          },
          vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
        };
        const result = await verify(issueV2Credential(credential, signing));

        expect(result).toEqual([
          {
            conformance: {
              errors: [],
              status: 'PASS',
              warnings: [],
            },
            credential,
            credentialChecks: {
              TRUSTED_HOLDER: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.SELF_SIGNED,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.NOT_APPLICABLE,
              UNTAMPERED: CheckResults.PASS,
            },
            dataModelVersion: '2.0',
            envelopeFormat: 'vc+jwt',
            policy: {
              errors: [],
              profile: 'velocity-vc-v2',
              status: 'PASS',
              warnings: [],
            },
            proof: {
              errors: [],
              status: 'PASS',
            },
            signingAlgorithm: joseAlgorithm,
          },
        ]);
      });
    }

    it('maps a VC 2.0 proof failure to the legacy tampering check', async () => {
      const signing = prepareAlgorithm(algorithms[1]);
      const attacker = prepareAlgorithm(algorithms[1]);
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        credentialSubject: { id: 'did:example:holder' },
        id: 'https://example.com/credentials/123',
        issuer: signing.did,
        type: ['VerifiableCredential', 'EmploymentCredential'],
        validFrom: '2026-01-01T00:00:00.000Z',
        vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
      };
      const forged = compactSign(credential, attacker.keyPair.privateKey, {
        alg: signing.joseAlgorithm,
        cty: 'vc',
        kid: signing.kid,
        typ: 'vc+jwt',
      });

      const [result] = await verify(forged);

      expect(result).toMatchObject({
        conformance: { status: 'NOT_CHECKED' },
        credential: null,
        credentialChecks: { UNTAMPERED: CheckResults.FAIL },
        policy: { status: 'NOT_CHECKED' },
        proof: { status: 'FAIL' },
      });
    });

    it('maps a VC 2.0 profile failure to the legacy tampering check', async () => {
      const signing = prepareAlgorithm(algorithms[1]);
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        credentialSubject: { id: 'did:example:holder' },
        issuer: signing.did,
        type: ['VerifiableCredential', 'EmploymentCredential'],
        validFrom: '2026-01-01T00:00:00.000Z',
        vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
      };

      const [result] = await verify(issueV2Credential(credential, signing));

      expect(result).toMatchObject({
        conformance: { status: 'PASS' },
        credential: null,
        credentialChecks: { UNTAMPERED: CheckResults.FAIL },
        policy: { status: 'FAIL' },
        proof: { status: 'PASS' },
      });
    });

    it('fails a v2 credential before validFrom', async () => {
      const signing = prepareAlgorithm(algorithms[1]);
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: signing.did,
        type: ['VerifiableCredential', 'EmploymentCredential'],
        issuer: signing.did,
        validFrom: '2099-01-01T00:00:00.000Z',
        credentialSubject: { id: 'did:example:holder' },
        vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
      };
      const result = await verify(issueV2Credential(credential, signing));

      expect(result[0].credentialChecks).toEqual(
        expect.objectContaining({
          UNEXPIRED: CheckResults.FAIL,
          UNTAMPERED: CheckResults.PASS,
        }),
      );
    });

    it('fails a v2 credential after validUntil', async () => {
      const signing = prepareAlgorithm(algorithms[1]);
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: signing.did,
        type: ['VerifiableCredential', 'EmploymentCredential'],
        issuer: signing.did,
        validFrom: '2020-01-01T00:00:00.000Z',
        validUntil: '2021-01-01T00:00:00.000Z',
        credentialSubject: { id: 'did:example:holder' },
        vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
      };
      const result = await verify(issueV2Credential(credential, signing));

      expect(result[0].credentialChecks).toEqual(
        expect.objectContaining({
          UNEXPIRED: CheckResults.FAIL,
          UNTAMPERED: CheckResults.PASS,
        }),
      );
    });

    it('rejects a v2 did:jwk credential with a different issuer', async () => {
      const signing = prepareAlgorithm(algorithms[1]);
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: signing.did,
        type: ['VerifiableCredential', 'EmploymentCredential'],
        issuer: 'did:example:wrong-issuer',
        validFrom: '2026-01-01T00:00:00.000Z',
        credentialSubject: { id: 'did:example:holder' },
        vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
      };
      const result = await verify(issueV2Credential(credential, signing));

      expect(result[0].credentialChecks).toEqual({
        TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
        TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
        UNEXPIRED: CheckResults.NOT_CHECKED,
        UNREVOKED: CheckResults.NOT_CHECKED,
        UNTAMPERED: CheckResults.FAIL,
      });
      expect(result[0]).toMatchObject({
        conformance: { status: 'FAIL' },
        credential: null,
        policy: { status: 'NOT_CHECKED' },
        proof: { status: 'PASS' },
      });
    });

    it('rejects an unresolved did:jwk kid instead of trusting its header jwk', async () => {
      const victim = prepareAlgorithm(algorithms[1]);
      const attacker = prepareAlgorithm(algorithms[1]);
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: victim.did,
        type: ['VerifiableCredential', 'EmploymentCredential'],
        issuer: victim.did,
        validFrom: '2026-01-01T00:00:00.000Z',
        credentialSubject: { id: 'did:example:holder' },
        vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
      };
      const forged = compactSign(credential, attacker.keyPair.privateKey, {
        alg: attacker.joseAlgorithm,
        cty: 'vc',
        jwk: attacker.keyPair.publicKey,
        kid: `${victim.did}#attacker`,
        typ: 'vc+jwt',
      });
      const result = await verify(forged);

      expect(result[0].credentialChecks).toEqual({
        TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
        TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
        UNEXPIRED: CheckResults.NOT_CHECKED,
        UNREVOKED: CheckResults.NOT_CHECKED,
        UNTAMPERED: CheckResults.DATA_INTEGRITY_ERROR,
      });
    });

    it('uses canonical v2 validUntil instead of a legacy alias', async () => {
      const signing = prepareAlgorithm(algorithms[1]);
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: signing.did,
        type: ['VerifiableCredential', 'EmploymentCredential'],
        issuer: signing.did,
        validFrom: '2020-01-01T00:00:00.000Z',
        validUntil: '2021-01-01T00:00:00.000Z',
        expirationDate: '2099-01-01T00:00:00.000Z',
        credentialSubject: { id: 'did:example:holder' },
        vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
      };
      const result = await verify(issueV2Credential(credential, signing));

      expect(result[0].credentialChecks.UNEXPIRED).toEqual(CheckResults.FAIL);
    });

    it('matches the expected holder within a v2 subject array', async () => {
      const signing = prepareAlgorithm(algorithms[1]);
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: signing.did,
        type: ['VerifiableCredential', 'EmploymentCredential'],
        issuer: signing.did,
        validFrom: '2026-01-01T00:00:00.000Z',
        credentialSubject: [
          { id: 'did:example:holder-1' },
          { id: 'did:example:holder-2' },
        ],
        vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
      };
      const result = await verify(
        issueV2Credential(credential, signing),
        'did:example:holder-2',
      );

      expect(result[0].credentialChecks.TRUSTED_HOLDER).toEqual(
        CheckResults.PASS,
      );
    });

    it('does not use unverified content for metadata or status resolution', async () => {
      fetchers.getCredentialTypeMetadata.mock.resetCalls();
      fetchers.getOrganizationVerifiedProfile.mock.resetCalls();
      fetchers.resolveDid.mock.resetCalls();
      initRevocationRegistry.mock.resetCalls();
      const signing = prepareAlgorithm(algorithms[0]);
      const credential = {
        ...baseCredential,
        issuer: signing.did,
      };
      const signed = await issueLegacyCredential(credential, signing);

      await verify(
        tamperJwt(signed, {
          vc: {
            ...credential,
            credentialStatus: {
              id: 'https://attacker.example/status',
              type: VelocityRevocationListType,
            },
            issuer: 'https://attacker.example/issuer',
            type: ['VerifiableCredential', 'AttackerCredential'],
          },
        }),
      );

      expect(fetchers.getCredentialTypeMetadata.mock.callCount()).toEqual(0);
      expect(fetchers.getOrganizationVerifiedProfile.mock.callCount()).toEqual(
        0,
      );
      expect(fetchers.resolveDid.mock.callCount()).toEqual(0);
      expect(initRevocationRegistry.mock.callCount()).toEqual(0);
    });

    it('bounds the credential batch before envelope parsing', async () => {
      await expect(
        verifyCredentials(
          { credentials: Array.from({ length: 101 }, () => 'not-a-jws') },
          fetchers,
          context,
        ),
      ).rejects.toThrow('credentials must contain at most 100');
    });

    it('bounds kid before DID resolution', async () => {
      const signing = prepareAlgorithm(algorithms[1]);
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: signing.did,
        type: ['VerifiableCredential', 'EmploymentCredential'],
        issuer: signing.did,
        validFrom: '2026-01-01T00:00:00.000Z',
        credentialSubject: { id: 'did:example:holder' },
      };
      const compact = issueV2Credential(credential, {
        ...signing,
        kid: `did:jwk:${'a'.repeat(2048)}#0`,
      });

      await expect(verify(compact)).rejects.toThrow(
        'credential kid must be a bounded non-empty string',
      );
    });

    it('preserves the empty verification batch result', async () => {
      await expect(
        verifyCredentials({ credentials: [] }, fetchers, context),
      ).resolves.toEqual([]);
    });
  });
});
