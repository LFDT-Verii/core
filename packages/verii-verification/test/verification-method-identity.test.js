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

// The ledger resolver only publishes `#key-1` fragments, so DID documents with
// verification methods that differ only by case are supplied at the
// metadata-registration boundary. Everything else runs through the public API.
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const resolveDidDocument = mock.fn();
mock.module('@verii/metadata-registration', {
  namedExports: {
    initMetadataRegistry: mock.fn(() => ({ resolveDidDocument })),
    initRevocationRegistry: mock.fn(() => ({
      getRevokedStatus: mock.fn(() => Promise.resolve(0)),
    })),
    initVerificationCoupon: mock.fn(() => ({})),
  },
});

const { nanoid } = require('nanoid');
const {
  generateJWAKeyPair,
  hashAndEncodeHex,
  KeyAlgorithms,
} = require('@verii/crypto');
const { jwtSign } = require('@verii/jwt');
const { CheckResults, VeriiProtocolVersions } = require('@verii/vc-checks');
const { verifyCredentials } = require('../index');
const {
  signV1Credential,
  signV2Credential,
} = require('./helpers/sign-credentials');

const credentialType = 'EmailV1.0';
const holderDid = 'did:example:holder';
const issuerDid = 'did:example:issuer';
const accountId = '0x0123456789abcdef0123456789abcdef01234567';
const noop = () => {};
const log = { debug: noop, error: noop, info: noop, warn: noop };
const context = {
  config: { revocationContractAddress: '0x01' },
  log,
  tenant: { did: 'did:example:relying-party' },
};
const relyingParty = { dltPrivateKey: 'unused-by-stubbed-ledger' };

const passingChecks = {
  TRUSTED_HOLDER: CheckResults.PASS,
  TRUSTED_ISSUER: CheckResults.PASS,
  UNEXPIRED: CheckResults.PASS,
  UNREVOKED: CheckResults.NOT_APPLICABLE,
  UNTAMPERED: CheckResults.PASS,
};

const failedChecks = (untampered) => ({
  TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
  TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
  UNEXPIRED: CheckResults.NOT_CHECKED,
  UNREVOKED: CheckResults.NOT_CHECKED,
  UNTAMPERED: untampered,
});

const envelopes = [
  {
    algorithm: KeyAlgorithms.SECP256K1,
    buildCredential: (id) => ({
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      credentialSubject: { email: 'holder@example.com', id: holderDid },
      expirationDate: '2099-01-01T00:00:00.000Z',
      id,
      issuanceDate: '2026-01-01T00:00:00.000Z',
      issuer: { id: issuerDid },
      type: [credentialType, 'VerifiableCredential'],
      vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
    }),
    name: 'VC 1.1',
    sign: signV1Credential,
  },
  {
    algorithm: KeyAlgorithms.ES256,
    buildCredential: (id) => ({
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      credentialSubject: { email: 'holder@example.com', id: holderDid },
      id,
      issuer: issuerDid,
      type: ['VerifiableCredential', credentialType],
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2099-01-01T00:00:00.000Z',
    }),
    name: 'VC 2.0',
    sign: async (...args) => signV2Credential(...args),
  },
];

