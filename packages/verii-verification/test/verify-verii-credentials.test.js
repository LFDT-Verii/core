/*
 * Copyright 2025 Velocity Team
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
 *
 */
const { describe, it, before, beforeEach, mock } = require('node:test');
const { expect } = require('expect');
const { ALG_TYPE } = require('@verii/metadata-registration');

const resolveVelocityDidDocument = mock.fn();
const initMetadataRegistry = mock.fn(() => ({
  resolveDidDocument: resolveVelocityDidDocument,
}));
const initRevocationRegistry = mock.fn(() => ({
  getRevokedStatus: mock.fn(() => Promise.resolve(0)),
}));
const initVerificationCoupon = mock.fn(() => ({}));
mock.module('@verii/metadata-registration', {
  namedExports: {
    ALG_TYPE,
    initMetadataRegistry,
    initRevocationRegistry,
    initVerificationCoupon,
  },
});

const console = require('console');
const { compact, flow, join, omit } = require('lodash/fp');
const { jwtSign, jwtDecode, generateCredentialJwt } = require('@verii/jwt');
const { addHours, setMilliseconds } = require('date-fns/fp');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { credentialUnexpired } = require('@verii/sample-data');
const { generateKeyPairInHexAndJwk } = require('@verii/tests-helpers');
const {
  CheckResults,
  VeriiProtocolVersions,
  VelocityRevocationListType,
} = require('@verii/vc-checks');
const { generateKeyPair } = require('@verii/crypto');
const { applyOverrides } = require('@verii/common-functions');
const nock = require('nock');
const { verifyVeriiCredentials } = require('../src/verify-verii-credentials');

const registrarHost = 'registrar.test';
const registrarUrl = `https://${registrarHost}`;

