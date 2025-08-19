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
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const { nanoid } = require('nanoid');

const mockInitSendError = mock.fn(() =>
  Promise.resolve({
    sendError: (err) => {
      console.log(`fake capturing exception: ${err.message}`);
    },
    startProfiling: () => {
      console.log('fake start sentry profiling');
    },
    finishProfiling: () => {
      console.log('fake finish sentry profiling');
    },
  })
);

mock.module('@verii/error-aggregation', {
  namedExports: {
    initSendError: mockInitSendError,
  },
});

const mockAuth0ClientDelete = mock.fn(async ({ id }) => {
  console.log(`deleting auth0 client ${id}`);
});
const mockAuth0ClientGrantDelete = mock.fn(async ({ id }) => {
  console.log(`deleting auth0 client grant ${id}`);
});
const mockAuth0ClientCreate = mock.fn(async (obj) => {
  const id = nanoid();
  console.log(`create auth0 client ${id}`);
  return { data: { client_id: id, client_secret: nanoid(), ...obj } };
});
const mockAuth0ClientGrantCreate = mock.fn(async (obj) => {
  const id = nanoid();
  console.log(`create auth0 clientGrant ${id}`);
  return { data: { id: nanoid(), ...obj } };
});
const mockAuth0UserUpdate = mock.fn(async ({ id }, obj) => {
  console.log(`update auth0 user ${id}`);
  return { data: { id, ...obj } };
});
const mockAuth0GetUsers = mock.fn(() =>
  Promise.resolve({
    data: {
      email: `${mockAuth0GetUsers.mock.callCount()}@localhost.test`,
    },
  })
);

class ManagementClient {
  constructor() {
    this.clients = {
      create: mockAuth0ClientCreate,
      delete: mockAuth0ClientDelete,
    };
    this.clientGrants = {
      create: mockAuth0ClientGrantCreate,
      delete: mockAuth0ClientGrantDelete,
    };
    this.users = {
      update: mockAuth0UserUpdate,
    };
    this.getUsers = mockAuth0GetUsers;
  }
}
mock.module('auth0', {
  namedExports: {
    ManagementClient,
  },
});

const mockAddPrimary = mock.fn(() => Promise.resolve(undefined));
const mockAddOperator = mock.fn(() => Promise.resolve(undefined));
const mockRemoveOperator = mock.fn(() => Promise.resolve(undefined));
const mockInitPermission = mock.fn(() =>
  Promise.resolve({
    addPrimary: mockAddPrimary,
    addOperatorKey: mockAddOperator,
    removeOperatorKey: mockRemoveOperator,
  })
);
mock.module('@verii/contract-permissions', {
  namedExports: {
    ...require('../../contract-permissions/src/constants'),
    initPermissions: mockInitPermission,
  },
});

const mockCreateFineractClient = mock.fn();
const mockCreateStakesAccount = mock.fn();
mock.module('@verii/fineract-client', {
  namedExports: {
    createFineractClient: mockCreateFineractClient,
    createStakesAccount: mockCreateStakesAccount,
  },
});

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const {
  KeyPurposes,
  generateKeyPair,
  KeyAlgorithms,
} = require('@verii/crypto');
const { hexFromJwk } = require('@verii/jwt');

const {
  generateOrganizationKeyMatcher,
  publicJwkMatcher,
  testWriteOrganizationsUser,
  testReadOrganizationsUser,
  errorResponseMatcher,
  DEFAULT_GROUP_ID,
  testNoGroupRegistrarUser,
} = require('@verii/tests-helpers');
const { ServiceTypes } = require('@verii/organizations-registry');
const { ObjectId } = require('mongodb');

const console = require('console');

const nock = require('nock');
const buildFastify = require('./helpers/build-fastify');
const { mapResponseKeyToDbKey } = require('./helpers/map-response-key-to-db');
const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');
const initOrganizationKeysFactory = require('../src/entities/organization-keys/factories/organization-keys-factory');
const initGroupsFactory = require('../src/entities/groups/factories/groups-factory');
const organizationKeysRepoPlugin = require('../src/entities/organization-keys/repos/repo');
const organizationsRepoPlugin = require('../src/entities/organizations/repos/repo');

const {
  OrganizationErrorMessages: entityErrorMessages,
  KeyErrorMessages,
} = require('../src/entities');

const baseUrl = '/api/v0.6/organizations';

