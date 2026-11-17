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

// Resolves did:velocity verification methods against contracts deployed to
// the local Besu node; only the registrar HTTP fetchers are stubbed.
const { before, describe, it } = require('node:test');
const { expect } = require('expect');
const { nanoid } = require('nanoid');
const { generateAccount } = require('@verii/blockchain-functions');
const {
  generateJWAKeyPair,
  hashAndEncodeHex,
  KeyAlgorithms,
} = require('@verii/crypto');
const { jwtSign } = require('@verii/jwt');
const { ALG_TYPE } = require('@verii/metadata-registration');
const { CheckResults, VeriiProtocolVersions } = require('@verii/vc-checks');
const { verifyCredentials } = require('../index');
const {
  anchorCredentialMetadataList,
  deployDidVelocityLedger,
} = require('./helpers/did-velocity-ledger');
const {
  signV1Credential,
  signV2Credential,
} = require('./helpers/sign-credentials');

const credentialType = 'EmailV1.0';
const holderDid = 'did:example:holder';
const issuerDid = 'did:example:issuer';
const noop = () => {};
const log = { debug: noop, error: noop, info: noop, warn: noop };

const passingChecks = {
  TRUSTED_HOLDER: CheckResults.PASS,
  TRUSTED_ISSUER: CheckResults.PASS,
  UNEXPIRED: CheckResults.PASS,
  UNREVOKED: CheckResults.NOT_APPLICABLE,
  UNTAMPERED: CheckResults.PASS,
};

const unresolvedKeyChecks = {
  TRUSTED_HOLDER: CheckResults.NOT_CHECKED,
  TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
  UNEXPIRED: CheckResults.NOT_CHECKED,
  UNREVOKED: CheckResults.NOT_CHECKED,
  UNTAMPERED: CheckResults.DATA_INTEGRITY_ERROR,
};

describe('did:velocity verification method lookup', { timeout: 300000 }, () => {
  const issuerKeyPair = generateJWAKeyPair(KeyAlgorithms.SECP256K1);
  const v1KeyPair = generateJWAKeyPair(KeyAlgorithms.SECP256K1);
  const v2KeyPair = generateJWAKeyPair(KeyAlgorithms.ES256);
  let context;
  let fetchers;
  let relyingParty;
  let v1CredentialId;
  let v2CredentialId;

  before(async () => {
    fetchers = buildRegistrarFetchers(issuerKeyPair.publicKey);
    const setupContext = { caoDid: 'did:example:cao', log, traceId: nanoid() };
    const ledger = await deployDidVelocityLedger(
      [credentialType],
      setupContext,
    );
    const issuerVc = await jwtSign(
      { vc: { type: ['CredentialMetadataListHeader'] } },
      issuerKeyPair.privateKey,
      { issuer: issuerDid, kid: `${issuerDid}#key-1` },
    );
    [v1CredentialId] = await anchorCredentialMetadataList(
      ledger,
      {
        algType: ALG_TYPE.HEX_AES_256,
        entries: [anchoredEntry(1, v1KeyPair.publicKey)],
        issuerVc,
        listId: 1,
      },
      setupContext,
    );
    [v2CredentialId] = await anchorCredentialMetadataList(
      ledger,
      {
        algType: ALG_TYPE.COSEKEY_AES_256,
        entries: [anchoredEntry(1, v2KeyPair.publicKey)],
        issuerVc,
        listId: 2,
      },
      setupContext,
    );
    context = {
      ...setupContext,
      config: ledger.config,
      rpcProvider: ledger.rpcProvider,
      tenant: { did: 'did:example:relying-party' },
    };
    relyingParty = { dltPrivateKey: generateAccount().privateKey };
  });

  it('verifies VC 1.1 and VC 2.0 credentials whose kid is the exact resolved DID URL', async () => {
    const result = await verifyCredentials(
      {
        credentials: [
          await signV1Credential(
            buildV1Credential(v1CredentialId),
            v1KeyPair.privateKey,
            `${v1CredentialId}#key-1`,
          ),
          signV2Credential(
            buildV2Credential(v2CredentialId),
            v2KeyPair.privateKey,
            `${v2CredentialId}#key-1`,
          ),
        ],
        expectedHolderDid: holderDid,
        relyingParty,
      },
      fetchers,
      context,
    );

    expect(result).toEqual([
      expect.objectContaining({
        credentialChecks: passingChecks,
        dataModelVersion: '1.1',
        signingAlgorithm: 'ES256K',
      }),
      expect.objectContaining({
        credentialChecks: passingChecks,
        dataModelVersion: '2.0',
        signingAlgorithm: 'ES256',
      }),
    ]);
  });

  it('does not resolve a VC 1.1 kid that matches the resolved DID URL only case-insensitively', async () => {
    const credential = buildV1Credential(v1CredentialId);
    const result = await verifyCredentials(
      {
        credentials: [
          await signV1Credential(
            credential,
            v1KeyPair.privateKey,
            `${v1CredentialId}#key-1`,
          ),
          await signV1Credential(
            credential,
            v1KeyPair.privateKey,
            `${v1CredentialId}#KEY-1`,
          ),
        ],
        expectedHolderDid: holderDid,
        relyingParty,
      },
      fetchers,
      context,
    );

    expect(result.map(({ credentialChecks }) => credentialChecks)).toEqual([
      passingChecks,
      unresolvedKeyChecks,
    ]);
  });

  it('does not resolve a VC 2.0 kid that matches the resolved DID URL only case-insensitively', async () => {
    const credential = buildV2Credential(v2CredentialId);
    const result = await verifyCredentials(
      {
        credentials: [
          signV2Credential(
            credential,
            v2KeyPair.privateKey,
            `${v2CredentialId}#key-1`,
          ),
          signV2Credential(
            credential,
            v2KeyPair.privateKey,
            `${v2CredentialId}#Key-1`,
          ),
        ],
        expectedHolderDid: holderDid,
        relyingParty,
      },
      fetchers,
      context,
    );

    expect(result.map(({ credentialChecks }) => credentialChecks)).toEqual([
      passingChecks,
      unresolvedKeyChecks,
    ]);
    expect(result[1]).not.toHaveProperty('credential');
  });
});

const anchoredEntry = (index, publicKey) => ({
  contentHash: hashAndEncodeHex(nanoid()),
  credentialType,
  index,
  publicKey,
});

const buildV1Credential = (id) => ({
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  credentialSubject: { email: 'holder@example.com', id: holderDid },
  expirationDate: '2099-01-01T00:00:00.000Z',
  id,
  issuanceDate: '2026-01-01T00:00:00.000Z',
  issuer: { id: issuerDid },
  type: [credentialType, 'VerifiableCredential'],
  vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
});

const buildV2Credential = (id) => ({
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  credentialSubject: { email: 'holder@example.com', id: holderDid },
  id,
  issuer: issuerDid,
  type: ['VerifiableCredential', credentialType],
  validFrom: '2026-01-01T00:00:00.000Z',
  validUntil: '2099-01-01T00:00:00.000Z',
});

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