describe('Verify verii credentials', () => {
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

  const resolveDidPath = `/api/v0.6/resolve-did/${encodeURIComponent(
    issuerDid
  )}`;
  const verifiedProfilePath = `/api/v0.6/organizations/${encodeURIComponent(
    issuerDid
  )}/verified-profile`;
  const credentialTypePath = '/api/v0.6/credential-types';

  const config = {
    rootPublicKey: orgKeyPair.publicKey,
    revocationContractAddress: 'any',
    registrarUrl,
  };
  let issuerVc;
  let context;

  before(async () => {
    const keys = {
      'keyid-1': { privateJwk: orgKeyPair.privateJwk },
    };

    context = {
      log: console,
      config,
      kms: { exportKeyOrSecret: async (id) => keys[id] },
      useExistingGlobalAgent: true,
    };
  });

  [{ didSuffix: null }, { didSuffix: 'abc' }].forEach(({ didSuffix }) => {
    describe(`full verification with didSuffix=${didSuffix}`, () => {
      let openBadgeCredential;
      let openBadgeVc;
      let indexEntry;
      let credentialDid;

      beforeEach(async () => {
        initMetadataRegistry.mock.resetCalls();
        initRevocationRegistry.mock.resetCalls();
        resolveVelocityDidDocument.mock.resetCalls();
        resolveVelocityDidDocument.mock.mockImplementation(() => ({
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
        nock.cleanAll();
        nock(registrarUrl)
          .get(resolveDidPath)
          .reply(200, {
            id: issuerDid,
            publicKey: [{ id: '#key-1', publicKeyJwk: orgKeyPair.publicJwk }],
          });
        nock(registrarUrl)
          .get(verifiedProfilePath)
          .reply(200, mockGetOrganizationVerifiedProfile);
        nock(registrarUrl)
          .get(`${credentialTypePath}?credentialType=OpenBadgeCredential`)
          .reply(200, [
            {
              credentialType: 'OpenBadgeCredential',
              issuerCategory: 'RegularIssuer',
              primaryOrganizationClaimPaths: [
                ['credentialSubject', 'authority'],
                ['credentialSubject', 'authority', 'id'],
              ],
            },
          ]);

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
          vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
        });
        openBadgeVc = await generateCredentialJwt(
          openBadgeCredential,
          orgKeyPair.privateJwk,
          `${credentialDid}#key`
        );
      });

      it('should return successful credential check when no expectedHolderDid and private key', async () => {
        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
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
        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
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
        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
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
        expect(
          initMetadataRegistry.mock.calls.map((call) => call.arguments)
        ).toEqual([[{ privateKey: orgKeyPair.privateKey }, context]]);
        expect(
          resolveVelocityDidDocument.mock.calls.map((call) => call.arguments)
        ).toEqual([
          [
            {
              burnerDid: context.tenant.did,
              caoDid: context.tenant.caoDid,
              credentials: [
                expect.objectContaining({ credential: openBadgeCredential }),
              ],
              did: `did:velocity:v2:multi:${openBadgeCredential.id
                .split(':')
                .slice(3)
                .join(':')}`,
              verificationCoupon: expect.any(Object),
            },
          ],
        ]);
      });

      it('should return successful credential check when checked @context', async () => {
        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
            expectedHolderDid: issuerDidJwk,
          },
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
          ...openBadgeCredential,
          credentialStatus: [
            { type: 'othetyoe', id: 'other:id' },
            openBadgeCredential.credentialStatus,
          ],
        };
        const vcWithArrayOfStatus = await generateCredentialJwt(
          credentialWithArrayOfStatus,
          orgKeyPair.privateKey,
          `${credentialDid}#key`
        );
        const result = await verifyVeriiCredentials(
          {
            credentials: [vcWithArrayOfStatus],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
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
          },
        ]);
      });

      it('should pass if credential jsonLdContext lookups fail when context isnt checked', async () => {
        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
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

      it('UNTAMPERED should return VOUCHER_RESERVE_EXHAUSTED and skip credential check with no available tokens', async () => {
        const contractError = new Error('Contract error');
        contractError.reason = 'No available tokens';
        initMetadataRegistry.mock.mockImplementationOnce(() => ({
          resolveDidDocument: () => Promise.reject(contractError),
        }));
        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
          context
        );
        expect(result).toEqual([
          {
            credential: openBadgeCredential,
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
        const result = await verifyVeriiCredentials(
          {
            credentials: [signedCredential],
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
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
          resolveVelocityDidDocument: () => Promise.reject(contractError),
        }));
        await expect(
          verifyVeriiCredentials(
            {
              credentials: [openBadgeVc],
              expectedHolderDid: issuerDidJwk,
              relyingParty: {
                did: 'did:ion:123',
                dltOperatorKMSKeyId: 'keyid-1',
              },
            },
            context
          )
        ).resolves.toEqual([
          {
            credential: openBadgeCredential,
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
          openBadgeCredential,
          generateKeyPair({ format: 'jwk' }).privateKey,
          `${credentialDid}#key`
        );
        const result = await verifyVeriiCredentials(
          {
            credentials: [signedCredential],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
          context
        );

        expect(result).toEqual([
          {
            credential: openBadgeCredential,
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
        resolveVelocityDidDocument.mock.mockImplementationOnce(async () => ({
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
        }));

        const result = await verifyVeriiCredentials(
          {
            credentials: [
              await generateCredentialJwt(
                openBadgeCredential,
                orgKeyPair.privateJwk,
                credentialDid
              ),
            ],
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
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

      it('TRUSTED_ISSUER should return FAIL if issuerDidDocument resolution fails', async () => {
        nock.removeInterceptor({
          hostname: registrarHost,
          path: resolveDidPath,
          method: 'GET',
          proto: 'https',
        });
        nock(registrarUrl).get(resolveDidPath).reply(400);

        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
          context
        );

        expect(result).toEqual([
          {
            credential: openBadgeCredential,
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

      it('TRUSTED_ISSUER should FAIL when issuerDidDocument not found', async () => {
        nock.removeInterceptor({
          hostname: registrarHost,
          path: resolveDidPath,
          method: 'GET',
          proto: 'https',
        });
        nock(registrarUrl).get(resolveDidPath).reply(404);
        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
          context
        );

        expect(result).toMatchObject([
          {
            credential: openBadgeCredential,
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

      it('TRUSTED_ISSUER should return DEPENDENCY_RESOLUTION_ERROR if credential type metadata lookups fail', async () => {
        nock.removeInterceptor({
          hostname: registrarHost,
          path: credentialTypePath,
          method: 'GET',
          proto: 'https',
        });
        nock(registrarUrl)
          .get(`${credentialTypePath}?credentialType=OpenBadgeCredential`)
          .reply(400);
        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
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

      it('TRUSTED_ISSUER should FAIL when credential type not found', async () => {
        nock.removeInterceptor({
          hostname: registrarHost,
          path: credentialTypePath,
          method: 'GET',
          proto: 'https',
        });
        nock(registrarUrl)
          .get(`${credentialTypePath}?credentialType=OpenBadgeCredential`)
          .reply(200, []);
        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
          context
        );

        expect(result).toMatchObject([
          {
            credential: openBadgeCredential,
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

      it('TRUSTED_ISSUER should return PASS if primaryOrganizationClaimPaths do not resolve to properties', async () => {
        nock.removeInterceptor({
          hostname: registrarHost,
          path: credentialTypePath,
          method: 'GET',
          proto: 'https',
        });
        nock(registrarUrl)
          .get(`${credentialTypePath}?credentialType=OpenBadgeCredential`)
          .reply(200, [
            {
              credentialType: 'OpenBadgeCredential',
              issuerCategory: 'RegularIssuer',
              primaryOrganizationClaimPaths: [
                ['credentialSubject', 'issuer'],
                ['credentialSubject', 'issuer', 'identifier'],
              ],
            },
          ]);

        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
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

      it('TRUSTED_ISSUER should FAIL when issuerAccreditation not found', async () => {
        nock.removeInterceptor({
          hostname: registrarHost,
          path: verifiedProfilePath,
          method: 'GET',
          proto: 'https',
        });
        nock(registrarUrl).get(resolveDidPath).reply(404);

        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
          context
        );

        expect(result).toMatchObject([
          {
            credential: openBadgeCredential,
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
        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
          context
        );

        expect(result).toEqual([
          {
            credential: openBadgeCredential,
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

      it('UNREVOKED should return NOT_APPLICABLE when velocity status is missing', async () => {
        const credentialWithoutCorrectStatus = {
          ...openBadgeCredential,
          credentialStatus: {
            type: 'othertype',
            id: openBadgeCredential.credentialStatus.id,
          },
        };

        const vcWithoutCorrectStatus = await generateCredentialJwt(
          credentialWithoutCorrectStatus,
          orgKeyPair.privateKey,
          `${credentialDid}#key`
        );
        const result = await verifyVeriiCredentials(
          {
            credentials: [vcWithoutCorrectStatus],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
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

        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
          context
        );

        expect(result).toEqual([
          {
            credential: openBadgeCredential,
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

        const result = await verifyVeriiCredentials(
          {
            credentials: [openBadgeVc],
            expectedHolderDid: issuerDidJwk,
            relyingParty: {
              did: 'did:ion:123',
              dltOperatorKMSKeyId: 'keyid-1',
            },
          },
          context
        );

        expect(result).toEqual([
          {
            credential: openBadgeCredential,
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
    });
  });
});

const buildDid = (indexEntry, didPrefix = 'did:velocity:v2:') =>
  `${didPrefix}${flow(compact, join(':'))(indexEntry)}`;
