/*
 * Copyright 2024 Velocity Team
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
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const { ALG_TYPE } = require('@verii/metadata-registration');

const mockAddCredentialMetadataEntry = mock.fn();
const mockCreateCredentialMetadataList = mock.fn();
const mockAddRevocationListSigned = mock.fn();
const mockIsFreeCredentialType = mock.fn();
const mockResolveDidDocument = mock.fn();

mock.module('@verii/metadata-registration', {
  namedExports: {
    ALG_TYPE,
    initRevocationRegistry: () => ({
      addRevocationListSigned: mockAddRevocationListSigned,
    }),
    initMetadataRegistry: () => ({
      addCredentialMetadataEntry: mockAddCredentialMetadataEntry,
      createCredentialMetadataList: mockCreateCredentialMetadataList,
      isFreeCredentialType: mockIsFreeCredentialType,
      resolveDidDocument: mockResolveDidDocument,
    }),
  },
});

mockAddCredentialMetadataEntry.mock.mockImplementation(() =>
  Promise.resolve(true),
);
mockCreateCredentialMetadataList.mock.mockImplementation(() =>
  Promise.resolve(true),
);

const { KeyAlgorithms } = require('@verii/crypto');
const {
  CredentialDataModelVersions,
  CredentialEnvelopeFormats,
  decodeCredentialEnvelope,
  jwtDecode,
  jwtSign,
  jwtVerify,
} = require('@verii/jwt');
const { publicJwkMatcher } = require('@verii/tests-helpers');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const { toLower } = require('lodash/fp');
const { MongoClient } = require('mongodb');
const { first, map } = require('lodash/fp');
const { nanoid } = require('nanoid');
const { hashOffer } = require('../src/domain/hash-offer');
const { issueCredentials, signCredentials } = require('../src');
const { collectionClient } = require('./helpers/collection-client');
const { entityFactory } = require('./helpers/entity-factory');
const { offerFactory } = require('./helpers/offer-factory');
const { createExampleDid } = require('./helpers/create-example-did');
const {
  credentialTypesMap,
  credentialTypeMetadata,
} = require('./helpers/credential-types-map');
const {
  jwtVcExpectation,
  extractOfferType,
} = require('./helpers/jwt-vc-expectation');
const {
  mongoAllocationListQueries,
} = require('../src/adapters/mongo-allocation-list-queries');
const { calcAlgTypeName } = require('../src/utils/calc-alg-type-name');

const METADATA_LIST_CONTRACT_ADDRESS = '0xabcdef';
const INTERNAL_SIGNING_ALGORITHMS = Object.freeze([
  KeyAlgorithms.SECP256K1,
  KeyAlgorithms.ES256,
  KeyAlgorithms.RS256,
]);
const JOSE_ALGORITHMS = Object.freeze(['ES256K', 'ES256', 'RS256']);

describe('issuing velocity verifiable credentials', () => {
  const mongoClient = new MongoClient('mongodb://localhost:27017/');

  let allocationsCollection;
  let issuer;
  let issuerEntity;
  let caoEntity;
  let context;

  const buildCredentialOptions = (overrides) => ({
    context,
    credentialFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
    credentialTypesMap,
    issuer,
    ...overrides,
  });

  before(async () => {
    allocationsCollection = await collectionClient({
      mongoClient,
      name: 'allocations',
    });
    issuerEntity = entityFactory({ service: [{ id: '#issuer-1' }] });
    caoEntity = entityFactory({ service: [{ id: '#cao-1' }] });
    issuer = {
      id: nanoid(),
      did: issuerEntity.did,
      issuingRefreshServiceId: issuerEntity.service[1]?.id,
      issuingServiceKMSKeyId: issuerEntity.kmsKeyId,
      issuingServiceDIDKeyId: issuerEntity.key[0].id,
      dltOperatorAddress: issuerEntity.primaryAddress,
      dltOperatorKMSKeyId: issuerEntity.kmsKeyId,
      dltOperatorDLTKeyId: issuerEntity.key[0].id,
      dltPrimaryAddress: issuerEntity.primaryAddress,
    };
  });

  beforeEach(async () => {
    await allocationsCollection.deleteMany();
    mockAddRevocationListSigned.mock.resetCalls();
    mockAddCredentialMetadataEntry.mock.resetCalls();
    mockCreateCredentialMetadataList.mock.resetCalls();
    mockIsFreeCredentialType.mock.resetCalls();
    mockResolveDidDocument.mock.resetCalls();
    mockAddCredentialMetadataEntry.mock.mockImplementation(() =>
      Promise.resolve(true),
    );
    mockIsFreeCredentialType.mock.mockImplementation(() =>
      Promise.resolve(false),
    );
    context = buildContext({
      issuerEntity,
      caoEntity,
      allocationListQueries: mongoAllocationListQueries(
        mongoClient.db('test-collections'),
        'allocations',
      ),
    });
  });

  after(() => {
    mongoClient.close();
    mock.reset();
  });

  it('should create vcs', async () => {
    const offers = map(offerFactory, [
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://example.com/context.json',
        ],
        issuerId: issuerEntity.did,
      }, // default email credential
      {
        type: 'EmploymentCurrentV1.1',
        issuerId: issuerEntity.did,
        credentialSubject: {
          role: 'Software Developer',
          legalEmployer: {
            name: 'ACME Corporation',
          },
          startDate: '2022-04-01',
        },
      },
      {
        '@context': 'http://imsglobal.org/clr20.context.json',
        type: '1EdtechCLR2.0',
        issuerId: issuerEntity.did,
        credentialSubject: require('./clrSubject.json'),
        credentialSchema: [
          {
            type: 'ImsGlobalValidator2019',
            id: 'https://imsglobal.org/schemas/clr-v2.0-schema.json',
          },
        ],
      },
    ]);
    const userId = createExampleDid();
    const issuedCredentials = await issueCredentials(
      buildCredentialOptions({
        credentialSigningAlgorithms: [
          KeyAlgorithms.SECP256K1,
          KeyAlgorithms.SECP256K1,
          KeyAlgorithms.RS256,
        ],
        credentialSubjectId: userId,
        offers,
      }),
    );
    const credentials = map('securedCredential', issuedCredentials);

    expect(credentials.length).toEqual(3);
    for (let i = 0; i < credentials.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await verifyCredentialAndAddEntryExpectations(
        credentials[i],
        mockAddCredentialMetadataEntry.mock.calls[i].arguments,
        {
          issuerEntity,
          caoEntity,
          offer: offers[i],
          userId,
          credentialTypesMap,
        },
      );
    }
    expect(mockCreateCredentialMetadataList.mock.callCount()).toEqual(2);
    await verifyCreateMetadataListCall(
      mockCreateCredentialMetadataList.mock.calls[0],
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[0].arguments[0].listId,
      ALG_TYPE.HEX_AES_256,
      { issuerEntity, caoEntity },
    );
    await verifyCreateMetadataListCall(
      mockCreateCredentialMetadataList.mock.calls[1],
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[2].arguments[0].listId,
      ALG_TYPE.COSEKEY_AES_256,
      { issuerEntity, caoEntity },
    );

    expect(map('arguments', mockAddRevocationListSigned.mock.calls)).toEqual([
      [expect.any(Number), caoEntity.did],
    ]);
  });

  it('preserves v1 claim mapping, result order, and one anchor write per credential', async () => {
    const offers = [
      offerFactory({
        credentialSubject: { email: 'first@example.com' },
        issuerId: issuerEntity.did,
      }),
      offerFactory({
        credentialSubject: { email: 'second@example.com' },
        issuerId: issuerEntity.did,
      }),
    ];
    const credentialSubjectId = createExampleDid();

    const credentials = await issueCredentials(
      buildCredentialOptions({
        credentialSigningAlgorithms: [
          KeyAlgorithms.SECP256K1,
          KeyAlgorithms.ES256,
        ],
        credentialSubjectId,
        offers,
      }),
    );
    const securedCredentials = map('securedCredential', credentials);
    const decodedCredentials = securedCredentials.map(jwtDecode);

    expect(securedCredentials).toEqual([
      expect.any(String),
      expect.any(String),
    ]);
    expect(decodedCredentials.map(({ header }) => header.alg)).toEqual([
      'ES256K',
      'ES256',
    ]);
    expect(
      decodedCredentials.map(({ payload }) => payload.vc.credentialSubject),
    ).toEqual([
      { email: 'first@example.com', id: credentialSubjectId },
      { email: 'second@example.com', id: credentialSubjectId },
    ]);
    expect(
      decodedCredentials.map(({ payload }) => Object.keys(payload).sort()),
    ).toEqual([
      ['iat', 'iss', 'jti', 'nbf', 'sub', 'vc'],
      ['iat', 'iss', 'jti', 'nbf', 'sub', 'vc'],
    ]);
    expect(
      decodedCredentials.map(({ payload }) => payload.vc['@context'][0]),
    ).toEqual([
      'https://www.w3.org/2018/credentials/v1',
      'https://www.w3.org/2018/credentials/v1',
    ]);
    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(2);
    expect(
      mockAddCredentialMetadataEntry.mock.calls.map(
        ({ arguments: [metadata] }) => metadata.credentialType,
      ),
    ).toEqual(['EmailV1.0', 'EmailV1.0']);
    expect(
      mockAddCredentialMetadataEntry.mock.calls.map(
        ({ arguments: [metadata] }, index) =>
          decodedCredentials[index].header.kid.startsWith(
            `did:velocity:v2:${toLower(issuerEntity.primaryAddress)}:${
              metadata.listId
            }:${metadata.index}:`,
          ),
      ),
    ).toEqual([true, true]);
  });

  it('returns a format-neutral result for JWT-VC JSON-LD', async () => {
    const [result] = await issueCredentials(
      buildCredentialOptions({
        credentialSigningAlgorithms: [KeyAlgorithms.SECP256K1],
        credentialSubjectId: createExampleDid(),
        offers: [offerFactory({ issuerId: issuerEntity.did })],
      }),
    );
    const envelope = decodeCredentialEnvelope(result.securedCredential);

    expect(result).toEqual({
      credential: envelope.credential,
      credentialFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
      credentialId: envelope.credential.id,
      credentialStatus: envelope.credential.credentialStatus,
      dataModelVersion: CredentialDataModelVersions.V1_1,
      securedCredential: expect.any(String),
      securingMechanism: { algorithm: 'ES256K', type: 'jose' },
    });
  });

  it('returns a neutral unanchored signing result', async () => {
    const credentialSubjectId = createExampleDid();
    const [signedCredential] = await signCredentials(
      buildCredentialOptions({
        credentialSigningAlgorithms: [KeyAlgorithms.SECP256K1],
        credentialSubjectId,
        offers: [offerFactory({ issuerId: issuerEntity.did })],
      }),
    );
    const envelope = decodeCredentialEnvelope(
      signedCredential.issuedCredential.securedCredential,
    );

    expect(signedCredential).toEqual({
      issuedCredential: expect.objectContaining({
        credential: envelope.credential,
        credentialFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
        securedCredential: expect.any(String),
      }),
      metadata: expect.objectContaining({
        credentialType: 'EmailV1.0',
        publicKey: publicJwkMatcher(KeyAlgorithms.SECP256K1),
      }),
    });
    expect(envelope).toEqual(
      expect.objectContaining({
        dataModelVersion: CredentialDataModelVersions.V1_1,
        envelopeFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
      }),
    );
    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
  });

  it('signs an explicitly selected format without anchoring it', async () => {
    const [{ issuedCredential, metadata }] = await signCredentials({
      ...buildCredentialOptions({
        credentialSigningAlgorithms: [KeyAlgorithms.ES256],
        credentialSubjectId: createExampleDid(),
        offers: [offerFactory({ issuerId: issuerEntity.did })],
      }),
      credentialFormat: CredentialEnvelopeFormats.VC_JWT,
    });

    expect(issuedCredential).toEqual(
      expect.objectContaining({
        credentialFormat: CredentialEnvelopeFormats.VC_JWT,
        dataModelVersion: CredentialDataModelVersions.V2_0,
        securedCredential: expect.any(String),
        securingMechanism: { algorithm: 'ES256', type: 'jose' },
      }),
    );
    expect(metadata.publicKey).toEqual(publicJwkMatcher(KeyAlgorithms.ES256));
    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
  });

  it('returns ordered v2 results for every supported internal signing algorithm', async () => {
    const credentialSubjectId = createExampleDid();
    const offers = [
      offerFactory({
        credentialSubject: { email: 'secp256k1@example.com' },
        issuerId: issuerEntity.did,
      }),
      offerFactory({
        credentialSubject: { role: 'P-256 Engineer' },
        credentialType: 'EmploymentCurrentV1.1',
        issuerId: issuerEntity.did,
      }),
      offerFactory({
        credentialSubject: { achievement: 'RSA Badge' },
        credentialType: 'OpenBadgeCredential',
        issuerId: issuerEntity.did,
      }),
    ];

    const results = await issueCredentials({
      ...buildCredentialOptions({
        credentialSigningAlgorithms: INTERNAL_SIGNING_ALGORITHMS,
        credentialSubjectId,
        offers,
      }),
      credentialFormat: CredentialEnvelopeFormats.VC_JWT,
    });

    expect(results.map(({ dataModelVersion }) => dataModelVersion)).toEqual([
      CredentialDataModelVersions.V2_0,
      CredentialDataModelVersions.V2_0,
      CredentialDataModelVersions.V2_0,
    ]);
    expect(results.map(({ credentialFormat }) => credentialFormat)).toEqual([
      CredentialEnvelopeFormats.VC_JWT,
      CredentialEnvelopeFormats.VC_JWT,
      CredentialEnvelopeFormats.VC_JWT,
    ]);
    expect(
      results.map(({ securingMechanism }) => securingMechanism.algorithm),
    ).toEqual(JOSE_ALGORITHMS);
    expect(
      results.map(({ credential }) => credential.credentialSubject),
    ).toEqual([
      { email: 'secp256k1@example.com', id: credentialSubjectId },
      { role: 'P-256 Engineer', id: credentialSubjectId },
      { achievement: 'RSA Badge', id: credentialSubjectId },
    ]);
    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(3);

    for (const [index, result] of results.entries()) {
      const envelope = decodeCredentialEnvelope(result.securedCredential);
      expect(envelope.credential).toEqual(result.credential);
      expect(envelope.protectedHeader).toEqual(
        expect.objectContaining({
          alg: JOSE_ALGORITHMS[index],
          cty: 'vc',
          kid: `${result.credentialId}#key-1`,
          typ: 'vc+jwt',
        }),
      );
      expect(result.credential).not.toHaveProperty('issuanceDate');
      expect(result.credential).not.toHaveProperty('expirationDate');
      expect(result.credential).not.toHaveProperty('proof');
      expect(
        mockAddCredentialMetadataEntry.mock.calls[index].arguments[0].publicKey,
      ).toEqual(publicJwkMatcher(INTERNAL_SIGNING_ALGORITHMS[index]));
    }
  });

  it('rejects a mixed-format batch before attempting an anchor write', async () => {
    await expect(
      issueCredentials({
        ...buildCredentialOptions({
          credentialSigningAlgorithms: [
            KeyAlgorithms.SECP256K1,
            KeyAlgorithms.ES256,
          ],
          credentialSubjectId: createExampleDid(),
          offers: [
            offerFactory({ issuerId: issuerEntity.did }),
            offerFactory({ issuerId: issuerEntity.did }),
          ],
        }),
        credentialFormat: [
          CredentialEnvelopeFormats.JWT_VC_JSON_LD,
          CredentialEnvelopeFormats.VC_JWT,
        ],
      }),
    ).rejects.toThrow('A credential batch must use one supported format');
    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
  });

  it('rejects missing and unknown formats before allocating list entries', async () => {
    for (const credentialFormat of [undefined, 'unknown-format']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        issueCredentials({
          ...buildCredentialOptions({
            credentialSubjectId: createExampleDid(),
            offers: [offerFactory({ issuerId: issuerEntity.did })],
          }),
          credentialFormat,
        }),
      ).rejects.toThrow('A credential batch must use one supported format');
    }

    expect(await allocationsCollection.collection().countDocuments()).toEqual(
      0,
    );
    expect(mockCreateCredentialMetadataList.mock.callCount()).toEqual(0);
    expect(mockAddRevocationListSigned.mock.callCount()).toEqual(0);
    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
  });

  it('propagates a partial v2 anchor failure after one write attempt per credential', async () => {
    const anchorError = new Error('second metadata anchor failed');
    mockAddCredentialMetadataEntry.mock.mockImplementation((metadata) =>
      metadata.credentialType === 'EmploymentCurrentV1.1'
        ? Promise.reject(anchorError)
        : Promise.resolve(true),
    );

    await expect(
      issueCredentials({
        ...buildCredentialOptions({
          credentialSigningAlgorithms: [
            KeyAlgorithms.SECP256K1,
            KeyAlgorithms.ES256,
          ],
          credentialSubjectId: createExampleDid(),
          offers: [
            offerFactory({ issuerId: issuerEntity.did }),
            offerFactory({
              credentialType: 'EmploymentCurrentV1.1',
              issuerId: issuerEntity.did,
            }),
          ],
        }),
        credentialFormat: CredentialEnvelopeFormats.VC_JWT,
      }),
    ).rejects.toBe(anchorError);
    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(2);
    expect(mockResolveDidDocument.mock.callCount()).toEqual(0);
  });

  it('uses generic metadata fallback when algorithms are omitted explicitly', async () => {
    const offer = offerFactory({ issuerId: issuerEntity.did });
    const [credential] = await issueCredentials(
      buildCredentialOptions({
        credentialSubjectId: createExampleDid(),
        offers: [offer],
      }),
    );

    const { header } = jwtDecode(credential.securedCredential);
    expect(header.alg).toEqual('ES256K');
    const [{ publicKey }] = mockAddCredentialMetadataEntry.mock.calls.map(
      (call) => call.arguments[0],
    );
    expect(publicKey).toEqual(publicJwkMatcher(KeyAlgorithms.SECP256K1));
    expect(mockAddCredentialMetadataEntry.mock.calls[0].arguments[3]).toEqual(
      ALG_TYPE.COSEKEY_AES_256,
    );
    await verifyCreateMetadataListCall(
      mockCreateCredentialMetadataList.mock.calls[0],
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[0].arguments[0].listId,
      ALG_TYPE.COSEKEY_AES_256,
      { issuerEntity, caoEntity },
    );
  });

  it('signs without anchoring when algorithms are omitted explicitly', async () => {
    const offer = offerFactory({ issuerId: issuerEntity.did });
    const [{ issuedCredential }] = await signCredentials(
      buildCredentialOptions({
        credentialSubjectId: createExampleDid(),
        offers: [offer],
      }),
    );

    expect(jwtDecode(issuedCredential.securedCredential).header.alg).toEqual(
      'ES256K',
    );
    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
  });

  it('rejects unsupported algorithms before any durable side effect', async () => {
    await Promise.all(
      ['EdDSA', 'constructor', 'toString'].map((algorithm) =>
        expect(
          issueCredentials(
            buildCredentialOptions({
              credentialSigningAlgorithms: [algorithm],
              credentialSubjectId: createExampleDid(),
              offers: [offerFactory({ issuerId: issuerEntity.did })],
            }),
          ),
        ).rejects.toThrow(
          `Credential signing algorithm is not supported: ${algorithm}`,
        ),
      ),
    );

    await expect(
      allocationsCollection.collection().countDocuments(),
    ).resolves.toEqual(0);
    expect(mockCreateCredentialMetadataList.mock.callCount()).toEqual(0);
    expect(mockAddRevocationListSigned.mock.callCount()).toEqual(0);
    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
  });

  it('rejects unsupported metadata algorithms before any durable side effect', async () => {
    const unsupportedCredentialTypesMap = {
      ...credentialTypesMap,
      'EmailV1.0': {
        ...credentialTypesMap['EmailV1.0'],
        defaultSignatureAlgorithm: 'constructor',
      },
    };

    await expect(
      issueCredentials(
        buildCredentialOptions({
          credentialSubjectId: createExampleDid(),
          credentialTypesMap: unsupportedCredentialTypesMap,
          offers: [offerFactory({ issuerId: issuerEntity.did })],
        }),
      ),
    ).rejects.toThrow(
      'Credential signing algorithm is not supported: constructor',
    );

    await expect(
      allocationsCollection.collection().countDocuments(),
    ).resolves.toEqual(0);
    expect(mockCreateCredentialMetadataList.mock.callCount()).toEqual(0);
    expect(mockAddRevocationListSigned.mock.callCount()).toEqual(0);
    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
  });

  it('should use an explicitly resolved ES256 algorithm instead of the Open Badge RS256 default', async () => {
    const offers = [
      offerFactory({
        credentialType: 'OpenBadgeCredential',
        issuerId: issuerEntity.did,
      }),
    ];
    const [credential] = await issueCredentials(
      buildCredentialOptions({
        credentialSigningAlgorithms: [KeyAlgorithms.ES256],
        credentialSubjectId: createExampleDid(),
        offers,
      }),
    );

    const { header } = jwtDecode(credential.securedCredential);
    expect(header.alg).toEqual('ES256');
    const [{ publicKey }] = mockAddCredentialMetadataEntry.mock.calls.map(
      (call) => call.arguments[0],
    );
    expect(publicKey).toEqual(publicJwkMatcher(KeyAlgorithms.ES256));
    expect(mockAddCredentialMetadataEntry.mock.calls[0].arguments[3]).toEqual(
      ALG_TYPE.COSEKEY_AES_256,
    );
    expect(mockCreateCredentialMetadataList.mock.callCount()).toEqual(1);
    await verifyCreateMetadataListCall(
      mockCreateCredentialMetadataList.mock.calls[0],
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[0].arguments[0].listId,
      ALG_TYPE.COSEKEY_AES_256,
      { issuerEntity, caoEntity },
    );
    await expect(
      jwtVerify(credential.securedCredential, publicKey, false),
    ).resolves.toEqual(
      expect.objectContaining({
        header: expect.objectContaining({ alg: 'ES256' }),
      }),
    );
  });

  it('propagates an anchor error without reading or retrying the write', async () => {
    const anchorError = new Error('metadata anchor failed');
    mockAddCredentialMetadataEntry.mock.mockImplementation(() =>
      Promise.reject(anchorError),
    );
    mockIsFreeCredentialType.mock.mockImplementation(() =>
      Promise.resolve(true),
    );
    mockResolveDidDocument.mock.mockImplementation(({ did }) => {
      const { publicKey } =
        mockAddCredentialMetadataEntry.mock.calls[0].arguments[0];
      return Promise.resolve({
        didDocument: {
          publicKey: [{ id: `${did}#key-1`, publicKeyJwk: publicKey }],
        },
        didResolutionMetadata: {},
      });
    });

    await expect(
      issueCredentials(
        buildCredentialOptions({
          credentialSigningAlgorithms: ['ES256'],
          credentialSubjectId: createExampleDid(),
          offers: [offerFactory({ issuerId: issuerEntity.did })],
        }),
      ),
    ).rejects.toBe(anchorError);
    expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(1);
    expect(mockResolveDidDocument.mock.callCount()).toEqual(0);
  });

  it('should create vcs with context in credentialSubject (allocation lists exists)', async () => {
    context.config.credentialSubjectContext = true;
    await allocationsCollection.insertOne({
      tenantId: issuer.id,
      entityName: 'HEX_AES_256_MetadataListAllocations',
      freeIndexes: [1, 2],
      currentListId: 999,
      operatorAddress: issuerEntity.primaryAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await allocationsCollection.insertOne({
      tenantId: issuer.id,
      entityName: 'COSEKEY_AES_256_MetadataListAllocations',
      freeIndexes: [99, 100],
      currentListId: 777,
      operatorAddress: issuerEntity.primaryAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const offers = map(offerFactory, [
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://example.com/context.json',
        ],
        issuerId: issuerEntity.did,
      }, // default email credential
      {
        type: 'EmploymentCurrentV1.1',
        issuerId: issuerEntity.did,
        credentialSubject: {
          role: 'Software Developer',
          legalEmployer: {
            name: 'ACME Corporation',
          },
          startDate: '2022-04-01',
        },
      },
      {
        '@context': 'http://imsglobal.org/clr20.context.json',
        type: '1EdtechCLR2.0',
        issuerId: issuerEntity.did,
        credentialSubject: require('./clrSubject.json'),
      },
    ]);
    const userId = createExampleDid();
    const issuedCredentials = await issueCredentials(
      buildCredentialOptions({
        credentialSigningAlgorithms: [
          KeyAlgorithms.SECP256K1,
          KeyAlgorithms.SECP256K1,
          KeyAlgorithms.RS256,
        ],
        credentialSubjectId: userId,
        offers,
      }),
    );
    const credentials = map('securedCredential', issuedCredentials);

    expect(credentials.length).toEqual(3);
    for (let i = 0; i < credentials.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await verifyCredentialAndAddEntryExpectations(
        credentials[i],
        mockAddCredentialMetadataEntry.mock.calls[i].arguments,
        { issuerEntity, caoEntity, offer: offers[i], userId },
        context,
      );
    }

    expect(mockCreateCredentialMetadataList.mock.callCount()).toEqual(0);
    expect(map('arguments', mockAddRevocationListSigned.mock.calls)).toEqual([
      [expect.any(Number), caoEntity.did],
    ]);
  });

  it('should create a vc from an legacy offer', async () => {
    const offers = map(offerFactory, [
      {
        issuerId: issuerEntity.did,
        credentialSchema: {
          type: 'JsonSchemaValidator2018',
          id: credentialTypeMetadata['EmailV1.0'].schemaUrl,
        },
        contentHash: {
          type: 'VelocityContentHash2020',
          value: 1234,
        },
        credentialSubject: {
          email: 'bob.foobar@example.com',
          vendorUserId: nanoid(),
        },
      },
    ]);
    const userId = createExampleDid();

    const issuedCredentials = await issueCredentials(
      buildCredentialOptions({
        credentialSigningAlgorithms: [KeyAlgorithms.SECP256K1],
        credentialSubjectId: userId,
        offers,
      }),
    );
    const credentials = map('securedCredential', issuedCredentials);

    expect(credentials).toEqual([expect.any(String)]);
    for (let i = 0; i < credentials.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await verifyCredentialAndAddEntryExpectations(
        credentials[i],
        mockAddCredentialMetadataEntry.mock.calls[i].arguments,
        { issuerEntity, caoEntity, offer: offers[i], userId },
      );
    }

    expect(mockCreateCredentialMetadataList.mock.callCount()).toEqual(1);
    await verifyCreateMetadataListCall(
      mockCreateCredentialMetadataList.mock.calls[0],
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[0].arguments[0].listId,
      ALG_TYPE.HEX_AES_256,
      { issuerEntity, caoEntity },
    );
    expect(map('arguments', mockAddRevocationListSigned.mock.calls)).toEqual([
      [expect.any(Number), caoEntity.did],
    ]);
  });

  it('should create a vc from an offer with status and refresh service', async () => {
    const offers = map(offerFactory, [
      {
        issuerId: issuerEntity.did,
        credentialSchema: {
          type: 'JsonSchemaValidator2018',
          id: credentialTypeMetadata['EmailV1.0'].schemaUrl,
        },
        contentHash: {
          type: 'VelocityContentHash2020',
          value: 1234,
        },
        refreshService: {
          id: 'https://example.com/refreshService',
        },
        credentialStatus: [
          {
            id: 'https://example.com/statusList',
            type: 'DummyCredentialStatus',
          },
        ],
      },
    ]);

    const userId = createExampleDid();

    const issuedCredentials = await issueCredentials(
      buildCredentialOptions({
        credentialSigningAlgorithms: [KeyAlgorithms.SECP256K1],
        credentialSubjectId: userId,
        offers,
      }),
    );
    const credentials = map('securedCredential', issuedCredentials);

    expect(credentials).toEqual([expect.any(String)]);
    for (let i = 0; i < credentials.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await verifyCredentialAndAddEntryExpectations(
        credentials[i],
        mockAddCredentialMetadataEntry.mock.calls[i].arguments,
        { issuerEntity, caoEntity, offer: offers[i], userId },
      );
    }

    expect(mockCreateCredentialMetadataList.mock.callCount()).toEqual(1);
    await verifyCreateMetadataListCall(
      mockCreateCredentialMetadataList.mock.calls[0],
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[0].arguments[0].listId,
      ALG_TYPE.HEX_AES_256,
      { issuerEntity, caoEntity },
    );
    expect(map('arguments', mockAddRevocationListSigned.mock.calls)).toEqual([
      [expect.any(Number), caoEntity.did],
    ]);
  });
});

const buildContext = ({ issuerEntity, caoEntity, ...args }) => ({
  kms: {
    exportKeyOrSecret: (keyId) => {
      if (keyId !== issuerEntity.kmsKeyId) {
        throw new Error('KeyNotFound');
      }
      return Promise.resolve({
        privateJwk: issuerEntity.keyPair.privateKey,
        id: issuerEntity.kmsKeyId,
      });
    },
    async signJwt(jwtJson, keyId, options) {
      const key = await this.exportKeyOrSecret(keyId);
      return jwtSign(jwtJson, key.privateJwk, options);
    },
  },
  caoDid: caoEntity.did,
  config: {
    revocationContractAddress: '0x1234',
    metadataRegistryContractAddress: METADATA_LIST_CONTRACT_ADDRESS,
    credentialExtensionsContextUrl:
      'https://lib.test/contexts/credential-extensions-2022.jsonld.json',
    includeContentHashInCredentialId: true,
  },
  ...args,
});

const verifyCreateMetadataListCall = async (
  call,
  issuer,
  listId,
  algType,
  { issuerEntity, caoEntity },
) => {
  expect(call.arguments).toEqual([
    issuer.dltPrimaryAddress,
    listId,
    expect.any(String),
    caoEntity.did,
    algType,
  ]);

  const issuerAttestationJwtVc = call.arguments[2];
  const { header, payload } = await jwtVerify(
    issuerAttestationJwtVc,
    issuerEntity.keyPair.publicKey,
  );
  expect(header).toEqual({
    alg: 'ES256K',
    kid: issuerEntity.key[0].id,
    typ: 'JWT',
  });
  expect(payload).toEqual({
    iat: expect.any(Number),
    iss: issuerEntity.did,
    jti: `ethereum:${METADATA_LIST_CONTRACT_ADDRESS}/getСredentialMetadataListIssuerVC?address=${issuerEntity.primaryAddress}&listId=${listId}`,
    nbf: expect.any(Number),
    vc: {
      credentialSubject: {
        accountId: issuerEntity.primaryAddress,
        listId,
      },
      id: `ethereum:${METADATA_LIST_CONTRACT_ADDRESS}/getСredentialMetadataListIssuerVC?address=${issuerEntity.primaryAddress}&listId=${listId}`,
      issuer: issuerEntity.did,
      type: ['CredentialMetadataListHeader'],
      issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
    },
  });
};

const verifyCredentialAndAddEntryExpectations = async (
  credential,
  credentialMetadataArgs,
  { issuerEntity, caoEntity, offer, userId },
  context,
) => {
  const jwtVc = jwtDecode(credential);
  expect(jwtVc).toEqual(
    jwtVcExpectation(
      {
        issuerEntity,
        offer,
        credentialId: jwtVc.payload.jti,
        userId,
      },
      context,
    ),
  );
  expect(jwtVc.payload.jti).toEqual(
    `did:velocity:v2:${toLower(issuerEntity.primaryAddress)}:${
      credentialMetadataArgs[0].listId
    }:${credentialMetadataArgs[0].index}:${hashOffer(offer)}`,
  );
  expect(jwtVc.header.kid).toEqual(
    `did:velocity:v2:${toLower(issuerEntity.primaryAddress)}:${
      credentialMetadataArgs[0].listId
    }:${credentialMetadataArgs[0].index}:${hashOffer(offer)}#key-1`,
  );
  expect(credentialMetadataArgs).toEqual([
    expect.objectContaining({
      credentialType: extractOfferType(offer),
      publicKey: publicJwkMatcher(
        credentialTypeMetadata[extractOfferType(offer)]
          .defaultSignatureAlgorithm ?? KeyAlgorithms.SECP256K1,
      ),
      listId: expect.any(Number),
      index: expect.any(Number),
    }),
    hashOffer(offer),
    caoEntity.did,
    ALG_TYPE[
      calcAlgTypeName({
        ...credentialTypeMetadata[extractOfferType(offer)],
        defaultSignatureAlgorithm:
          credentialTypeMetadata[extractOfferType(offer)]
            .defaultSignatureAlgorithm ?? KeyAlgorithms.SECP256K1,
      })
    ],
  ]);

  const { publicKey } = first(credentialMetadataArgs);
  await jwtVerify(credential, publicKey, false);
};
