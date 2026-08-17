/*
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

const { beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const { generateJWAKeyPair, KeyAlgorithms } = require('@verii/crypto');
const { CredentialEnvelopeFormats } = require('@verii/jwt');

const mockIssueCredentials = mock.fn();
const mockMongoAllocationListQueries = mock.fn(() => 'allocation-queries');
const mockMongoDb = mock.fn(() => 'mongo-db');
const mockSignCredentials = mock.fn();

mock.module('@verii/verii-issuing', {
  namedExports: {
    issueCredentials: mockIssueCredentials,
    mongoAllocationListQueries: mockMongoAllocationListQueries,
    signCredentials: mockSignCredentials,
  },
});

mock.module('@spencejs/spence-mongo-repos', {
  namedExports: { mongoDb: mockMongoDb },
});

const {
  issueVeriiCredentialsFacade,
  signVeriiCredentialsFacade,
} = require('../../src/entities/credentials');

describe('credential issuing facades', () => {
  beforeEach(() => {
    mockIssueCredentials.mock.resetCalls();
    mockMongoAllocationListQueries.mock.resetCalls();
    mockMongoDb.mock.resetCalls();
    mockSignCredentials.mock.resetCalls();
  });

  it('passes an explicit format through the issue facade', async () => {
    const issuedCredentials = [
      { securedCredential: 'first-credential' },
      { securedCredential: 'second-credential' },
    ];
    mockIssueCredentials.mock.mockImplementationOnce(() =>
      Promise.resolve(issuedCredentials),
    );
    const fixture = buildFacadeFixture();

    await expect(
      issueVeriiCredentialsFacade({
        approvedCredentialsContent: fixture.credentialContentList,
        context: fixture.context,
        credentialFormat: CredentialEnvelopeFormats.VC_JWT,
        credentialSigningAlgorithms: fixture.credentialSigningAlgorithms,
        credentialSubjectId: fixture.credentialSubjectId,
        credentialTypeMetadatas: fixture.credentialTypeMetadatas,
        issuerService: fixture.issuerService,
      }),
    ).resolves.toBe(issuedCredentials);

    expect(mockIssueCredentials.mock.calls[0].arguments[0]).toEqual(
      expect.objectContaining({
        credentialFormat: CredentialEnvelopeFormats.VC_JWT,
        offers: fixture.credentialContentList,
      }),
    );
    expect(fixture.context).toEqual(
      expect.objectContaining({
        allocationListQueries: 'allocation-queries',
        caoDid: 'did:test:cao',
      }),
    );
  });

  it('passes an explicit format through the sign facade', async () => {
    const fixture = buildFacadeFixture();
    const issuedCredential = { securedCredential: 'signed-v2' };
    mockSignCredentials.mock.mockImplementationOnce(() =>
      Promise.resolve([{ issuedCredential, metadata: { listId: 2 } }]),
    );

    await expect(
      signVeriiCredentialsFacade({
        context: fixture.context,
        credentialContentList: fixture.credentialContentList,
        credentialFormat: CredentialEnvelopeFormats.VC_JWT,
        credentialSigningAlgorithms: fixture.credentialSigningAlgorithms,
        credentialSubjectId: fixture.credentialSubjectId,
        credentialTypeMetadatas: fixture.credentialTypeMetadatas,
        issuerService: fixture.issuerService,
      }),
    ).resolves.toEqual({
      credentialMetadata: { listId: 2 },
      issuedCredential,
    });

    expect(mockSignCredentials.mock.calls[0].arguments[0]).toEqual(
      expect.objectContaining({
        credentialFormat: CredentialEnvelopeFormats.VC_JWT,
        offers: fixture.credentialContentList,
      }),
    );
  });
});

const buildFacadeFixture = () => {
  const { publicKey } = generateJWAKeyPair(KeyAlgorithms.SECP256K1);
  const tenant = {
    _id: 'tenant-id',
    caoDid: 'did:test:cao',
    did: 'did:test:issuer',
    keysByPurpose: {
      DLT_TRANSACTIONS: {
        _id: 'dlt-key-id',
        publicJwk: publicKey,
      },
      ISSUING_METADATA: {
        _id: 'issuing-key-id',
        kidFragment: '#issuing-key-1',
      },
    },
    primaryAccount: '0x00112233445566778899aabbccddeeff00112233',
  };

  return {
    context: { tenant },
    credentialContentList: [{ type: ['VerifiableCredential', 'EmailV1.0'] }],
    credentialSigningAlgorithms: ['ES256'],
    credentialSubjectId: 'did:test:subject',
    credentialTypeMetadatas: [{ credentialType: 'EmailV1.0' }],
    issuerService: { velocityNetworkServiceId: 'did:test:issuer#refresh' },
  };
};
