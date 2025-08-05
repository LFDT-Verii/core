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

const { before, beforeEach, describe, it, mock, after } = require('node:test');
const { expect } = require('expect');

const resolveDidDocument = mock.fn();
const initMetadataRegistry = mock.fn(() => ({
  resolveDidDocument,
}));
const initRevocationRegistry = mock.fn(() => ({
  getRevokedStatus: mock.fn(() => Promise.resolve(0)),
}));
const initVerificationCoupon = mock.fn(() => ({}));
mock.module('@verii/metadata-registration', {
  namedExports: {
    initMetadataRegistry,
    initRevocationRegistry,
    initVerificationCoupon,
  },
});
const mockGetJsonLdContextJson = mock.fn();
mockGetJsonLdContextJson.mock.mockImplementation(() =>
  Promise.resolve(openBadgeJsonLdContext)
);

const console = require('console');
const { compact, first, flow, join, omit, tail } = require('lodash/fp');
const { jwtSign, jwtDecode, generateCredentialJwt } = require('@verii/jwt');
const { addHours, setMilliseconds } = require('date-fns/fp');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { credentialUnexpired } = require('@verii/sample-data');
const { generateKeyPairInHexAndJwk } = require('@verii/tests-helpers');
const {
  CheckResults,
  VnfProtocolVersions,
  VelocityRevocationListType,
} = require('@verii/vc-checks');
const { generateKeyPair } = require('@verii/crypto');
const { nanoid } = require('nanoid');
const { applyOverrides } = require('@verii/common-functions');
const { verifyCredentials } = require('../src/verify-credentials');

