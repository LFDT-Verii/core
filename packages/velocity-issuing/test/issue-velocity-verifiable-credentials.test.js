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
const console = require('console');
const { toLower } = require('lodash/fp');
const { MongoClient } = require('mongodb');
const { publicJwkMatcher } = require('@verii/tests-helpers');
const initRequest = require('@verii/request');
const { jwtDecode, jwtVerify, jwtSign } = require('@verii/jwt');
const { first, map } = require('lodash/fp');
const { nanoid } = require('nanoid');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const { ALG_TYPE } = require('@verii/metadata-registration');
const { KeyAlgorithms } = require('@verii/crypto');
const { hashOffer } = require('../src/domain/hash-offer');
const {
  issueVelocityVerifiableCredentials,
} = require('../src/issue-velocity-verifiable-credentials');
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

const METADATA_LIST_CONTRACT_ADDRESS = '0xabcdef';

const mockAddCredentialMetadataEntry = jest.fn();
const mockCreateCredentialMetadataList = jest.fn();
const mockAddRevocationListSigned = jest.fn();

jest.mock('@verii/metadata-registration', () => ({
  ...jest.requireActual('@verii/metadata-registration'),
  initRevocationRegistry: () => ({
    addRevocationListSigned: mockAddRevocationListSigned,
  }),
  initMetadataRegistry: () => ({
    addCredentialMetadataEntry: mockAddCredentialMetadataEntry,
    createCredentialMetadataList: mockCreateCredentialMetadataList,
  }),
}));

describe('issuing velocity verifiable credentials', () => {
  const mongoClient = new MongoClient('mongodb://localhost:27017/');

  let allocationsCollection;
  let issuer;
  let issuerEntity;
  let caoEntity;
  let context;

  beforeAll(async () => {
    allocationsCollection = await collectionClient({
      mongoClient,
      name: 'allocations',
    });
    issuerEntity = entityFactory({ service: [{ id: '#issuer-1' }] });
    caoEntity = entityFactory({ service: [{ id: '#cao-1' }] });
    issuer = {
      id: nanoid(),
      did: issuerEntity.did,
      issuingServiceId: issuerEntity.service[1]?.id,
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
    jest.resetAllMocks();
    mockAddCredentialMetadataEntry.mockResolvedValue(true);
    mockCreateCredentialMetadataList.mockResolvedValue(true);
    context = buildContext({
      issuerEntity,
      caoEntity,
      allocationListQueries: mongoAllocationListQueries(
        mongoClient.db('test-collections'),
        'allocations'
      ),
    });
  });

  afterAll(() => {
    mongoClient.close();
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
    const credentials = await issueVelocityVerifiableCredentials(
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
        mockAddCredentialMetadataEntry.mock.calls[i],
        { issuerEntity, caoEntity, offer: offers[i], userId }
      );
    }
    await verifyCreateMetadataListCalledOnce(
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[0][0].listId,
      mockCreateCredentialMetadataList,
      { issuerEntity, caoEntity }
    );

    expect(mockAddRevocationListSigned.mock.calls).toEqual([
      [expect.any(Number), caoEntity.did],
    ]);
  });

  it('should create vcs with context in credentialSubject', async () => {
    context.config.credentialSubjectContext = true;

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
    const credentials = await issueVelocityVerifiableCredentials(
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
        mockAddCredentialMetadataEntry.mock.calls[i],
        { issuerEntity, caoEntity, offer: offers[i], userId },
        context
      );
    }
    await verifyCreateMetadataListCalledOnce(
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[0][0].listId,
      mockCreateCredentialMetadataList,
      { issuerEntity, caoEntity }
    );

    expect(mockAddRevocationListSigned.mock.calls).toEqual([
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

    const credentials = await issueVelocityVerifiableCredentials(
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
        mockAddCredentialMetadataEntry.mock.calls[i],
        { issuerEntity, caoEntity, offer: offers[i], userId }
      );
    }
    await verifyCreateMetadataListCalledOnce(
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[0][0].listId,
      mockCreateCredentialMetadataList,
      { caoEntity, issuerEntity }
    );
    expect(mockAddRevocationListSigned.mock.calls).toEqual([
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

    const credentials = await issueVelocityVerifiableCredentials(
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
        mockAddCredentialMetadataEntry.mock.calls[i],
        { issuerEntity, caoEntity, offer: offers[i], userId }
      );
    }
    await verifyCreateMetadataListCalledOnce(
      issuer,
      mockAddCredentialMetadataEntry.mock.calls[0][0].listId,
      mockCreateCredentialMetadataList,
      { caoEntity, issuerEntity }
    );
    expect(mockAddRevocationListSigned.mock.calls).toEqual([
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
  registrarFetch: initRequest({
    prefixUrl: 'http://oracle.localhost.test',
  })({ log: console }),
  ...args,
});

const verifyCreateMetadataListCalledOnce = async (
  issuer,
  listId,
  mock,
  { issuerEntity, caoEntity }
) => {
  expect(mock).toHaveBeenCalledTimes(1);
  const args = mock.mock.calls[0];
  expect(args).toEqual([
    issuer.dltPrimaryAddress,
    listId,
    expect.any(String),
    caoEntity.did,
    ALG_TYPE.COSEKEY_AES_256,
  ]);

  const issuerAttestationJwtVc = args[2];
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
  credentialMetadataCall,
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
      credentialMetadataCall[0].listId
    }:${credentialMetadataCall[0].index}:${hashOffer(offer)}`
  );
  expect(jwtVc.header.kid).toEqual(
    `did:velocity:v2:${toLower(issuerEntity.primaryAddress)}:${
      credentialMetadataCall[0].listId
    }:${credentialMetadataCall[0].index}:${hashOffer(offer)}#key-1`
  );
  expect(credentialMetadataCall).toEqual([
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
    ALG_TYPE.COSEKEY_AES_256,
  ]);

  const { publicKey } = first(credentialMetadataCall);
  await jwtVerify(credential, publicKey, false);
};
