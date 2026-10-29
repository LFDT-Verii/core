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
const { before, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const { omit, set, times, join } = require('lodash/fp');
const { generateCredentialJwt, jwtSign } = require('@verii/jwt');
const { generateKeyPair, hexFromJwk } = require('@verii/crypto');
const { generatePublicKeySection } = require('@verii/did-doc');
const { checkIssuerTrust } = require('../src/check-issuer-trust');
const {
  verifyPrimarySourceIssuer,
} = require('../src/verify-primary-source-issuer');
const { checkIdentityIssuer } = require('../src/check-identity-issuer');
const { CheckResults } = require('../src/check-results');

describe('issuer checks', () => {
  const log = {
    info: mock.fn(),
    warn: mock.fn(),
    error: mock.fn(),
  };
  const issuerKeyPair = generateKeyPair({ format: 'jwk' });
  const issuerPublicKey = hexFromJwk(issuerKeyPair.publicKey, false);

  const issuerDid = 'did:ion:1234567890';
  const issuerKid = `${issuerDid}#key-1`;
  const issuerCred = {
    type: ['CredentialMetadataListHeader'],
    issuer: issuerDid,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      listId: 1,
      accountId: 'BBB',
    },
  };
  const config = {
    rootPublicKey: issuerPublicKey,
    revocationContractAddress: 'any',
    rpcUrl: 'any',
    trustedIssuerCheckMinDate: '2024-02-28T00:00:00Z',
  };

  let boundIssuerVc;
  let issuerDidDocument;
  let identityCredential;
  let defaultDependencies;
  let context;

  before(async () => {
    boundIssuerVc = await generateCredentialJwt(
      issuerCred,
      issuerKeyPair.privateKey,
      issuerKid,
    );
    issuerDidDocument = {
      id: issuerDid,
      verificationMethod: [
        {
          id: '#key-1',
          publicKeyJwk: issuerKeyPair.publicKey,
        },
      ],
    };
    identityCredential = {
      '@context': ['http://www.w3.org/2018/credentials/v1'],
      type: ['Passport'],
      credentialSubject: {
        '@context': ['http://libapp-mock/jsonld.json'],
        type: 'IdDocument',
        authority: {
          identifier: issuerDid,
        },
      },
      issuer: {
        id: issuerDid,
      },
      issuanceDate: new Date().toISOString(),
    };
    defaultDependencies = {
      issuerAccreditation: {
        id: issuerDid,
        permittedVelocityServiceCategory: ['Issuer'],
      },
      issuerDidDocument,
      boundIssuerVc,
      credentialTypeMetadata: {
        credentialType: 'Passport',
        issuerCategory: 'RegularIssuer',
        primaryOrganizationClaimPaths: [
          ['credentialSubject', 'authority', 'identifier'],
        ],
      },
      isSelfSigned: false,
    };

    context = {
      log,
      config,
    };
  });

  it('Should FAIL when wrong kid', async () => {
    const result = await checkIssuerTrust(
      identityCredential,
      issuerDid,
      {
        ...defaultDependencies,
        issuerDidDocument: {
          id: issuerDid,
          verificationMethod: [
            { id: '#wrong-id', publicKeyJwk: issuerKeyPair.publicKey },
          ],
        },
      },
      context,
    );

    expect(result).toEqual(CheckResults.FAIL);
  });

  it('Should FAIL when wrong key', async () => {
    const { publicKey: publicKeyJwk } = generateKeyPair({ format: 'jwk' });

    const result = await checkIssuerTrust(
      identityCredential,
      issuerDid,
      {
        ...defaultDependencies,
        issuerDidDocument: {
          id: issuerDid,
          verificationMethod: [{ id: '#key-1', publicKeyJwk }],
        },
      },
      context,
    );

    expect(result).toEqual(CheckResults.FAIL);
  });

  it('Should FAIL when `permittedVelocityServiceCategory` is empty', async () => {
    const result = await checkIssuerTrust(
      identityCredential,
      issuerDid,
      {
        ...defaultDependencies,
        issuerAccreditation: {
          id: issuerDid,
          permittedVelocityServiceCategory: [],
        },
      },
      context,
    );

    expect(result).toEqual(CheckResults.FAIL);
  });

  it('Should DATA_INTEGRITY_ERROR when boundIssuerVC incorrectly constructed', async () => {
    const result = await checkIssuerTrust(
      identityCredential,
      issuerDid,
      {
        ...defaultDependencies,
        boundIssuerVc: await generateCredentialJwt(
          issuerCred,
          issuerKeyPair.privateKey,
        ),
      },
      context,
    );

    expect(result).toEqual(CheckResults.DATA_INTEGRITY_ERROR);
  });

  it('Should FAIL when boundIssuerVC is missing data', async () => {
    const otherIssuerCred = await generateCredentialJwt(
      {
        credentialSubject: {
          listId: 1,
        },
      },
      issuerKeyPair.privateKey,
      issuerKid,
    );

    const result = await checkIssuerTrust(
      identityCredential,
      issuerDid,
      {
        ...defaultDependencies,
        boundIssuerVc: otherIssuerCred,
      },
      context,
    );

    expect(result).toEqual(CheckResults.FAIL);
  });

  it('Should FAIL when boundIssuerVC is incorrectly formatted', async () => {
    const result = await checkIssuerTrust(
      identityCredential,
      issuerDid,
      {
        ...defaultDependencies,
        boundIssuerVc: 'WRONG_FORMAT',
      },
      context,
    );

    expect(result).toEqual(CheckResults.DATA_INTEGRITY_ERROR);
  });

  it('Should FAIL when boundIssuerVC signature invalid', async () => {
    const { privateKey } = generateKeyPair({ format: 'jwk' });
    const wrongSigVc = await generateCredentialJwt(
      issuerCred,
      privateKey,
      issuerKid,
    );

    const result = await checkIssuerTrust(
      identityCredential,
      issuerDid,
      {
        ...defaultDependencies,
        boundIssuerVc: wrongSigVc,
      },
      context,
    );

    expect(result).toEqual(CheckResults.FAIL);
  });

  it('Should PASS when issuer valid', async () => {
    const result = await checkIssuerTrust(
      identityCredential,
      issuerDid,
      defaultDependencies,
      context,
    );

    expect(result).toEqual(CheckResults.PASS);
  });

  it('Should PASS when notary issuer valid', async () => {
    const result = await checkIssuerTrust(
      identityCredential,
      issuerDid,
      {
        ...defaultDependencies,
        issuerAccreditation: {
          id: issuerDid,
          permittedVelocityServiceCategory: ['NotaryIssuer'],
        },
      },
      context,
    );

    expect(result).toEqual(CheckResults.PASS);
  });

  it('Should PASS when identity issuer valid', async () => {
    const result = await checkIssuerTrust(
      identityCredential,
      issuerDid,
      {
        ...defaultDependencies,
        credentialTypeMetadata: {
          credentialType: 'Passport',
          issuerCategory: 'IdDocumentIssuer',
        },
        issuerAccreditation: {
          id: issuerDid,
          permittedVelocityServiceCategory: ['NotaryIdDocumentIssuer'],
        },
      },
      context,
    );

    expect(result).toEqual(CheckResults.PASS);
  });

  it('should PASS if primaryOrganizationClaimPaths is empty', async () => {
    const result = await checkIssuerTrust(
      identityCredential,
      issuerDid,
      omit(
        ['credentialTypeMetadata.primaryOrganizationClaimPaths'],
        defaultDependencies,
      ),
      context,
    );

    expect(result).toEqual(CheckResults.PASS);
  });

  describe('issuing metadata key formats', () => {
    const p256KeyPair = generateKeyPair({ format: 'jwk', curve: 'P-256' });
    let p256BoundIssuerVc;

    before(async () => {
      p256BoundIssuerVc = await generateCredentialJwt(
        issuerCred,
        p256KeyPair.privateKey,
        issuerKid,
        'ES256',
      );
    });

    const checkWithIssuerKey = (verificationMethod, overrides = {}) =>
      checkIssuerTrust(
        identityCredential,
        issuerDid,
        {
          ...defaultDependencies,
          issuerDidDocument: {
            id: issuerDid,
            verificationMethod: [{ id: '#key-1', ...verificationMethod }],
          },
          ...overrides,
        },
        context,
      );

    it('Should PASS when the boundIssuerVC is signed by a P-256 JsonWebKey2020 key', async () => {
      const result = await checkWithIssuerKey(
        {
          type: 'JsonWebKey2020',
          controller: issuerDid,
          publicKeyJwk: p256KeyPair.publicKey,
        },
        { boundIssuerVc: p256BoundIssuerVc },
      );

      expect(p256KeyPair.publicKey.crv).toEqual('P-256');
      expect(result).toEqual(CheckResults.PASS);
    });

    it('Should FAIL when the boundIssuerVC is signed by a different P-256 key', async () => {
      const { publicKey: otherP256Jwk } = generateKeyPair({
        format: 'jwk',
        curve: 'P-256',
      });

      const result = await checkWithIssuerKey(
        { type: 'JsonWebKey2020', publicKeyJwk: otherP256Jwk },
        { boundIssuerVc: p256BoundIssuerVc },
      );

      expect(result).toEqual(CheckResults.FAIL);
    });

    it('Should FAIL when a P-256 boundIssuerVC is checked against a secp256k1 key', async () => {
      const result = await checkWithIssuerKey(
        { type: 'JsonWebKey2020', publicKeyJwk: issuerKeyPair.publicKey },
        { boundIssuerVc: p256BoundIssuerVc },
      );

      expect(result).toEqual(CheckResults.FAIL);
    });

    it('Should PASS when the issuer key is a legacy secp256k1 publicKeyHex', async () => {
      const result = await checkWithIssuerKey({
        type: 'EcdsaSecp256k1VerificationKey2019',
        publicKeyHex: issuerPublicKey,
      });

      expect(result).toEqual(CheckResults.PASS);
    });

    it('Should PASS when the issuer key is a legacy secp256k1 publicKeyBase58', async () => {
      const { publicKeyBase58 } = generatePublicKeySection(
        '#key-1',
        issuerDid,
        issuerPublicKey,
      );
      expect(publicKeyBase58).toBeDefined();

      const result = await checkWithIssuerKey({
        type: 'EcdsaSecp256k1VerificationKey2019',
        publicKeyBase58,
      });

      expect(result).toEqual(CheckResults.PASS);
    });

    it('Should FAIL when a legacy secp256k1 publicKeyHex does not match the signer', async () => {
      const { publicKey: otherJwk } = generateKeyPair({ format: 'jwk' });

      const result = await checkWithIssuerKey({
        type: 'EcdsaSecp256k1VerificationKey2019',
        publicKeyHex: hexFromJwk(otherJwk, false),
      });

      expect(result).toEqual(CheckResults.FAIL);
    });

    it('Should FAIL when the kid is not in the DID document even if the header embeds a jwk', async () => {
      const attackerKeyPair = generateKeyPair({ format: 'jwk' });
      const embeddedJwkVc = await jwtSign(
        { iss: issuerDid, vc: issuerCred },
        attackerKeyPair.privateKey,
        {
          kid: `${issuerDid}#key-2`,
          jwk: attackerKeyPair.publicKey,
        },
      );

      const result = await checkWithIssuerKey(
        { publicKeyJwk: issuerKeyPair.publicKey },
        { boundIssuerVc: embeddedJwkVc },
      );

      expect(result).toEqual(CheckResults.FAIL);
    });

    it('Should FAIL when the boundIssuerVC uses a symmetric algorithm', async () => {
      const secret = 'issuer-did-document-secret';
      const hs256Vc = await jwtSign(
        { iss: issuerDid, vc: issuerCred },
        secret,
        {
          kid: issuerKid,
        },
      );

      const result = await checkWithIssuerKey(
        {
          publicKeyJwk: {
            kty: 'oct',
            k: Buffer.from(secret).toString('base64url'),
          },
        },
        { boundIssuerVc: hs256Vc },
      );

      expect(result).toEqual(CheckResults.FAIL);
    });

    it('Should not emit the deriveJwk hex deprecation warning', async (t) => {
      const emitWarning = t.mock.method(process, 'emitWarning', () => {});

      const result = await checkWithIssuerKey({
        type: 'EcdsaSecp256k1VerificationKey2019',
        publicKeyHex: issuerPublicKey,
      });

      expect(result).toEqual(CheckResults.PASS);
      expect(
        emitWarning.mock.calls.filter(
          ({ arguments: [, options] }) => options?.code === 'VERII_JWT_DEP001',
        ),
      ).toEqual([]);
    });
  });

  describe('checkIdentityIssuer tests suite', () => {
    it('should throw error if `IdentityIssuer` does not exists in `permittedVelocityServiceCategory`', async () => {
      expect(() => checkIdentityIssuer([])).toThrow(
        'issuer_requires_identity_permission',
      );
    });

    it('should not throw error if `IdDocumentIssuer` exists in `permittedVelocityServiceCategory`', async () => {
      expect(() => checkIdentityIssuer(['IdDocumentIssuer'])).not.toThrow();
    });

    it('should not throw error if `IdentityIssuer` exists in `permittedVelocityServiceCategory`', async () => {
      expect(() => checkIdentityIssuer(['IdentityIssuer'])).not.toThrow();
    });
  });

  describe('verifyPrimarySourceIssuer tests suite', () => {
    const testContext = {
      log,
      config,
    };

    it('should throw error if identifier does not match to iss', async () => {
      expect(() =>
        verifyPrimarySourceIssuer(
          {
            credential: {
              credentialSubject: {
                '@context': [
                  'https://www.mockdomain.org/context/jsonld-file.json',
                ],
                type: 'IdDocument',
                authority: {
                  identifier: 'no-match',
                },
              },
              issuanceDate: '2031-01-01T00:00:00Z',
            },
            issuerId: issuerDid,
            credentialTypeMetadata: {
              primaryOrganizationClaimPaths: [
                ['credentialSubject', 'authority'],
                ['credentialSubject', 'authority', 'identifier'],
              ],
            },
          },
          testContext,
        ),
      ).toThrow('issuer_requires_notary_permission');
    });

    it('should pass validation when issuer is matched in the credential', async () => {
      expect(
        verifyPrimarySourceIssuer(
          {
            credential: {
              credentialSubject: {
                '@context': [
                  'https://www.mockdomain.org/context/jsonld-file.json',
                ],
                type: 'IdDocument',
                authority: {
                  identifier: issuerDid,
                },
              },
              issuanceDate: '2031-01-01T00:00:00Z',
            },
            issuerId: issuerDid,
            credentialTypeMetadata: {
              primaryOrganizationClaimPaths: [
                ['credentialSubject', 'authority'],
                ['credentialSubject', 'authority', 'identifier'],
              ],
            },
          },
          testContext,
        ),
      ).toBe(true);
    });

    it('should pass validation when issuer is not on the credential', async () => {
      expect(
        verifyPrimarySourceIssuer(
          {
            credential: {
              credentialSubject: {
                '@context': [
                  'https://www.mockdomain.org/context/jsonld-file.json',
                ],
                type: 'IdDocument',
              },
              issuanceDate: '2031-01-01T00:00:00Z',
            },
            issuerId: issuerDid,
            credentialTypeMetadata: {
              primaryOrganizationClaimPaths: [
                ['credentialSubject', 'authority'],
                ['credentialSubject', 'authority', 'identifier'],
              ],
            },
          },
          testContext,
        ),
      ).toBe(true);
    });

    it('should pass validation and find identifier with deep objects', async () => {
      expect(
        verifyPrimarySourceIssuer(
          {
            credential: {
              credentialSubject: {
                '@context': [
                  'https://www.mockdomain.org/context/jsonld-file.json',
                ],
                type: 'IdDocument',
                hasCredential: {
                  child1: set(
                    join(
                      '.',
                      times((i) => `child${i}`, 10000),
                    ),
                    {},
                    {},
                  ),
                  child2: set(
                    join(
                      '.',
                      times((i) => `child${i}`, 10000),
                    ),
                    issuerDid,
                    {},
                  ),
                  child3: {
                    child2: {
                      child3: {
                        child4: {
                          authority: {
                            id: issuerDid,
                          },
                        },
                      },
                    },
                  },
                  child4: set(
                    join(
                      '.',
                      times((i) => `child${i}`, 10000),
                    ),
                    {},
                    {},
                  ),
                  child5: set(
                    join(
                      '.',
                      times((i) => `child${i}`, 10000),
                    ),
                    issuerDid,
                    {},
                  ),
                },
              },
              issuanceDate: '2031-01-01T00:00:00Z',
            },
            issuerId: issuerDid,
            credentialTypeMetadata: {
              primaryOrganizationClaimPaths: [
                [
                  'credentialSubject',
                  'hasCredential',
                  'child3',
                  'child2',
                  'child3',
                  'child4',
                  'authority',
                  'id',
                ],
              ],
            },
          },
          testContext,
        ),
      ).toBe(true);
    });

    it('should pass if type is string and no primaryOrganizationClaimPaths exist', async () => {
      const result = verifyPrimarySourceIssuer(
        {
          credential: {
            credentialSubject: {
              '@context': [
                'https://www.mockdomain.org/context/jsonld-file.json',
              ],
              type: 'IdDocument',
              authority: {
                identifier: issuerDid,
              },
            },
            issuanceDate: '2031-01-01T00:00:00Z',
          },
          issuerId: issuerDid,
          credentialTypeMetadata: {},
        },
        testContext,
      );
      expect(result).toBe(true);
    });
  });
});