describe('Organization Keys Test Suite', () => {
  let fastify;
  let organizationsRepo;
  let persistOrganization;
  let persistGroup;
  let persistOrganizationKey;
  let newOrganizationKey;
  let organizationKeysRepo;

  const getOrganizationFromDb = (did) =>
    mongoDb().collection('organizations').findOne({
      'didDoc.id': did,
    });

  const clearDb = async () => {
    await mongoDb().collection('organizations').deleteMany({});
    await mongoDb().collection('organizationKeys').deleteMany({});
    await mongoDb().collection('kms').deleteMany({});
    await mongoDb().collection('groups').deleteMany({});
  };

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistOrganization } = initOrganizationFactory(fastify));

    ({ persistGroup } = initGroupsFactory(fastify));

    organizationsRepo = organizationsRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });

    ({ newOrganizationKey, persistOrganizationKey } =
      initOrganizationKeysFactory(fastify));

    organizationKeysRepo = organizationKeysRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });

    ({ newOrganizationKey, persistOrganizationKey } =
      initOrganizationKeysFactory(fastify));

    organizationKeysRepo = organizationKeysRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });

    await mongoDb()
      .collection('credentialSchemas')
      .insertMany([
        { credentialType: 'EducationDegree' },
        { credentialType: 'PastEmploymentPosition' },
      ]);
  }, 10000);

  beforeEach(async () => {
    mockCreateStakesAccount.mock.resetCalls();
    mockCreateStakesAccount.mock.mockImplementation(() =>
      Promise.resolve('foo')
    );
    mockRemoveOperator.mock.resetCalls();
    nock.cleanAll();
  });

  after(async () => {
    await mongoDb().collection('credentialSchemas').deleteMany({});
    await fastify.close();
    nock.cleanAll();
    nock.restore();
    mock.reset();
  });

  describe('Organization Modifications', () => {
    beforeEach(async () => {
      await clearDb();
    });

    describe('Organization Key Addition', () => {
      it('Should return 404 when organization not found', async () => {
        const organizationKey = await newOrganizationKey();
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/did:test:notfound/keys`,
          payload: {
            kidFragment: '#fragment-1',
            algorithm: 'SECP256K1',
            purposes: organizationKey.purposes,
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 403 if user is missing organization:write permission', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [did],
        });

        const payload = {
          kidFragment: '#fragment-1',
          algorithm: 'SECP256K1',
          purposes: [KeyPurposes.ISSUING_METADATA],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('Should return 404 if user has no group', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [did],
        });

        const payload = {
          kidFragment: '#fragment-1',
          algorithm: 'SECP256K1',
          purposes: [KeyPurposes.ISSUING_METADATA],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 404 if user is a member of another group', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;
        await persistGroup({
          groupId: did,
          dids: [did],
        });

        const payload = {
          kidFragment: '#fragment-1',
          algorithm: 'SECP256K1',
          purposes: [KeyPurposes.ISSUING_METADATA],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 400 when fragment does not begin with a hash', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;
        const organizationKey = await newOrganizationKey();
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment: 'fragment-1',
            algorithm: 'SECP256K1',
            purposes: organizationKey.purposes,
          },
        });

        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            statusCode: 400,
            error: 'Bad Request',
            message:
              'body/kidFragment must match pattern "^#[a-zA-Z0-9-_:?=&;]+$"',
          },
        });
      });

      it('Should return 400 when provided algorithm is unsupported', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;
        const organizationKey = await newOrganizationKey();
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment: '#fragment-1',
            algorithm: 'unsupported',
            purposes: organizationKey.purposes,
          },
        });

        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            statusCode: 400,
            error: 'Bad Request',
            message:
              'body/algorithm must be equal to one of the allowed values',
          },
        });
      });

      it('Should return 400 when purposes array is empty', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment: '#fragment-1',
            algorithm: 'SECP256K1',
            purposes: [],
          },
        });

        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/purposes must NOT have fewer than 1 items',
          },
        });
      });

      it('Should return 400 when an unrecognized purpose is provided', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment: '#fragment-1',
            algorithm: 'SECP256K1',
            purposes: ['unrecognized'],
          },
        });

        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            statusCode: 400,
            error: 'Bad Request',
            message: KeyErrorMessages.UNRECOGNIZED_PURPOSE_DETECTED,
          },
        });
      });

      it('Should return 400 when duplicate purposes are provided', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;

        const organizationKey = await newOrganizationKey();
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment: '#fragment-1',
            algorithm: 'SECP256K1',
            purposes: [
              ...organizationKey.purposes,
              organizationKey.purposes[0],
            ],
          },
        });

        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            statusCode: 400,
            error: 'Bad Request',
            message: KeyErrorMessages.DUPLICATE_PURPOSE_DETECTED,
          },
        });
      });

      it('Should return 400 when actual publicKey encoding does not match the specified encoding', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;
        const { publicKey } = generateKeyPair();
        const nonHexPublicKey = publicKey.replace(/.$/, 'g');
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment: '#fragment-1',
            algorithm: 'SECP256K1',
            purposes: [KeyPurposes.ISSUING_METADATA],
            encoding: 'hex',
            publicKey: nonHexPublicKey,
          },
        });

        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            statusCode: 400,
            error: 'Bad Request',
            message:
              KeyErrorMessages.PUBLIC_KEY_ENCODING_DOES_NOT_MATCH_SPECIFIED_ENCODING,
          },
        });
      });

      it('Should return 409 when a provided kidFragment is present on already existing key', async () => {
        const organization = await persistOrganization();
        const kidFragment = '#fragment-1';
        await persistOrganizationKey({
          organization,
          id: kidFragment,
          purposes: [KeyPurposes.ISSUING_METADATA],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment: '#fragment-1',
            algorithm: 'SECP256K1',
            purposes: [KeyPurposes.DLT_TRANSACTIONS],
          },
        });

        expect(response).toMatchObject({
          statusCode: 409,
          json: {
            statusCode: 409,
            error: 'Conflict',
            message:
              KeyErrorMessages.KEY_WITH_ID_FRAGMENT_ALREADY_EXISTS_TEMPLATE({
                kidFragment,
              }),
          },
        });
      });

      it('Should return 409 when a publicKey is present on an already existing key', async () => {
        const organization = await persistOrganization();
        const purposes = [KeyPurposes.ISSUING_METADATA];
        const organizationKey = await persistOrganizationKey({
          organization,
          purposes,
        });
        const { publicKey } = organizationKey;
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment: '#fragment-1',
            algorithm: 'SECP256K1',
            purposes: [KeyPurposes.EXCHANGES],
            encoding: organizationKey.encoding,
            publicKey: hexFromJwk(publicKey, false),
          },
        });

        expect(response).toMatchObject({
          statusCode: 409,
          json: {
            statusCode: 409,
            error: 'Conflict',
            message: KeyErrorMessages.PUBLIC_KEY_ALREADY_EXISTS_TEMPLATE({
              publicKey,
            }),
          },
        });
      });

      it('Should return 409 when a provided kidFragment is present on already existing key', async () => {
        const organization = await persistOrganization();
        const kidFragment = '#fragment-1';
        await persistOrganizationKey({
          organization,
          id: kidFragment,
          purposes: [KeyPurposes.ISSUING_METADATA],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment: '#fragment-1',
            algorithm: 'SECP256K1',
            purposes: [KeyPurposes.DLT_TRANSACTIONS],
          },
        });

        expect(response).toMatchObject({
          statusCode: 409,
          json: {
            statusCode: 409,
            error: 'Conflict',
            message:
              KeyErrorMessages.KEY_WITH_ID_FRAGMENT_ALREADY_EXISTS_TEMPLATE({
                kidFragment,
              }),
          },
        });
      });

      it('Should return 201 and add key if user is not a group clientAdmin', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [did],
        });

        const payload = {
          kidFragment: '#fragment-1',
          algorithm: 'SECP256K1',
          purposes: [KeyPurposes.ISSUING_METADATA],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);
      });

      it('Should add a new generated organization key', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;
        const purpose = KeyPurposes.ISSUING_METADATA;
        const kidFragment = '#fragment-1';
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment,
            algorithm: 'SECP256K1',
            purposes: [purpose],
          },
        });

        expect(response).toMatchObject({
          statusCode: 201,
          json: {
            key: generateOrganizationKeyMatcher({
              kid: kidFragment,
              purpose,
              withKidFragment: true,
            }),
          },
        });

        const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
        expect(orgFromDb).toMatchObject({
          didDoc: {
            verificationMethod: [
              ...organization.didDoc.verificationMethod,
              {
                id: kidFragment,
                controller: organization.didDoc.id,
                type: 'JsonWebKey2020',
                publicKeyJwk: publicJwkMatcher(),
              },
            ],
          },
        });

        const orgKeyFromDb = await mongoDb()
          .collection('organizationKeys')
          .findOne({
            organizationId: orgFromDb._id,
          });
        expect(orgKeyFromDb).toMatchObject({
          ...generateOrganizationKeyMatcher({
            kid: kidFragment,
            purpose,
          }),
        });
      });

      it('Should allow a new generated organization key with a purpose already associated with a key', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;

        const [organizationKey1, organizationKey2] = await Promise.all([
          newOrganizationKey(),
          newOrganizationKey(),
        ]);

        await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment: '#fragment-1',
            algorithm: 'SECP256K1',
            purposes: [KeyPurposes.ISSUING_METADATA],
            encoding: organizationKey1.encoding,
            publicKey: hexFromJwk(organizationKey1.publicKey, false),
          },
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment: '#fragment-2',
            algorithm: 'SECP256K1',
            purposes: [KeyPurposes.ISSUING_METADATA],
            encoding: organizationKey2.encoding,
            publicKey: hexFromJwk(organizationKey2.publicKey, false),
          },
        });

        expect(response).toMatchObject({
          statusCode: 201,
          json: {
            key: generateOrganizationKeyMatcher({
              kid: '#fragment-2',
              purpose: KeyPurposes.ISSUING_METADATA,
              publicKey: hexFromJwk(organizationKey2.publicKey, false),
              withKidFragment: true,
            }),
          },
        });

        const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
        expect(orgFromDb).toMatchObject({
          didDoc: {
            verificationMethod: [
              ...organization.didDoc.verificationMethod,
              {
                id: '#fragment-1',
                controller: organization.didDoc.id,
                type: 'JsonWebKey2020',
                publicKeyJwk: publicJwkMatcher(),
              },
              {
                id: '#fragment-2',
                controller: organization.didDoc.id,
                type: 'JsonWebKey2020',
                publicKeyJwk: publicJwkMatcher(),
              },
            ],
          },
        });

        const orgKeyFromDb = await mongoDb()
          .collection('organizationKeys')
          .findOne({
            organizationId: orgFromDb._id,
            id: '#fragment-2',
          });

        expect(orgKeyFromDb).toMatchObject({
          ...generateOrganizationKeyMatcher({
            kid: '#fragment-2',
            purpose: KeyPurposes.ISSUING_METADATA,
            publicKey: organizationKey2.publicKey,
          }),
        });
      });

      it('Should add an existing organization key', async () => {
        const organization = await persistOrganization();
        const purpose = KeyPurposes.ISSUING_METADATA;
        const purposes = [purpose];
        const organizationKey = await newOrganizationKey({
          organization,
          purposes,
        });
        const hexPublicKey = hexFromJwk(organizationKey.publicKey, false);
        const did = organization.didDoc.id;
        const kidFragment = '#fragment-1';
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment,
            purposes,
            encoding: 'hex',
            publicKey: hexPublicKey,
          },
        });

        expect(response).toMatchObject({
          statusCode: 201,
          json: {
            key: generateOrganizationKeyMatcher({
              kid: kidFragment,
              purpose,
              publicKey: hexPublicKey,
              withKidFragment: true,
            }),
          },
        });

        const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
        expect(orgFromDb).toMatchObject({
          didDoc: {
            verificationMethod: [
              ...organization.didDoc.verificationMethod,
              {
                id: kidFragment,
                controller: organization.didDoc.id,
                type: 'JsonWebKey2020',
                publicKeyJwk: publicJwkMatcher(),
              },
            ],
          },
        });

        const orgKeyFromDb = await mongoDb()
          .collection('organizationKeys')
          .findOne({
            organizationId: orgFromDb._id,
          });

        expect(orgKeyFromDb).toMatchObject(
          generateOrganizationKeyMatcher({
            kid: kidFragment,
            purpose,
            publicKey: organizationKey.publicKey,
          })
        );
      });

      it('Should add a new generated organization key with default algorithm if no algorithm is specified', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;
        const purpose = KeyPurposes.EXCHANGES;
        const kidFragment = '#fragment-1';
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment,
            purposes: [purpose],
          },
        });

        expect(response).toMatchObject({
          statusCode: 201,
          json: {
            key: generateOrganizationKeyMatcher({
              kid: kidFragment,
              purpose,
              withKidFragment: true,
            }),
          },
        });
      });

      it('Should add a new generated organization key with default kidFragment if no kidFragment is specified', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;
        const purpose = KeyPurposes.EXCHANGES;
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            purposes: [purpose],
            custodied: true,
          },
        });

        const {
          key: { kidFragment },
        } = response.json;
        expect(kidFragment).toEqual(expect.stringMatching(/#exchanges-\d*/));

        expect(response).toMatchObject({
          statusCode: 201,
          json: {
            key: generateOrganizationKeyMatcher({
              kid: kidFragment,
              purpose,
              custodied: true,
              withKidFragment: true,
            }),
          },
        });
      });

      it('Should add a new organization key not a DLT_TRANSACTION purpose', async () => {
        const organization = await persistOrganization();
        await persistOrganizationKey({
          organization,
          id: '#vnf-permissioning-id',
          purposes: [KeyPurposes.PERMISSIONING],
        });

        await persistOrganizationKey({
          organization,
          id: '#secret-key-id',
          purposes: [KeyPurposes.DLT_TRANSACTIONS],
        });

        const did = organization.didDoc.id;
        const purpose = KeyPurposes.ISSUING_METADATA;
        const kidFragment = '#fragment-1';
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment,
            purposes: [purpose],
          },
        });

        expect(mockInitPermission.mock.callCount()).toEqual(0);
        expect(mockAddOperator.mock.callCount()).toEqual(0);

        expect(response).toMatchObject({
          statusCode: 201,
          json: {
            key: generateOrganizationKeyMatcher({
              kid: kidFragment,
              purpose,
              withKidFragment: true,
            }),
          },
        });
      });

      it('Should add a new organization key with DLT_TRANSACTION purpose to the blockchain', async () => {
        const organization = await persistOrganization();
        await persistOrganizationKey({
          organization,
          id: '#vnf-permissioning-id',
          purposes: [KeyPurposes.PERMISSIONING],
        });

        await persistOrganizationKey({
          organization,
          id: '#secret-key-id',
          purposes: [KeyPurposes.DLT_TRANSACTIONS],
        });

        const did = organization.didDoc.id;
        const purpose = KeyPurposes.DLT_TRANSACTIONS;
        const kidFragment = '#fragment-1';
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment,
            purposes: [purpose],
          },
        });

        expect(response).toMatchObject({
          statusCode: 201,
          json: {
            key: generateOrganizationKeyMatcher({
              kid: response.json.key.kidFragment,
              purpose,
              withKidFragment: true,
            }),
          },
        });
      });
    });

    describe('Organization Key Removal', () => {
      it('Should return 404 when organization not found', async () => {
        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/did:test:notfound/keys/secret-id`,
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json.message).toEqual(
          entityErrorMessages.ORGANIZATION_NOT_FOUND
        );
      });

      it('Should return 404 when organization key not found', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}/keys/keyid`,
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 403 if user is missing organization:write permission', async () => {
        const organization = await persistOrganization({
          keySpecs: [
            {
              id: '#secret-key-id',
              purposes: [KeyPurposes.EXCHANGES],
            },
          ],
        });
        const did = organization.didDoc.id;
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [did],
        });

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}/keys/secret-key-id`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('Should return 404 if user has no group', async () => {
        const organization = await persistOrganization({
          keySpecs: [
            {
              id: '#secret-key-id',
              purposes: [KeyPurposes.EXCHANGES],
            },
          ],
        });
        const did = organization.didDoc.id;
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [did],
        });

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}/keys/secret-key-id`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 404 if user is a member of another group', async () => {
        const organization = await persistOrganization({
          keySpecs: [
            {
              id: '#secret-key-id',
              purposes: [KeyPurposes.EXCHANGES],
            },
          ],
        });
        const did = organization.didDoc.id;
        await persistGroup({
          groupId: did,
          dids: [did],
        });

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}/keys/secret-key-id`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should 400 if key is ISSUING_METADATA purpose', async () => {
        const organization = await persistOrganization({
          keys: [
            {
              id: '#eth-account-key-1',
              purposes: [KeyPurposes.DLT_TRANSACTIONS],
              type: 'EcdsaSecp256k1VerificationKey2019',
              publicKey: generateKeyPair({ format: 'jwk' }).publicKey,
              algorithm: KeyAlgorithms.SECP256K1,
            },
            {
              id: '#secret-key-id',
              purposes: [KeyPurposes.ISSUING_METADATA],
              type: 'EcdsaSecp256k1VerificationKey2019',
              publicKey: generateKeyPair({ format: 'jwk' }).publicKey,
              algorithm: KeyAlgorithms.SECP256K1,
            },
          ],
        });
        const keyDatum = await persistOrganizationKey({
          organization,
          id: '#secret-key-id',
          purposes: [KeyPurposes.ISSUING_METADATA],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}/keys/secret-key-id`,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            statusCode: 400,
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'ISSUING_METADATA Key may not be removed',
          })
        );

        expect(mockRemoveOperator.mock.callCount()).toEqual(0);

        const updatedOrganizationKeys = await organizationKeysRepo.find({
          filter: { organizationId: new ObjectId(organization._id) },
          sort: {
            id: -1,
          },
        });

        expect(updatedOrganizationKeys.length).toEqual(1);
        expect(updatedOrganizationKeys[0].id).toEqual(keyDatum.id);

        const updatedOrganization = await organizationsRepo.findOne({
          _id: organization._id,
        });

        expect(updatedOrganization.didDoc).toEqual({
          '@context': expect.any(Array),
          service: [],
          id: organization.didDoc.id,
          verificationMethod: [
            expect.objectContaining({ id: '#eth-account-key-1' }),
            expect.objectContaining({ id: '#secret-key-id' }),
          ],
          assertionMethod: ['#eth-account-key-1', '#secret-key-id'],
        });
      });

      it('Should 204 and delete DLT_TRANSACTIONS key from didDoc, db, and blockchain operators map', async () => {
        const organization = await persistOrganization({
          keys: [
            {
              id: '#eth-account-key-1',
              purposes: [KeyPurposes.DLT_TRANSACTIONS],
              type: 'EcdsaSecp256k1VerificationKey2019',
              publicKey: generateKeyPair({ format: 'jwk' }).publicKey,
              algorithm: KeyAlgorithms.SECP256K1,
            },
            {
              id: '#secret-key-id',
              purposes: [KeyPurposes.ISSUING_METADATA],
              type: 'EcdsaSecp256k1VerificationKey2019',
              publicKey: generateKeyPair({ format: 'jwk' }).publicKey,
              algorithm: KeyAlgorithms.SECP256K1,
            },
          ],
        });
        const did = organization.didDoc.id;

        const removedKey = await persistOrganizationKey({
          organization,
          id: '#secret-key-id',
          purposes: [KeyPurposes.DLT_TRANSACTIONS],
        });

        await persistOrganizationKey({
          organization,
          id: '#secret-key-2-id',
          purposes: [KeyPurposes.ISSUING_METADATA],
        });

        await persistOrganizationKey({
          organization,
          id: '#secret-key-3-id',
          purposes: [KeyPurposes.PERMISSIONING],
        });

        const organizationKeys = await organizationKeysRepo.find({
          filter: { organizationId: new ObjectId(organization._id) },
          sort: {
            id: -1,
          },
        });

        expect(organizationKeys.length).toEqual(3);

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}/keys/secret-key-id`,
        });

        expect(response.statusCode).toEqual(204);

        expect(mockRemoveOperator.mock.callCount()).toEqual(1);
        expect(
          mockRemoveOperator.mock.calls.map((call) => call.arguments)
        ).toContainEqual([
          {
            operator: toEthereumAddress(
              hexFromJwk(removedKey.publicKey, false)
            ),
            primary: organization.ids.ethereumAccount,
          },
        ]);

        const updatedOrganizationKeys = await organizationKeysRepo.find({
          filter: { organizationId: new ObjectId(organization._id) },
          sort: {
            id: -1,
          },
        });

        expect(updatedOrganizationKeys.length).toEqual(2);
        expect(updatedOrganizationKeys[0].id).not.toEqual(removedKey.id);
        expect(updatedOrganizationKeys[1].id).not.toEqual(removedKey.id);

        const updatedOrganization = await organizationsRepo.findOne({
          _id: organization._id,
        });

        expect(organization.didDoc).toEqual({
          '@context': expect.any(Array),
          service: [],
          id: expect.any(String),
          verificationMethod: [
            expect.objectContaining({ id: '#eth-account-key-1' }),
            expect.objectContaining({ id: removedKey.id }),
          ],
          assertionMethod: ['#eth-account-key-1', removedKey.id],
        });

        expect(updatedOrganization.didDoc).toEqual({
          '@context': expect.any(Array),
          service: [],
          id: organization.didDoc.id,
          verificationMethod: [
            expect.objectContaining({ id: '#eth-account-key-1' }),
          ],
          assertionMethod: ['#eth-account-key-1'],
        });
      });
      it('Should 204 and delete EXCHANGES key from didDoc, db, but not blockchain operators map', async () => {
        const organization = await persistOrganization({
          keySpecs: [
            {
              id: '#eth-account-key-1',
              purposes: [KeyPurposes.DLT_TRANSACTIONS],
            },
            {
              id: '#secret-key-id',
              purposes: [KeyPurposes.EXCHANGES],
            },
          ],
        });
        const did = organization.didDoc.id;

        const exchangeKey = await persistOrganizationKey({
          organization,
          id: '#secret-key-id',
          purposes: [KeyPurposes.EXCHANGES],
        });

        await persistOrganizationKey({
          organization,
          id: '#secret-key-2-id',
          purposes: [KeyPurposes.ISSUING_METADATA],
        });

        await persistOrganizationKey({
          organization,
          id: '#secret-key-3-id',
          purposes: [KeyPurposes.PERMISSIONING],
        });

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}/keys/secret-key-id`,
        });

        expect(response.statusCode).toEqual(204);

        expect(mockRemoveOperator.mock.callCount()).toEqual(0);

        const updatedOrganizationKeys = await organizationKeysRepo.find({
          filter: { organizationId: new ObjectId(organization._id) },
          sort: {
            id: -1,
          },
        });

        expect(updatedOrganizationKeys.length).toEqual(2);
        expect(updatedOrganizationKeys[0].id).not.toEqual(exchangeKey.id);
        expect(updatedOrganizationKeys[1].id).not.toEqual(exchangeKey.id);

        const updatedOrganization = await organizationsRepo.findOne({
          _id: organization._id,
        });

        expect(updatedOrganization.didDoc).toEqual({
          '@context': expect.any(Array),
          service: [],
          id: organization.didDoc.id,
          verificationMethod: [
            expect.objectContaining({ id: '#eth-account-key-1' }),
          ],
          assertionMethod: ['#eth-account-key-1'],
        });
      });
    });

    describe('GET Organization Key', () => {
      let organization;
      let key;
      beforeEach(async () => {
        await clearDb();
        organization = await persistOrganization();
        key = await persistOrganizationKey({
          organization,
          id: '#secret-key-id',
          purposes: [KeyPurposes.EXCHANGES],
        });
      });

      it('Should return 404 when organization not found', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/did:test:notfound/keys/secret-key-id`,
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Not Found',
            errorCode: 'organization_not_found',
            message: 'Organization not found',
            statusCode: 404,
          })
        );
      });
      it('Should return 404 when key not found', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/keys/fake`,
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Not Found',
            errorCode: 'missing_error_code',
            message: 'Key not found',
            statusCode: 404,
          })
        );
      });

      it('Should return 403 if user is missing organization:read permission', async () => {
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [organization.didDoc.id],
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/keys/secret-key-id`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('Should return 404 if user has no group', async () => {
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [organization.didDoc.id],
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/keys/secret-key-id`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 404 if user is a member of another group', async () => {
        await persistGroup({
          groupId: organization.didDoc.id,
          dids: [organization.didDoc.id],
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/keys/secret-key-id`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(404);
      });
      it('Should return 200', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/keys/secret-key-id`,
        });
        expect(response).toMatchObject({
          statusCode: 200,
          json: {
            key: generateOrganizationKeyMatcher({
              kid: '#secret-key-id',
              purpose: 'EXCHANGES',
              withKidFragment: true,
              custodied: true,
              publicKey: key.publicKey,
              type: 'EcdsaSecp256k1VerificationKey2019',
            }),
          },
        });
      });
    });
  });

  describe('Non-custodial keys test suites', () => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    const expectedDidWebDoc = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
      ],
      id: 'did:web:example.com',
      verificationMethod: [
        {
          id: 'did:web:example.com#key-0',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
      ],
      authentication: ['did:web:example.com#key-0'],
      assertionMethod: ['did:web:example.com#key-0'],
      publicKey: [
        {
          id: 'did:web:example.com#key-0',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
      ],
    };
    let organization;
    beforeEach(async () => {
      nock.cleanAll();
      await clearDb();
      organization = await persistOrganization({
        service: [
          {
            id: '#acme',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          },
        ],
        name: 'Did web org',
        didDocId: expectedDidWebDoc.id,
        didNotCustodied: true,
      });
    });

    describe('Organization Key Addition', () => {
      it('Should add a new key from a non-custodied key', async () => {
        const nockData = nock('https://example.com')
          .get('/.well-known/did.json')
          .reply(200, expectedDidWebDoc);

        await persistOrganizationKey({
          organization,
          id: '#vnf-permissioning-id',
          purposes: [KeyPurposes.PERMISSIONING],
        });

        const did = organization.didDoc.id;
        const purpose = KeyPurposes.DLT_TRANSACTIONS;
        const kidFragment = '#key-0';
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment,
            purposes: [purpose],
            custodied: false,
          },
        });

        expect(response).toMatchObject({
          statusCode: 201,
          json: {
            key: generateOrganizationKeyMatcher({
              kid: kidFragment,
              purpose,
              withKidFragment: true,
              publicKey: true,
            }),
          },
        });

        const orgKeyFromDb = await mongoDb()
          .collection('organizationKeys')
          .findOne({
            organizationId: new ObjectId(organization._id),
            purposes: [purpose],
          });
        expect(orgKeyFromDb).toMatchObject(
          mapResponseKeyToDbKey(response.json.key)
        );

        expect(nockData.isDone()).toEqual(true);
      });

      it('Should not add a key if already exists', async () => {
        const did = organization.didDoc.id;
        const purpose = KeyPurposes.DLT_TRANSACTIONS;
        const kidFragment = '#key-0';
        await persistOrganizationKey({
          organization,
          id: kidFragment,
          purposes: [purpose],
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment,
            purposes: [purpose],
            custodied: false,
          },
        });

        expect(response).toMatchObject({
          statusCode: 409,
          json: {
            statusCode: 409,
            error: 'Conflict',
            message: 'Key with kidFragment #key-0 already exists',
          },
        });
      });

      it('Should throw error when did web not resolved', async () => {
        const nockData = nock('https://example.com')
          .get('/.well-known/did.json')
          .reply(404);

        const did = 'did:web:example.com';
        const purpose = KeyPurposes.DLT_TRANSACTIONS;
        const kidFragment = '#key-0';

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment,
            purposes: [purpose],
            custodied: false,
          },
        });

        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Could not resolve did:web:example.com',
          },
        });
        expect(nockData.isDone()).toEqual(true);
      });

      it('Should throw error when kidFragment is missing', async () => {
        const nockData = nock('https://example.com')
          .get('/.well-known/did.json')
          .reply(200, expectedDidWebDoc);
        const did = organization.didDoc.id;
        const purpose = KeyPurposes.DLT_TRANSACTIONS;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            purposes: [purpose],
            custodied: false,
          },
        });

        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Non custodial keys must specify kidFragment',
          },
        });
        expect(nockData.isDone()).toEqual(false);
      });

      it('Should throw error when key not found in did web document', async () => {
        const nockData = nock('https://example.com')
          .get('/.well-known/did.json')
          .reply(200, {
            ...expectedDidWebDoc,
            verificationMethod: [],
          });
        const did = organization.didDoc.id;
        const purpose = KeyPurposes.DLT_TRANSACTIONS;
        const kidFragment = '#key-1';

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/keys`,
          payload: {
            kidFragment,
            purposes: [purpose],
            custodied: false,
          },
        });

        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Key not found in BYO DID',
          },
        });
        expect(nockData.isDone()).toEqual(true);
      });
    });
    describe('Organization Key Removal', () => {
      it('Should 204 and delete DLT_TRANSACTIONS key from didDoc, db, and blockchain operators map', async () => {
        const did = organization.didDoc.id;

        await persistOrganizationKey({
          organization,
          purposes: [KeyPurposes.PERMISSIONING],
        });
        await persistOrganizationKey({
          organization,
          id: '#key-0',
          purposes: [KeyPurposes.DLT_TRANSACTIONS],
          publicKey: expectedDidWebDoc.verificationMethod[0].publicKeyJwk,
          key: null,
        });

        const organizationKeys = await organizationKeysRepo.find({
          filter: { organizationId: new ObjectId(organization._id) },
          sort: {
            id: -1,
          },
        });

        expect(organizationKeys.length).toEqual(2);

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}/keys/${encodeURIComponent(
            expectedDidWebDoc.verificationMethod[0].id
          )}`,
        });

        expect(response.statusCode).toEqual(204);

        expect(mockRemoveOperator.mock.callCount()).toEqual(1);
        expect(
          mockRemoveOperator.mock.calls.map((call) => call.arguments)
        ).toContainEqual([
          {
            operator: toEthereumAddress(
              hexFromJwk(
                expectedDidWebDoc.verificationMethod[0].publicKeyJwk,
                false
              )
            ),
            primary: organization.ids.ethereumAccount,
          },
        ]);

        const updatedOrganizationKeys = await organizationKeysRepo.find({
          filter: { organizationId: new ObjectId(organization._id) },
        });
        expect(updatedOrganizationKeys.length).toEqual(1);
      });
    });
  });
});
