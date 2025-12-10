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

mock.module('@verii/metadata-registration', {
  namedExports: {
    ALG_TYPE,
    initRevocationRegistry: () => ({
      addRevocationListSigned: mockAddRevocationListSigned,
    }),
    initMetadataRegistry: () => ({
      addCredentialMetadataEntry: mockAddCredentialMetadataEntry,
      createCredentialMetadataList: mockCreateCredentialMetadataList,
    }),
  },
});

mockAddCredentialMetadataEntry.mock.mockImplementation(() =>
  Promise.resolve(true)
);
mockCreateCredentialMetadataList.mock.mockImplementation(() =>
  Promise.resolve(true)
);

const { KeyAlgorithms } = require('@verii/crypto');
const { jwtDecode, jwtVerify, jwtSign } = require('@verii/jwt');
const { publicJwkMatcher } = require('@verii/tests-helpers');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const { toLower } = require('lodash/fp');
const { MongoClient } = require('mongodb');
const { first, map } = require('lodash/fp');
const { nanoid } = require('nanoid');
const { hashOffer } = require('../src/domain/hash-offer');
const { issueVeriiCredentials } = require('../src/issue-verii-credentials');
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

describe('issuing velocity verifiable credentials', () => {
  const mongoClient = new MongoClient('mongodb://localhost:27017/');

  let allocationsCollection;
  let issuer;
  let issuerEntity;
  let caoEntity;
  let context;

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
    context = buildContext({
      issuerEntity,
      caoEntity,
      allocationListQueries: mongoAllocationListQueries(
        mongoClient.db('test-collections'),
        'allocations'
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
    const credentials = await issueVeriiCredentials(
      offers,
      userId,
      credentialTypesMap,
      issuer,
      context
    );

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
        }
      );
    }
    expect(mockCreateCredentialMetadataList.mock.callCount()).toEqual(2);
    await verifyCreateMetadataListCall(
      mockCreateCredentialMetadataList.mock.calls[0],
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[0].arguments[0].listId,
      ALG_TYPE.HEX_AES_256,
      { issuerEntity, caoEntity }
    );
    await verifyCreateMetadataListCall(
      mockCreateCredentialMetadataList.mock.calls[1],
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[2].arguments[0].listId,
      ALG_TYPE.COSEKEY_AES_256,
      { issuerEntity, caoEntity }
    );

    expect(map('arguments', mockAddRevocationListSigned.mock.calls)).toEqual([
      [expect.any(Number), caoEntity.did],
    ]);
  });

  it('should create vcs with context in credentialSubject (allocation lists exists)', async () => {
    context.config.credentialSubjectContext = true;
    allocationsCollection.insertOne({
      tenantId: issuer.id,
      entityName: 'HEX_AES_256_MetadataListAllocations',
      freeIndexes: [1, 2],
      currentListId: 999,
      operatorAddress: issuerEntity.primaryAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    allocationsCollection.insertOne({
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
    const credentials = await issueVeriiCredentials(
      offers,
      userId,
      credentialTypesMap,
      issuer,
      context
    );

    expect(credentials.length).toEqual(3);
    for (let i = 0; i < credentials.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await verifyCredentialAndAddEntryExpectations(
        credentials[i],
        mockAddCredentialMetadataEntry.mock.calls[i].arguments,
        { issuerEntity, caoEntity, offer: offers[i], userId },
        context
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

    const credentials = await issueVeriiCredentials(
      offers,
      userId,
      credentialTypesMap,
      issuer,
      context
    );

    expect(credentials).toEqual([expect.any(String)]);
    for (let i = 0; i < credentials.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await verifyCredentialAndAddEntryExpectations(
        credentials[i],
        mockAddCredentialMetadataEntry.mock.calls[i].arguments,
        { issuerEntity, caoEntity, offer: offers[i], userId }
      );
    }

    expect(mockCreateCredentialMetadataList.mock.callCount()).toEqual(1);
    await verifyCreateMetadataListCall(
      mockCreateCredentialMetadataList.mock.calls[0],
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[0].arguments[0].listId,
      ALG_TYPE.HEX_AES_256,
      { issuerEntity, caoEntity }
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

    const credentials = await issueVeriiCredentials(
      offers,
      userId,
      credentialTypesMap,
      issuer,
      context
    );

    expect(credentials).toEqual([expect.any(String)]);
    for (let i = 0; i < credentials.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await verifyCredentialAndAddEntryExpectations(
        credentials[i],
        mockAddCredentialMetadataEntry.mock.calls[i].arguments,
        { issuerEntity, caoEntity, offer: offers[i], userId }
      );
    }

    expect(mockCreateCredentialMetadataList.mock.callCount()).toEqual(1);
    await verifyCreateMetadataListCall(
      mockCreateCredentialMetadataList.mock.calls[0],
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[0].arguments[0].listId,
      ALG_TYPE.HEX_AES_256,
      { issuerEntity, caoEntity }
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
  },
  ...args,
});

const verifyCreateMetadataListCall = async (
  call,
  issuer,
  listId,
  algType,
  { issuerEntity, caoEntity }
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
    issuerEntity.keyPair.publicKey
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
  context
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
      context
    )
  );
  expect(jwtVc.payload.jti).toEqual(
    `did:velocity:v2:${toLower(issuerEntity.primaryAddress)}:${
      credentialMetadataArgs[0].listId
    }:${credentialMetadataArgs[0].index}:${hashOffer(offer)}`
  );
  expect(jwtVc.header.kid).toEqual(
    `did:velocity:v2:${toLower(issuerEntity.primaryAddress)}:${
      credentialMetadataArgs[0].listId
    }:${credentialMetadataArgs[0].index}:${hashOffer(offer)}#key-1`
  );
  expect(credentialMetadataArgs).toEqual([
    expect.objectContaining({
      credentialType: extractOfferType(offer),
      publicKey: publicJwkMatcher(
        credentialTypeMetadata[extractOfferType(offer)]
          .defaultSignatureAlgorithm ?? KeyAlgorithms.SECP256K1
      ),
      listId: expect.any(Number),
      index: expect.any(Number),
    }),
    hashOffer(offer),
    caoEntity.did,
    ALG_TYPE[calcAlgTypeName(credentialTypeMetadata[extractOfferType(offer)])],
  ]);

  const { publicKey } = first(credentialMetadataArgs);
  await jwtVerify(credential, publicKey, false);
};