describe('Verify credentials', () => {
  const orgKeyPair = generateKeyPairInHexAndJwk();
  const issuerDid = 'did:ion:1234567890';
  const issuerKeyPair = generateKeyPairInHexAndJwk();
  const issuerDidJwk = getDidUriFromJwk(issuerKeyPair.publicJwk);

  const mockGetOrganizationVerifiedProfile = {
    credentialSubject: {
      id: issuerDid,
      permittedVelocityServiceCategory: ['IdentityIssuer', 'Issuer'],
    },
  };

  const config = {
    rootPublicKey: orgKeyPair.publicKey,
    revocationContractAddress: 'any',
    contractAbi: 'contractAbi',
    contractAddress: 'contractAddress',
    rpcUrl: 'rpcUrl',
  };
  let issuerVc;
  let context;
  let fetchers;

  before(async () => {
    fetchers = {
      resolveDid: mock.fn(() =>
        Promise.resolve({
          id: issuerDid,
          publicKey: [{ id: '#key-1', publicKeyJwk: orgKeyPair.publicJwk }],
        })
      ),
      getOrganizationVerifiedProfile: mock.fn(
        () => mockGetOrganizationVerifiedProfile
      ),
      getCredentialTypeMetadata: mock.fn(() =>
        Promise.resolve([
          {
            credentialType: 'Passport',
            issuerCategory: 'IdentityIssuer',
          },
          {
            credentialType: 'OpenBadgeCredential',
            issuerCategory: 'RegularIssuer',
          },
        ])
      ),
    };
    context = {
      tenant: { did: 'did:ion:123' },
      log: console,
      config,
      fetch: {
        get: mock.fn((url) =>
          url != null && url !== 'https://www.w3.org/2018/credentials/v1'
            ? {
                json: mockGetJsonLdContextJson,
              }
            : { json: mock.fn(() => Promise.resolve({})) }
        ),
      },
    };
  });

  after(() => {
    mock.reset();
  });

  describe.each([{ didSuffix: null }, { didSuffix: 'abc' }])(
    'full verification with didSuffix=$didSuffix',
    ({ didSuffix }) => {
      let openBadgeCredential;
      let openBadgeVc;
      let idCredential;
      let idVc;
      let indexEntry;
      let credentialDid;

      beforeEach(async () => {
          initMetadataRegistry.mock.resetCalls();
          initRevocationRegistry.mock.resetCalls();
          resolveDidDocument.mock.resetCalls();
          resolveDidDocument.mock.mockImplementation(() => ({
              didDocument: {
                  id: 'DID',
                  publicKey: [
                      {
                          id: `${credentialDid.toLowerCase()}#key`,
                          publicKeyJwk: orgKeyPair.publicJwk,
                      },
                  ],
                  service: ['SERVICE'],
              },
              didDocumentMetadata: {
                  boundIssuerVcs: [
                      {
                          id: credentialDid.toLowerCase(),
                          format: 'jwt_vc',
                          vc: issuerVc,
                      },
                  ],
              },
              didResolutionMetadata: {},
          }));

        indexEntry = ['0xf123', 1, 42, didSuffix];
        credentialDid = buildDid(indexEntry, 'did:velocity:v2:');

        const issuerCred = {
          iss: issuerDid,
          vc: {
            id: credentialDid,
            credentialSubject: {
              accountId: indexEntry[0],
              listId: indexEntry[1],
            },
          },
        };
        issuerVc = await jwtSign(issuerCred, orgKeyPair.privateJwk, {
          kid: `${issuerDid}#key-1`,
        });

        openBadgeCredential = applyOverrides(credentialUnexpired, {
          id: credentialDid,
          issuer: { id: issuerDid },
          credentialStatus: {
            type: VelocityRevocationListType,
            id: 'ethereum:URL:2',
          },
          credentialSubject: {
            ...credentialUnexpired.credentialSubject,
            type: 'OpenBadgeCredential',
            id: issuerDidJwk,
            authority: {
              id: issuerDid,
            },
          },
          vnfProtocolVersion: VnfProtocolVersions.VNF_PROTOCOL_VERSION_2,
        });
        idCredential = applyOverrides(openBadgeCredential, {
          type: ['Passport'],
          credentialStatus: {
            type: VelocityRevocationListType,
            id: 'ethereum:URL:1',
          },
          'credentialSubject.type': 'IdDocument',
        });
        openBadgeVc = await generateCredentialJwt(
          openBadgeCredential,
          orgKeyPair.privateJwk,
          `${credentialDid}#key`
        );
        idVc = await generateCredentialJwt(
          idCredential,
          orgKeyPair.privateJwk,
          `${credentialDid}#key`
        );
      });

      it('should return successful credential check', async () => {
        const result = await verifyCredentials(
          {
            credentials: [idVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: idCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('should return successful credential check using kms', async () => {
        const keys = {
          [orgKeyPair.publicKey]: { privateJwk: orgKeyPair.privateJwk },
        };
        const kmsContext = {
          ...context,
          kms: { exportKeyOrSecret: async (id) => keys[id] },
        };
        const result = await verifyCredentials(
          {
            credentials: [idVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltOperatorKMSKeyId: orgKeyPair.publicKey },
          },
          fetchers,
          kmsContext
        );

        expect(result).toEqual([
          {
            credential: idCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        },
      ]);
          expect(
              initMetadataRegistry.mock.calls.map((call) => call.arguments)
          ).toEqual([[{ privateKey: orgKeyPair.privateKey }, kmsContext]]);
          expect(
              resolveDidDocument.mock.calls.map((call) => call.arguments)
          ).toEqual([
        [
          {
            burnerDid: kmsContext.tenant.did,
            caoDid: kmsContext.tenant.caoDid,
            credentials: [
              expect.objectContaining({ credential: idCredential }),
            ],
            did: `did:velocity:v2:multi:${idCredential.id
              .split(':')
              .slice(3)
              .join(':')}`,
            verificationCoupon: expect.any(Object),
          },
        ],
      ]);
    });

      it('should return successful credential check when checked @context', async () => {
        const result = await verifyCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: openBadgeCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('should return successful legacy credential check when checked @context is on credentialSubject', async () => {
        const legacyOpenBadgeCredential = {
          ...openBadgeCredential,
          '@context': [first(openBadgeCredential['@context'])],
          credentialSubject: {
            '@context': tail(openBadgeCredential['@context']),
            ...openBadgeCredential.credentialSubject,
          },
        };
        const legacyOpenBadgeVc = await generateCredentialJwt(
          legacyOpenBadgeCredential,
          orgKeyPair.privateJwk,
          `${credentialDid}#key`
        );

        const result = await verifyCredentials(
          {
            credentials: [legacyOpenBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: legacyOpenBadgeCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

    it('should return successful legacy credential that doesnt have @context with a PrimaryOrganization defined', async () => {
      const x = omit(
        ['@context.OpenBadgeCredential.@context.authority'],
        openBadgeJsonLdContext
      );
      mockGetJsonLdContextJson.mock.mockImplementation(() =>
        Promise.resolve(x)
      );

        const result = await verifyCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: openBadgeCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('should return successful credential check using kms', async () => {
        const keys = {
          [orgKeyPair.publicKey]: { privateJwk: orgKeyPair.privateJwk },
        };
        const kmsContext = {
          ...context,
          kms: { exportKeyOrSecret: async (id) => keys[id] },
        };
        const result = await verifyCredentials(
          {
            credentials: [idVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltOperatorKMSKeyId: orgKeyPair.publicKey },
          },
          fetchers,
          kmsContext
        );

      expect(result).toEqual([
        {
          credential: idCredential,
          credentialChecks: {
            UNTAMPERED: CheckResults.PASS,
            TRUSTED_ISSUER: CheckResults.PASS,
            TRUSTED_HOLDER: CheckResults.PASS,
            UNEXPIRED: CheckResults.PASS,
            UNREVOKED: CheckResults.PASS,
          },
        ]);
          expect(
              initMetadataRegistry.mock.calls.map((call) => call.arguments)
          ).toEqual([[{ privateKey: orgKeyPair.privateKey }, kmsContext]]);
          expect(
              resolveDidDocument.mock.calls.map((call) => call.arguments)
          ).toEqual([
          [
            {
              burnerDid: kmsContext.tenant.did,
              caoDid: kmsContext.tenant.caoDid,
              credentials: [
                expect.objectContaining({ credential: idCredential }),
              ],
              did: `did:velocity:v2:multi:${idCredential.id
                .split(':')
                .slice(3)
                .join(':')}`,
              verificationCoupon: expect.any(Object),
            },
          ],
        ]);
      });

      it('should return successful credential check when checked @context', async () => {
        const result = await verifyCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: openBadgeCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('should return successful legacy credential check when checked @context is on credentialSubject', async () => {
        const legacyOpenBadgeCredential = {
          ...openBadgeCredential,
          '@context': [first(openBadgeCredential['@context'])],
          credentialSubject: {
            '@context': tail(openBadgeCredential['@context']),
            ...openBadgeCredential.credentialSubject,
          },
        };
        const legacyOpenBadgeVc = await generateCredentialJwt(
          legacyOpenBadgeCredential,
          orgKeyPair.privateJwk,
          `${credentialDid}#key`
        );

        const result = await verifyCredentials(
          {
            credentials: [legacyOpenBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: legacyOpenBadgeCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

    it('should return successful legacy credential that doesnt have @context with a PrimaryOrganization defined', async () => {
      const x = omit(
        ['@context.OpenBadgeCredential.@context.authority'],
        openBadgeJsonLdContext
      );
      mockGetJsonLdContextJson.mock.mockImplementation(() =>
        Promise.resolve(x)
      );

        const result = await verifyCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: openBadgeCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('should return successful credential check when checked @context', async () => {
        const result = await verifyCredentials(
          {
            credentials: [openBadgeVc],
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
            expectedHolderDid: issuerDidJwk,
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: openBadgeCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('should return successful legacy credential check when checked @context is on credentialSubject', async () => {
        const legacyOpenBadgeCredential = {
          ...openBadgeCredential,
          '@context': [first(openBadgeCredential['@context'])],
          credentialSubject: {
            '@context': tail(openBadgeCredential['@context']),
            ...openBadgeCredential.credentialSubject,
          },
        };
        const legacyOpenBadgeVc = await generateCredentialJwt(
          legacyOpenBadgeCredential,
          orgKeyPair.privateJwk,
          `${credentialDid}#key`
        );

        const result = await verifyCredentials(
          {
            credentials: [legacyOpenBadgeVc],
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
            expectedHolderDid: issuerDidJwk,
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: legacyOpenBadgeCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

    it('should return successful legacy credential that doesnt have @context with a PrimaryOrganization defined', async () => {
      const x = omit(
        ['@context.OpenBadgeCredential.@context.authority'],
        openBadgeJsonLdContext
      );
      mockGetJsonLdContextJson.mock.mockImplementation(() =>
        Promise.resolve(x)
      );

        const result = await verifyCredentials(
          {
            credentials: [openBadgeVc],
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
            expectedHolderDid: issuerDidJwk,
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: openBadgeCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('should return successful credential check with array of credentialStatus', async () => {
        const credentialWithArrayOfStatus = {
          ...idCredential,
          credentialStatus: [
            { type: 'othetyoe', id: 'other:id' },
            idCredential.credentialStatus,
          ],
        };
        const vcWithArrayOfStatus = await generateCredentialJwt(
          credentialWithArrayOfStatus,
          orgKeyPair.privateKey,
          `${credentialDid}#key`
        );
        const result = await verifyCredentials(
          {
            credentials: [vcWithArrayOfStatus],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

      expect(result).toEqual([
        {
          credential: credentialWithArrayOfStatus,
          credentialChecks: {
            UNTAMPERED: CheckResults.PASS,
            TRUSTED_ISSUER: CheckResults.PASS,
            TRUSTED_HOLDER: CheckResults.PASS,
            UNEXPIRED: CheckResults.PASS,
            UNREVOKED: CheckResults.PASS,
          },
        ]);
    });

      it('should return successful credential check if selfsigned using did:jwk in kid', async () => {
        const keyPair = generateKeyPairInHexAndJwk();
        const did = getDidUriFromJwk(keyPair.publicJwk);
        const unsignedCredential = {
          ...omit(
            [
              'id',
              'credentialStatus',
              'credentialSubject.id',
              'vnfProtocolVersion',
            ],
            openBadgeCredential
          ),
          expirationDate: flow(
            setMilliseconds(0),
            addHours(10)
          )(new Date()).toISOString(),
        };
        const signedCredential = await jwtSign(
          { vc: unsignedCredential },
          keyPair.privateJwk,
          {
            nbf: new Date(unsignedCredential.issuanceDate),
            iat: new Date(unsignedCredential.issuanceDate),
            exp: new Date(unsignedCredential.expirationDate),
            kid: `${did}#0`,
          }
        );
        const result = await verifyCredentials(
          { credentials: [signedCredential] },
          fetchers,
          context
        );
        const { header } = jwtDecode(signedCredential);
        expect(header).toEqual({
          kid: `${did}#0`,
          alg: 'ES256K',
          typ: 'JWT',
        });
        expect(result).toEqual([
          {
            credential: unsignedCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.SELF_SIGNED,
              TRUSTED_HOLDER: CheckResults.NOT_APPLICABLE,
              UNREVOKED: CheckResults.NOT_APPLICABLE,
              UNEXPIRED: CheckResults.PASS,
            },
          },
        },
      ]);
    });
    it('should generate correct multi did', async () => {
      await verifyCredentials(
        {
          credentials: [openBadgeVc, openBadgeVc],
          relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
        },
        fetchers,
        context
      );
        expect(
            resolveDidDocument.mock.calls.map((call) => call.arguments)
        ).toContainEqual([
            {
                did: 'did:velocity:v2:multi:1:BBB:42;1:BBB:42',
                credentials: expect.any(Array),
                burnerDid: 'did:ion:123',
                verificationCoupon: {},
            },
        ]);
      });

      it('should return successful credential check if selfsigned using jwk', async () => {
        const keyPair = generateKeyPairInHexAndJwk();
        const credentialId = nanoid();
        const unsignedCredential = {
          ...omit(
            ['credentialSubject.id', 'vnfProtocolVersion'],
            openBadgeCredential
          ),
          id: credentialId,
          credentialStatus: { type: 'WalletStatusList', id: '123' },
        };
        const signedCredential = await jwtSign(
          { vc: unsignedCredential },
          keyPair.privateJwk,
          {
            nbf: new Date(openBadgeCredential.issuanceDate),
            jti: credentialId,
            iat: new Date(openBadgeCredential.issuanceDate),
            jwk: keyPair.publicJwk,
          }
        );
        const result = await verifyCredentials(
          { credentials: [signedCredential] },
          fetchers,
          context
        );
        const { header } = jwtDecode(signedCredential);
        expect(header).toEqual({
          alg: 'ES256K',
          typ: 'JWT',
          jwk: keyPair.publicJwk,
        });
        expect(result).toEqual([
          {
            credential: unsignedCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.SELF_SIGNED,
              TRUSTED_HOLDER: CheckResults.NOT_APPLICABLE,
              UNREVOKED: CheckResults.NOT_APPLICABLE,
              UNEXPIRED: CheckResults.PASS,
            },
          },
        ]);
      });

    it('should pass if credential jsonLdContext lookups fail when context isnt checked', async () => {
      mockGetJsonLdContextJson.mock.mockImplementationOnce(() =>
        Promise.reject(new Error())
      );

        const result = await verifyCredentials(
          {
            credentials: [idVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: idCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

    it('UNTAMPERED should return VOUCHER_RESERVE_EXHAUSTED and skip credential check with no available tokens', async () => {
      const contractError = new Error('Contract error');
      contractError.reason = 'No available tokens';
      initMetadataRegistry.mock.mockImplementationOnce(() => ({
        resolveDidDocument: () => Promise.reject(contractError),
      }));
      const result = await verifyCredentials(
        {
          credentials: [idVc],
          relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
        },
        fetchers,
        context
      );
      expect(result).toEqual([
        {
          credential: idCredential,
          credentialChecks: {
            UNTAMPERED: CheckResults.VOUCHER_RESERVE_EXHAUSTED,
            TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
            TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
            UNEXPIRED: CheckResults.NOT_CHECKED,
            UNREVOKED: CheckResults.NOT_CHECKED,
          },
        },
      ]);
    });

      it('UNTAMPERED should return DEPENDENCY_RESOLUTION_ERROR if credential signed using an unsupported did method in kid', async () => {
        const keyPair = generateKeyPairInHexAndJwk();
        const didWeb = 'did:web:example.com';
        const unsignedCredential = {
          ...omit(['id'], openBadgeCredential),
          expirationDate: flow(
            setMilliseconds(0),
            addHours(10)
          )(new Date()).toISOString(),
        };
        const signedCredential = await jwtSign(
          { vc: unsignedCredential },
          keyPair.privateJwk,
          {
            nbf: new Date(unsignedCredential.issuanceDate),
            iat: new Date(unsignedCredential.issuanceDate),
            exp: new Date(unsignedCredential.expirationDate),
            kid: `${didWeb}#key-1`,
          }
        );
        const result = await verifyCredentials(
          { credentials: [signedCredential] },
          fetchers,
          context
        );
        const { header } = jwtDecode(signedCredential);
        expect(header).toEqual({
          kid: `${didWeb}#key-1`,
          alg: 'ES256K',
          typ: 'JWT',
        });
        expect(result).toEqual([
          {
            credential: unsignedCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.DEPENDENCY_RESOLUTION_ERROR,
              TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
              TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
              UNREVOKED: CheckResults.NOT_CHECKED,
              UNEXPIRED: CheckResults.NOT_CHECKED,
            },
          },
        ]);
      });

    it('UNTAMPERED should DEPENDENCY_RESOLUTION_ERROR if reason of error not `No available tokens`', async () => {
      const contractError = new Error('Contract error');
      contractError.reason = 'Some another reason message';
      initMetadataRegistry.mock.mockImplementationOnce(() => ({
        resolveDidDocument: () => Promise.reject(contractError),
      }));
      await expect(
        verifyCredentials(
          {
            credentials: [idVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        )
      ).resolves.toEqual([
        {
          credential: idCredential,
          credentialChecks: {
            UNTAMPERED: CheckResults.DEPENDENCY_RESOLUTION_ERROR,
            TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
            TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
            UNEXPIRED: CheckResults.NOT_CHECKED,
            UNREVOKED: CheckResults.NOT_CHECKED,
          },
        },
      ]);
    });

      it('UNTAMPERED should return FAIL if key does not match', async () => {
        const signedCredential = await generateCredentialJwt(
          idCredential,
          generateKeyPair({ format: 'jwk' }).privateKey,
          `${credentialDid}#key`
        );
        const result = await verifyCredentials(
          {
            credentials: [signedCredential],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: idCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.FAIL,
              TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
              TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
              UNREVOKED: CheckResults.NOT_CHECKED,
              UNEXPIRED: CheckResults.NOT_CHECKED,
            },
          },
        ]);
      });

    it('UNTAMPERED should return DATA_INTEGRITY_ERROR if publicKey does not exist', async () => {
      initMetadataRegistry.mock.mockImplementationOnce(() => ({
        resolveDidDocument: mock.fn(() => ({
          didDocument: {
            id: 'DID',
            publicKey: [],
            service: ['SERVICE'],
          },
          didDocumentMetadata: {
            boundIssuerVcs: [
              {
                id: credentialDid,
                format: 'jwt_vc',
                vc: issuerVc,
              },
            ],
          },
          didResolutionMetadata: {
            error: 'UNRESOLVED_MULTI_DID_ENTRIES',
            unresolvedMultiDidEntries: [
              {
                id: 'did:velocity:v2:1:BBB:42:abcdefg',
                error: 'DATA_INTEGRITY_ERROR',
              },
            ],
          },
        })),
      }));

        const result = await verifyCredentials(
          {
            credentials: [
              await generateCredentialJwt(
                openBadgeCredential,
                orgKeyPair.privateJwk,
                credentialDid
              ),
            ],
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toMatchObject([
          {
            credential: openBadgeCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.DATA_INTEGRITY_ERROR,
              TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
              TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
              UNEXPIRED: CheckResults.NOT_CHECKED,
              UNREVOKED: CheckResults.NOT_CHECKED,
            },
          },
        ]);
      });

      it('TRUSTED_ISSUER should return DEPENDENCY_RESOLUTION_ERROR if issuer lookups fail', async () => {
        const result = await verifyCredentials(
          {
            credentials: [idVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          { ...fetchers, resolveDid: () => Promise.reject(new Error()) },
          context
        );

        expect(result).toEqual([
          {
            credential: idCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.DEPENDENCY_RESOLUTION_ERROR,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('TRUSTED_ISSUER should return DEPENDENCY_RESOLUTION_ERROR if credential type metadata lookups fail', async () => {
        const result = await verifyCredentials(
          {
            credentials: [idVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          {
            ...fetchers,
            getCredentialTypeMetadata: () => Promise.reject(new Error()),
          },
          context
        );

        expect(result).toEqual([
          {
            credential: idCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.DEPENDENCY_RESOLUTION_ERROR,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

    it('TRUSTED_ISSUER should return DEPENDENCY_RESOLUTION_ERROR if credential jsonLdContext lookups fail', async () => {
      mockGetJsonLdContextJson.mock.mockImplementationOnce(() =>
        Promise.reject(new Error())
      );

        const result = await verifyCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: openBadgeCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.DEPENDENCY_RESOLUTION_ERROR,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('TRUSTED_ISSUER should FAIL when issuerDidDocument not found', async () => {
        const result = await verifyCredentials(
          {
            credentials: [idVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          {
            ...fetchers,
            resolveDid: () => ({
              id: 'did:ion:otherDid',
            }),
          },
          context
        );

        expect(result).toMatchObject([
          {
            credential: idCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.FAIL,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('TRUSTED_ISSUER should FAIL when issuerAccreditation not found', async () => {
        const result = await verifyCredentials(
          {
            credentials: [idVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          {
            ...fetchers,
            getOrganizationVerifiedProfile: () => ({}),
          },
          context
        );

        expect(result).toMatchObject([
          {
            credential: idCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.FAIL,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('TRUSTED_ISSUER should FAIL when credential type not found', async () => {
        const result = await verifyCredentials(
          {
            credentials: [idVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          {
            ...fetchers,
            getCredentialTypeMetadata: () => [
              {
                credentialType: 'OtherType',
                issuerCategory: 'ContactIssuer',
              },
            ],
          },
          context
        );

        expect(result).toMatchObject([
          {
            credential: idCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.FAIL,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('TRUSTED_HOLDER should fail if expectedHolderDid is missing', async () => {
        const result = await verifyCredentials(
          {
            credentials: [idVc],
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: idCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.FAIL,
              UNREVOKED: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('TRUSTED_HOLDER should return NOT_APPLICABLE if expectedHolderDid is missing and vnfprotocol is 1', async () => {
        const credentialWithVnfProtocolV1 = {
          ...idCredential,
          vnfProtocolVersion: VnfProtocolVersions.VNF_PROTOCOL_VERSION_1,
        };
        const signedCredential = await generateCredentialJwt(
          credentialWithVnfProtocolV1,
          orgKeyPair.privateJwk,
          `${credentialDid}#key`
        );

        const result = await verifyCredentials(
          {
            credentials: [signedCredential],
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: credentialWithVnfProtocolV1,
            credentialChecks: {
              TRUSTED_HOLDER: CheckResults.NOT_APPLICABLE,
              TRUSTED_ISSUER: CheckResults.PASS,
              UNEXPIRED: CheckResults.PASS,
              UNREVOKED: CheckResults.PASS,
              UNTAMPERED: CheckResults.PASS,
            },
          },
        ]);
      });

      it('UNREVOKED should return NOT_APPLICABLE when velocity status is missing', async () => {
        const credentialWithoutCorrectStatus = {
          ...idCredential,
          credentialStatus: {
            type: 'othertype',
            id: idCredential.credentialStatus.id,
          },
        };

        const vcWithoutCorrectStatus = await generateCredentialJwt(
          credentialWithoutCorrectStatus,
          orgKeyPair.privateKey,
          `${credentialDid}#key`
        );
        const result = await verifyCredentials(
          {
            credentials: [vcWithoutCorrectStatus],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: credentialWithoutCorrectStatus,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNREVOKED: CheckResults.NOT_APPLICABLE,
              UNEXPIRED: CheckResults.PASS,
            },
          },
        ]);
      });

    it('UNREVOKED should return FAIL when status is revoked', async () => {
      initRevocationRegistry.mock.mockImplementationOnce(() => ({
        getRevokedStatus: mock.fn(() => Promise.resolve(1n)),
      }));

        const result = await verifyCredentials(
          {
            credentials: [idVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: idCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNREVOKED: CheckResults.FAIL,
              UNEXPIRED: CheckResults.PASS,
            },
          },
        ]);
      });

    it('UNREVOKED should return FAIL when status request errors', async () => {
      initRevocationRegistry.mock.mockImplementationOnce(() => ({
        getRevokedStatus: mock.fn(() => Promise.reject(new Error('boom'))),
      }));

        const result = await verifyCredentials(
          {
            credentials: [idVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: { dltPrivateKey: orgKeyPair.privateKey },
          },
          fetchers,
          context
        );

        expect(result).toEqual([
          {
            credential: idCredential,
            credentialChecks: {
              UNTAMPERED: CheckResults.PASS,
              TRUSTED_ISSUER: CheckResults.PASS,
              TRUSTED_HOLDER: CheckResults.PASS,
              UNREVOKED: CheckResults.FAIL,
              UNEXPIRED: CheckResults.PASS,
            },
          },
        ]);
      });
    }
  );
});

const buildDid = (indexEntry, didPrefix = 'did:velocity:v2:') =>
  `${didPrefix}${flow(compact, join(':'))(indexEntry)}`;

const openBadgeJsonLdContext = {
  '@context': {
    OpenBadgeCredential: {
      '@id': 'https://velocitynetwork.foundation/contexts#OpenBadgeCredential',
      '@context': {
        authority: {
          '@id':
            'https://velocitynetwork.foundation/contexts#primaryOrganization',
        },
      },
    },
  },
};