describe('verification method identity', () => {
  const issuerKeyPair = generateJWAKeyPair(KeyAlgorithms.SECP256K1);
  const otherIssuerKeyPair = generateJWAKeyPair(KeyAlgorithms.SECP256K1);
  let fetchers;
  let issuerVc;
  let otherIssuerVc;

  beforeEach(async () => {
    resolveDidDocument.mock.resetCalls();
    fetchers = buildRegistrarFetchers(issuerKeyPair.publicKey);
    issuerVc = await signIssuerVc(issuerDid, issuerKeyPair);
    otherIssuerVc = await signIssuerVc(
      'did:example:other-issuer',
      otherIssuerKeyPair,
    );
  });

  after(() => mock.reset());

  envelopes.forEach(({ algorithm, buildCredential, name, sign }) => {
    describe(name, () => {
      const upperKeyPair = generateJWAKeyPair(algorithm);
      const lowerKeyPair = generateJWAKeyPair(algorithm);
      let credentialId;
      let credential;

      before(() => {
        credentialId = buildCredentialId(hashAndEncodeHex(nanoid()));
        credential = buildCredential(credentialId);
      });

      beforeEach(() => {
        resolveDidDocument.mock.mockImplementation(async () =>
          ledgerResolution(
            [
              [`${credentialId}#Key-1`, upperKeyPair.publicKey],
              [`${credentialId}#key-1`, lowerKeyPair.publicKey],
            ],
            [[credentialId, issuerVc]],
          ),
        );
      });

      it('resolves #Key-1 and #key-1 as independent verification methods', async () => {
        const result = await verify(
          [
            await sign(
              credential,
              upperKeyPair.privateKey,
              `${credentialId}#Key-1`,
            ),
            await sign(
              credential,
              lowerKeyPair.privateKey,
              `${credentialId}#key-1`,
            ),
          ],
          fetchers,
        );

        expect(checksOf(result)).toEqual([passingChecks, passingChecks]);
      });

      it('verifies a credential only against the method named by its exact kid', async () => {
        const result = await verify(
          [
            await sign(
              credential,
              upperKeyPair.privateKey,
              `${credentialId}#key-1`,
            ),
            await sign(
              credential,
              lowerKeyPair.privateKey,
              `${credentialId}#Key-1`,
            ),
          ],
          fetchers,
        );

        expect(checksOf(result)).toEqual([
          failedChecks(CheckResults.FAIL),
          failedChecks(CheckResults.FAIL),
        ]);
      });

      it('does not resolve a kid that matches a method only case-insensitively', async () => {
        const result = await verify(
          [
            await sign(
              credential,
              lowerKeyPair.privateKey,
              `${credentialId}#KEY-1`,
            ),
          ],
          fetchers,
        );

        expect(checksOf(result)).toEqual([
          failedChecks(CheckResults.DATA_INTEGRITY_ERROR),
        ]);
      });

      it('binds each credential to the issuer VC resolved for its exact id', async () => {
        const contentHash = hashAndEncodeHex(nanoid());
        const lowerId = buildCredentialId(contentHash);
        const upperId = buildCredentialId(contentHash.toUpperCase());
        resolveDidDocument.mock.mockImplementation(async () =>
          ledgerResolution(
            [
              [`${lowerId}#key-1`, lowerKeyPair.publicKey],
              [`${upperId}#key-1`, upperKeyPair.publicKey],
            ],
            [
              [lowerId, issuerVc],
              [upperId, otherIssuerVc],
            ],
          ),
        );

        const result = await verify(
          [
            await sign(
              buildCredential(lowerId),
              lowerKeyPair.privateKey,
              `${lowerId}#key-1`,
            ),
            await sign(
              buildCredential(upperId),
              upperKeyPair.privateKey,
              `${upperId}#key-1`,
            ),
          ],
          fetchers,
        );

        expect(checksOf(result)).toEqual([
          passingChecks,
          { ...passingChecks, TRUSTED_ISSUER: CheckResults.FAIL },
        ]);
      });
    });
  });
});

const verify = (credentials, fetchers) =>
  verifyCredentials(
    { credentials, expectedHolderDid: holderDid, relyingParty },
    fetchers,
    context,
  );

const checksOf = (result) =>
  result.map(({ credentialChecks }) => credentialChecks);

const buildCredentialId = (contentHash) =>
  `did:velocity:v2:${accountId}:1:42:${contentHash}`;

const ledgerResolution = (verificationMethods, boundIssuerVcs) => ({
  didDocument: {
    id: 'did:velocity:v2:multi',
    publicKey: verificationMethods.map(([id, publicKeyJwk]) => ({
      id,
      publicKeyJwk,
    })),
    service: [],
  },
  didDocumentMetadata: {
    boundIssuerVcs: boundIssuerVcs.map(([id, vc]) => ({
      format: 'jwt_vc',
      id,
      vc,
    })),
  },
  didResolutionMetadata: {},
});

const signIssuerVc = (did, keyPair) =>
  jwtSign(
    { vc: { type: ['CredentialMetadataListHeader'] } },
    keyPair.privateKey,
    { issuer: did, kid: `${did}#key-1` },
  );

const buildRegistrarFetchers = (issuerPublicKey) => ({
  getCredentialTypeMetadata: async () => [
    { credentialType, issuerCategory: 'ContactIssuer' },
  ],
  getOrganizationVerifiedProfile: async (did) => ({
    credentialSubject: {
      id: did,
      permittedVelocityServiceCategory: ['ContactIssuer'],
    },
  }),
  resolveDid: async (did) => ({
    id: did,
    publicKey: [{ id: '#key-1', publicKeyJwk: issuerPublicKey }],
  }),
});
