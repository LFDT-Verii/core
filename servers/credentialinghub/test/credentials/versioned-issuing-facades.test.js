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

const mockIssueVersionedCredentials = mock.fn();
const mockMongoAllocationListQueries = mock.fn(() => 'allocation-queries');
const mockMongoDb = mock.fn(() => 'mongo-db');
const mockSignVersionedCredentials = mock.fn();

mock.module('@verii/verii-issuing', {
  namedExports: {
    issueVersionedCredentials: mockIssueVersionedCredentials,
    mongoAllocationListQueries: mockMongoAllocationListQueries,
    signVersionedCredentials: mockSignVersionedCredentials,
  },
});

mock.module('@spencejs/spence-mongo-repos', {
  namedExports: { mongoDb: mockMongoDb },
});

const {
  issueVeriiCredentialsFacade,
  issueVersionedCredentialsFacade,
  signVeriiCredentialsFacade,
  signVersionedCredentialsFacade,
} = require('../../src/entities/credentials');

describe('versioned issuing facades', () => {
  beforeEach(() => {
    mockIssueVersionedCredentials.mock.resetCalls();
    mockMongoAllocationListQueries.mock.resetCalls();
    mockMongoDb.mock.resetCalls();
    mockSignVersionedCredentials.mock.resetCalls();
  });

  it('keeps the historical issue facade v1-only', async () => {
    mockIssueVersionedCredentials.mock.mockImplementationOnce(() =>
      Promise.resolve([
        { compact: 'first-compact' },
        { compact: 'second-compact' },
      ]),
    );
    const fixture = buildFacadeFixture();

    await expect(
      issueVeriiCredentialsFacade(
        fixture.credentialContentList,
        fixture.credentialSubjectId,
        fixture.credentialTypeMetadatas,
        fixture.credentialSigningAlgorithms,
        fixture.issuerService,
        fixture.context,
      ),
    ).resolves.toEqual(['first-compact', 'second-compact']);

    expect(mockIssueVersionedCredentials.mock.calls[0].arguments[0]).toEqual(
      expect.objectContaining({
        credentialFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
        offers: fixture.credentialContentList,
      }),
    );
  });

  it('keeps the historical sign facade v1-only', async () => {
    mockSignVersionedCredentials.mock.mockImplementationOnce(() =>
      Promise.resolve([
        {
          issuanceResult: { compact: 'signed-compact' },
          metadata: { listId: 1 },
        },
      ]),
    );
    const fixture = buildFacadeFixture();

    await expect(
      signVeriiCredentialsFacade(
        fixture.credentialContentList,
        fixture.credentialSubjectId,
        fixture.credentialTypeMetadatas,
        fixture.credentialSigningAlgorithms,
        fixture.issuerService,
        fixture.context,
      ),
    ).resolves.toEqual({
      credentialMetadata: { listId: 1 },
      vcJwt: 'signed-compact',
    });

    expect(mockSignVersionedCredentials.mock.calls[0].arguments[0]).toEqual(
      expect.objectContaining({
        credentialFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
        offers: fixture.credentialContentList,
      }),
    );
  });

  it('passes an explicit format through the neutral facades', async () => {
    const fixture = buildFacadeFixture();
    mockIssueVersionedCredentials.mock.mockImplementationOnce(() =>
      Promise.resolve([{ compact: 'issued-v2' }]),
    );
    mockSignVersionedCredentials.mock.mockImplementationOnce(() =>
      Promise.resolve([
        {
          issuanceResult: { compact: 'signed-v2' },
          metadata: { listId: 2 },
        },
      ]),
    );

    await expect(
      issueVersionedCredentialsFacade({
        approvedCredentialsContent: fixture.credentialContentList,
        context: fixture.context,
        credentialFormat: CredentialEnvelopeFormats.VC_JWT,
        credentialSigningAlgorithms: fixture.credentialSigningAlgorithms,
        credentialSubjectId: fixture.credentialSubjectId,
        credentialTypeMetadatas: fixture.credentialTypeMetadatas,
        issuerService: fixture.issuerService,
      }),
    ).resolves.toEqual([{ compact: 'issued-v2' }]);
    await expect(
      signVersionedCredentialsFacade({
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
      issuanceResult: { compact: 'signed-v2' },
    });

    expect(mockIssueVersionedCredentials.mock.calls[0].arguments[0]).toEqual(
      expect.objectContaining({
        credentialFormat: CredentialEnvelopeFormats.VC_JWT,
      }),
    );
    expect(mockSignVersionedCredentials.mock.calls[0].arguments[0]).toEqual(
      expect.objectContaining({
        credentialFormat: CredentialEnvelopeFormats.VC_JWT,
      }),
    );
    expect(fixture.context).toEqual(
      expect.objectContaining({
        allocationListQueries: 'allocation-queries',
        caoDid: 'did:test:cao',
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
