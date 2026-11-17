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
 *
 */
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

mock.module('@verii/error-aggregation', {
  namedExports: {
    initSendError: () => Promise.resolve({ sendError: () => {} }),
  },
});

class ManagementClient {
  constructor() {
    this.clients = {
      create: async (obj) => ({ client_id: nanoid(), ...obj }),
      delete: async () => {},
    };
    this.clientGrants = {
      create: async (obj) => ({ id: nanoid(), ...obj }),
      delete: async () => {},
    };
    this.users = {
      list: async () => ({ data: [{ email: '0@localhost.test' }] }),
      get: async () => ({ email: 'admin@localhost.test' }),
      update: async (id, obj) => ({ id, ...obj }),
    };
  }
}
mock.module('auth0', { namedExports: { ManagementClient } });

mock.module('@verii/contract-permissions', {
  namedExports: {
    ...require('../../contract-permissions/src/constants'),
    initPermissions: () =>
      Promise.resolve({
        addPrimary: () => Promise.resolve(undefined),
        addOperatorKey: () => Promise.resolve(undefined),
        removeOperatorKey: () => Promise.resolve(undefined),
        updateAddressScopes: () => Promise.resolve(undefined),
      }),
  },
});

mock.module('@verii/fineract-client', {
  namedExports: {
    createFineractClient: () =>
      Promise.resolve({
        fineractClientId: '11',
        tokenAccountId: '12',
        escrowAccountId: '13',
      }),
    createStakesAccount: () => Promise.resolve('foo'),
  },
});

class SESClient {}
SESClient.prototype.send = (payload) => payload;
mock.module('@aws-sdk/client-ses', {
  namedExports: {
    SendEmailCommand: class SendEmailCommand {
      constructor(args) {
        return args;
      }
    },
    SESClient,
  },
});

const { nanoid } = require('nanoid');
const { find, includes, omit } = require('lodash/fp');
const { ObjectId } = require('mongodb');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { KeyAlgorithms, KeyPurposes } = require('@verii/crypto');
const { HEX_FORMAT } = require('@verii/test-regexes');
const {
  privateJwkMatcher,
  publicJwkMatcher,
  testRegistrarSuperUser,
} = require('@verii/tests-helpers');
const nock = require('./helpers/nock');
const buildFastify = require('./helpers/build-fastify');
const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');

const fullUrl = '/api/v0.6/organizations/full';

describe('Custodied organizations with ES256 organization keys', () => {
  let fastify;
  let orgProfile;
  let previousEs256OrganizationKeys;

  const clearDb = async () => {
    await mongoDb().collection('organizations').deleteMany({});
    await mongoDb().collection('organizationKeys').deleteMany({});
    await mongoDb().collection('kms').deleteMany({});
    await mongoDb().collection('groups').deleteMany({});
    await mongoDb().collection('images').deleteMany({});
    await mongoDb().collection('registrarConsents').deleteMany({});
  };

  const createOrganization = () =>
    fastify.injectJson({
      method: 'POST',
      url: fullUrl,
      payload: { profile: orgProfile },
      headers: {
        'x-auto-activate': '0',
        'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
      },
    });

  const findOrganizationKeys = (organizationId) =>
    mongoDb().collection('organizationKeys').find({ organizationId }).toArray();

  const findKmsEntry = (kmsKeyId) =>
    mongoDb()
      .collection('kms')
      .findOne({ _id: new ObjectId(kmsKeyId) });

  const findKeyByPurpose = (purpose, keys) =>
    find(({ purposes }) => includes(purpose, purposes), keys);

  before(async () => {
    previousEs256OrganizationKeys = process.env.ES256_ORGANIZATION_KEYS;
    process.env.ES256_ORGANIZATION_KEYS = 'true';
    fastify = buildFastify();
    await fastify.ready();
    const { newOrganization } = initOrganizationFactory(fastify);
    const organization = await newOrganization();
    orgProfile = omit(['id', 'createdAt', 'updatedAt'], organization.profile);
  });

  beforeEach(async () => {
    await clearDb();
    nock.cleanAll();
  });

  after(async () => {
    await clearDb();
    await fastify.close();
    if (previousEs256OrganizationKeys == null) {
      delete process.env.ES256_ORGANIZATION_KEYS;
    } else {
      process.env.ES256_ORGANIZATION_KEYS = previousEs256OrganizationKeys;
    }
    nock.cleanAll();
    mock.reset();
  });

  it('should publish P-256 issuing and exchange keys and keep the DLT key secp256k1', async () => {
    const response = await createOrganization();

    expect(response.statusCode).toEqual(201);
    const did = response.json.id;
    const organization = await mongoDb()
      .collection('organizations')
      .findOne({ 'didDoc.id': did });
    expect(organization.didDoc).toEqual({
      '@context': expect.any(Object),
      id: did,
      service: [],
      assertionMethod: [
        '#vc-signing-key-1',
        '#eth-account-key-1',
        '#exchange-key-1',
      ],
      verificationMethod: expectedVerificationMethods(did),
    });
    expect(response.json.didDoc).toEqual(organization.didDoc);
  });

  it('should store each key with its algorithm and a KMS entry on the matching curve', async () => {
    const response = await createOrganization();

    expect(response.statusCode).toEqual(201);
    const organization = await mongoDb()
      .collection('organizations')
      .findOne({ 'didDoc.id': response.json.id });
    const keys = await findOrganizationKeys(organization._id);
    expect(keys).toHaveLength(5);
    const expectations = [
      [
        KeyPurposes.ISSUING_METADATA,
        KeyAlgorithms.ES256,
        'JsonWebKey2020',
        'P-256',
      ],
      [KeyPurposes.EXCHANGES, KeyAlgorithms.ES256, 'JsonWebKey2020', 'P-256'],
      [
        KeyPurposes.DLT_TRANSACTIONS,
        KeyAlgorithms.SECP256K1,
        'EcdsaSecp256k1VerificationKey2019',
        'secp256k1',
      ],
      [
        KeyPurposes.PERMISSIONING,
        KeyAlgorithms.SECP256K1,
        'EcdsaSecp256k1VerificationKey2019',
        'secp256k1',
      ],
      [
        KeyPurposes.ROTATION,
        KeyAlgorithms.SECP256K1,
        'EcdsaSecp256k1VerificationKey2019',
        'secp256k1',
      ],
    ];
    for (const [purpose, algorithm, type, crv] of expectations) {
      const key = findKeyByPurpose(purpose, keys);
      expect(key).toEqual(
        expect.objectContaining({
          purposes: [purpose],
          algorithm,
          type,
          custodied: true,
          publicKey: {
            kty: 'EC',
            crv,
            x: expect.any(String),
            y: expect.any(String),
          },
        }),
      );
      // eslint-disable-next-line no-await-in-loop
      const kmsEntry = await findKmsEntry(key.kmsKeyId);
      expect(kmsEntry).toEqual(
        expect.objectContaining({
          algorithm: 'ec',
          curve: crv,
          publicJwk: key.publicKey,
        }),
      );
    }
  });

  it('should return P-256 keys as JWK and secp256k1 keys as hex by default', async () => {
    const response = await createOrganization();

    expect(response.statusCode).toEqual(201);
    const responseKeyById = (kidFragment) =>
      find({ kidFragment }, response.json.keys);
    for (const kidFragment of ['#vc-signing-key-1', '#exchange-key-1']) {
      const responseKey = responseKeyById(kidFragment);
      expect(responseKey).toEqual(
        expect.objectContaining({
          encoding: 'jwk',
          jwk: privateJwkMatcher(KeyAlgorithms.ES256),
          didDocumentKey: expect.objectContaining({
            publicKeyJwk: publicJwkMatcher(KeyAlgorithms.ES256),
          }),
        }),
      );
      expect(responseKey).not.toHaveProperty('key');
    }
    const dltKey = responseKeyById('#eth-account-key-1');
    expect(dltKey).toEqual(
      expect.objectContaining({
        encoding: 'hex',
        key: expect.stringMatching(HEX_FORMAT),
        didDocumentKey: expect.objectContaining({
          publicKeyMultibase: expect.stringMatching(HEX_FORMAT),
        }),
      }),
    );
    expect(dltKey).not.toHaveProperty('jwk');
  });

  it('should serve the P-256 verification methods from the hosted did:web document', async () => {
    const response = await createOrganization();

    expect(response.statusCode).toEqual(201);
    const { hostname } = new URL(orgProfile.website);
    const didDocResponse = await fastify.injectJson({
      method: 'GET',
      url: `/d/${hostname}/did.json`,
    });

    expect(didDocResponse.statusCode).toEqual(200);
    expect(didDocResponse.json.verificationMethod).toEqual(
      expectedVerificationMethods(response.json.id),
    );
  });
});

const expectedVerificationMethods = (did) => [
  expectedVerificationMethod(
    did,
    '#vc-signing-key-1',
    'JsonWebKey2020',
    'P-256',
  ),
  expectedVerificationMethod(
    did,
    '#eth-account-key-1',
    'EcdsaSecp256k1VerificationKey2019',
    'secp256k1',
  ),
  expectedVerificationMethod(did, '#exchange-key-1', 'JsonWebKey2020', 'P-256'),
];

const expectedVerificationMethod = (did, id, type, crv) => ({
  controller: did,
  id,
  type,
  publicKeyJwk: {
    crv,
    kty: 'EC',
    x: expect.any(String),
    y: expect.any(String),
  },
});
