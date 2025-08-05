/**
 * Copyright 2023 Velocity Team
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
const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const nock = require('nock');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { map, omit } = require('lodash/fp');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const { errorResponseMatcher, mongoify } = require('@verii/tests-helpers');
const { hexFromJwk, jwkFromSecp256k1Key } = require('@verii/jwt');
const { rootPrivateKey } = require('@verii/sample-data');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { KeyPurposes, KeyEncodings, generateKeyPair } = require('@verii/crypto');
const {
  deployTestPermissionsContract,
} = require('@verii/contract-permissions/test/helpers/deploy-test-permissions-contract');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const { createOrgDoc } = require('./helpers/create-test-org-doc');
const {
  nockRegistrarGetOrganizationDidDoc,
} = require('../combined/helpers/nock-registrar-get-organization-diddoc');
const {
  initTenantFactory,
  initKeysFactory,
  tenantRepoPlugin,
} = require('../../src/entities');
const {
  generatePrimaryAndAddOperatorToPrimary,
} = require('./helpers/generate-primary-and-add-operator-to-primary');
const { initAgentKms } = require('./helpers/init-agent-kms');

const buildKeysUrl = ({ tenant }) =>
  `/operator-api/v0.8/tenants/${tenant._id}/keys`;

describe('Tenant keys test suite', () => {
  let fastify;
  let persistTenant;
  let persistKey;
  let newKey;
  let orgDoc;
  let orgKey;
  let tenant;
  let orgPublicKey;
  let primaryAddress;
  let tenantRepo;
  let kms;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey, newKey } = initKeysFactory(fastify));

    ({ orgDoc, orgKey, orgPublicKey } = await createOrgDoc());
    const deployedContract = await deployTestPermissionsContract(
      rootPrivateKey,
      fastify.config.rpcUrl
    );
    fastify.config.permissionsContractAddress =
      await deployedContract.getAddress();

    ({ orgDoc, orgKey, orgPublicKey } = await createOrgDoc());

    const baseContext = {
      config: fastify.config,
      log: fastify.log,
    };
    primaryAddress = await generatePrimaryAndAddOperatorToPrimary(
      toEthereumAddress(orgPublicKey),
      baseContext
    );
    tenantRepo = tenantRepoPlugin(baseContext)();
  }, 10000);

  beforeEach(async () => {
    nock.cleanAll();
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    nockRegistrarGetOrganizationDidDoc(orgDoc.id, orgDoc);
    tenant = await persistTenant({
      did: orgDoc.id,
      primaryAddress,
    });
    kms = initAgentKms(fastify)({ tenant: mongoify(tenant) });
  });

  after(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  describe('Get keys of tenant tests', () => {
    it('should be able to get keys of an existing tenant', async () => {
      const key1 = await persistKey({ tenant });
      const key2 = await persistKey({ tenant });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildKeysUrl({ tenant })}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual(
        map(
          (key) => {
            return {
              ...omit(['_id', 'tenantId', 'updatedAt'], key),
              id: key._id,
              encoding: KeyEncodings.HEX,
              createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            };
          },
          [key1, key2]
        )
      );
    });

    it('should 404 for non-existing tenant', async () => {
      const fooTenant = { _id: new ObjectId() };
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${buildKeysUrl({ tenant: fooTenant })}`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'tenant_not_found',
          message: `Tenant ${JSON.stringify({
            tenantId: fooTenant._id,
          })} not found`,
          statusCode: 404,
        })
      );
    });
  });

  describe('Add key to tenant tests', () => {
    it('should 404 for non-existing tenant', async () => {
      const fooTenant = { _id: new ObjectId() };
      const key1 = omit(['tenantId'], await newKey({ tenant }));
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${buildKeysUrl({ tenant: fooTenant })}`,
        payload: {
          ...key1,
          key: orgKey,
          kidFragment: '#bad-kid-fragment',
        },
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'tenant_not_found',
          message: `Tenant ${JSON.stringify({
            tenantId: fooTenant._id,
          })} not found`,
          statusCode: 404,
        })
      );
    });

    it('should 400 with bad kidFragment', async () => {
      const key1 = omit(['tenantId'], await newKey({ tenant }));

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: orgKey,
          kidFragment: '#bad-kid-fragment',
        },
      });

      expect(response.statusCode).toEqual(400);

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 with key that does not match the kid', async () => {
      const key1 = omit(['tenantId'], await newKey({ tenant }));

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: 'not-a-key',
        },
      });

      expect(response.statusCode).toEqual(400);

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 with an unrecognized purpose', async () => {
      const key1 = omit(
        ['tenantId'],
        await newKey({ tenant, purposes: ['unrecognized-purpose'] })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Unrecognized purpose detected',
          statusCode: 400,
        })
      );

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 with no purposes', async () => {
      const key1 = omit(['tenantId'], await newKey({ tenant, purposes: [] }));

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: 'body/purposes must NOT have fewer than 1 items',
          statusCode: 400,
        })
      );

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 with duplicate purposes', async () => {
      const key1 = omit(
        ['tenantId'],
        await newKey({
          tenant,
          purposes: ['DLT_TRANSACTIONS', 'DLT_TRANSACTIONS'],
        })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Duplicate key purposes detected',
          statusCode: 400,
        })
      );

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 with unrecognized algorithm', async () => {
      const key1 = omit(
        ['tenantId'],
        await newKey({ tenant, algorithm: 'unrecognized-algorithm' })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Unrecognized algorithm',
          statusCode: 400,
        })
      );

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 with unrecognized encoding', async () => {
      const key1 = omit(
        ['tenantId'],
        await newKey({ tenant, encoding: 'unrecognized-encoding' })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          message: 'Unrecognized encoding',
          errorCode: 'missing_error_code',
          statusCode: 400,
        })
      );

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 409 when adding a key with an existing purpose', async () => {
      await persistKey({ tenant });
      const key1 = omit(
        ['tenantId'],
        await newKey({ tenant, kidFragment: '#key2' })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          encoding: KeyEncodings.HEX,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(409);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 409,
          error: 'Conflict',
          message: `Key with a purpose from ${JSON.stringify(
            key1.purposes
          )} already exists`,
        })
      );
      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(1);
    });

    it('should 409 when adding a key with an existing kidFragment', async () => {
      await persistKey({ tenant });
      const key1 = omit(['tenantId'], await newKey({ tenant }));

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          encoding: KeyEncodings.HEX,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(409);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 409,
          error: 'Conflict',
          message: `Key with kidFragment ${key1.kidFragment} already exists`,
        })
      );
      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(1);
    });

    it('should 201 adding a key with 3 purposes to the tenant', async () => {
      const key1 = omit(['tenantId'], await newKey({ tenant }));

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          encoding: KeyEncodings.HEX,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        ...omit(['tenantId', 'updatedAt', 'key', 'publicKey'], key1),
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        encoding: KeyEncodings.HEX,
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const keyFromDb = await mongoDb().collection('keys').findOne();
      expect(keyFromDb).toEqual({
        _id: expect.any(ObjectId),
        ...key1,
        tenantId: new ObjectId(tenant._id),
        key: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const decryptedKey = await kms.exportKeyOrSecret(response.json.id);
      expect(decryptedKey).toEqual({
        ...omit(['key', 'publicKey'], key1),
        id: response.json.id,
        privateJwk: jwkFromSecp256k1Key(orgKey, true),
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      const tenantFromDb = await tenantRepo.findOne(tenant._id);
      expect(tenantFromDb).toEqual({
        _id: new ObjectId(tenant._id),
        did: orgDoc.id,
        primaryAddress,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should 201 adding a key with 1 purpose to the tenant', async () => {
      const key1 = omit(
        ['tenantId'],
        await newKey({ tenant, purposes: ['DLT_TRANSACTIONS'] })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          encoding: KeyEncodings.HEX,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        ...omit(['_id', 'tenantId', 'updatedAt', 'key', 'publicKey'], key1),
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        encoding: KeyEncodings.HEX,
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const keyFromDb = await mongoDb().collection('keys').findOne();
      expect(keyFromDb).toEqual({
        _id: expect.any(ObjectId),
        ...key1,
        tenantId: new ObjectId(tenant._id),
        key: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const decryptedKey = await kms.exportKeyOrSecret(response.json.id);
      expect(decryptedKey).toEqual({
        ...omit(['key', 'publicKey'], key1),
        id: response.json.id,
        privateJwk: jwkFromSecp256k1Key(orgKey, true),
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const tenantFromDb = await tenantRepo.findOne(tenant._id);
      expect(tenantFromDb).toEqual({
        _id: new ObjectId(tenant._id),
        did: orgDoc.id,
        primaryAddress,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should not change primaryAddress if DLT_TRANSACTION key already exist in db', async () => {
      await persistKey({ tenant, purposes: [KeyPurposes.DLT_TRANSACTIONS] });

      const key1 = omit(
        ['tenantId'],
        await newKey({ tenant, purposes: [KeyPurposes.DLT_TRANSACTIONS] })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          encoding: KeyEncodings.HEX,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(409);
      const tenantFromDb = await tenantRepo.findOne(tenant._id);
      expect(tenantFromDb.primaryAddress).toEqual(primaryAddress);
    });

    it('should set primaryAddress if DLT_TRANSACTION key not exist in db', async () => {
      tenantRepo.update(tenant._id, { primaryAddress: '' });
      const key1 = omit(
        ['tenantId'],
        await newKey({ tenant, purposes: [KeyPurposes.DLT_TRANSACTIONS] })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          encoding: KeyEncodings.HEX,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(201);
      const tenantFromDb = await tenantRepo.findOne(tenant._id);
      expect(tenantFromDb.primaryAddress).toBe(primaryAddress);
    });

    it('should not add primaryAddress if purpose not DLT_TRANSACTION', async () => {
      nockRegistrarGetOrganizationDidDoc('did:test', orgDoc);
      const tenant1 = await persistTenant({
        did: 'did:test',
        primaryAddress: '',
      });
      const key1 = omit(
        ['tenantId'],
        await newKey({
          tenant: tenant1,
          purposes: [
            KeyPurposes.EXCHANGES,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.REVOCATIONS_FALLBACK,
            KeyPurposes.ROTATION,
            KeyPurposes.PERMISSIONING,
          ],
        })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant: tenant1 }),
        payload: {
          ...key1,
          encoding: KeyEncodings.HEX,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(201);
      const tenantFromDb = await tenantRepo.findOne(tenant1._id);
      expect(tenantFromDb.primaryAddress).toBe('');
    });

    it('should not add primaryAddress if tenant has primaryAddress', async () => {
      nockRegistrarGetOrganizationDidDoc('did:test', orgDoc);
      const tenant1 = await persistTenant({
        did: 'did:test',
      });
      const prevPrimaryAddress = tenant1.primaryAddress;
      const key1 = omit(
        ['tenantId'],
        await newKey({ tenant, purposes: [KeyPurposes.DLT_TRANSACTIONS] })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant: tenant1 }),
        payload: {
          ...key1,
          encoding: KeyEncodings.HEX,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(201);
      const tenantFromDb = await tenantRepo.findOne(tenant1._id);
      expect(tenantFromDb.primaryAddress).toBe(prevPrimaryAddress);
    });
  });

  describe('Remove tenant key tests', () => {
    it('should 404 for non-existing tenant', async () => {
      const key1 = await persistKey({ tenant });

      const fooTenant = { _id: new ObjectId() };
      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${buildKeysUrl({ tenant: fooTenant })}/${encodeURIComponent(
          key1.kidFragment
        )}`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          message: `Tenant ${JSON.stringify({
            tenantId: fooTenant._id,
          })} not found`,
          errorCode: 'tenant_not_found',
          statusCode: 404,
        })
      );
    });

    it('should 404 when deleting a non-existent key', async () => {
      await persistKey({ tenant });

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${buildKeysUrl({ tenant })}/not-a-fragment`,
      });

      expect(response.statusCode).toEqual(404);

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(1);
    });

    it('should 204 when deleting an existing key', async () => {
      const key1 = await persistKey({ tenant });

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${buildKeysUrl({ tenant })}/${encodeURIComponent(
          key1.kidFragment
        )}`,
      });

      expect(response.statusCode).toEqual(204);

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });
  });

  describe('Did web document', () => {
    const getDidWebDoc = (key, did = 'did:web:123') => ({
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
      ],
      id: did,
      authentication: [key.id],
      assertionMethod: [key.id],
      verificationMethod: [key],
      publicKey: [key],
    });
    let keyPair;

    before(async () => {
      keyPair = await generateKeyPair({ format: 'jwk' });
      orgKey = keyPair.privateKey;
      orgDoc = getDidWebDoc({
        id: 'did:web:123#key-0',
        type: 'JsonWebKey2020',
        controller: 'did:web:123',
        publicKeyJwk: keyPair.publicKey,
      });
      nockRegistrarGetOrganizationDidDoc('did:web:123', orgDoc);
      orgPublicKey = hexFromJwk(keyPair.publicKey, false);

      const baseContext = {
        config: fastify.config,
        log: fastify.log,
      };
      primaryAddress = await generatePrimaryAndAddOperatorToPrimary(
        toEthereumAddress(orgPublicKey),
        baseContext
      );
      tenant = await persistTenant({
        did: 'did:web:123',
        primaryAddress,
      });
    });

    it('should 201 adding a key with 3 purposes to the tenant', async () => {
      const key1 = omit(['tenantId'], await newKey({ tenant }));

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          kidFragment: '#key-0',
          encoding: KeyEncodings.HEX,
          key: hexFromJwk(keyPair.privateKey, true),
        },
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        ...omit(['_id', 'tenantId', 'updatedAt', 'key', 'publicKey'], key1),
        kidFragment: '#key-0',
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        encoding: KeyEncodings.HEX,
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const keyFromDb = await mongoDb().collection('keys').findOne();
      expect(keyFromDb).toEqual({
        _id: expect.any(ObjectId),
        ...key1,
        kidFragment: '#key-0',
        tenantId: new ObjectId(tenant._id),
        key: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const decryptedKey = await kms.exportKeyOrSecret(response.json.id);
      expect(decryptedKey).toEqual({
        ...omit(['key', 'publicKey'], key1),
        kidFragment: '#key-0',
        id: response.json.id,
        privateJwk: { use: 'sig', ...keyPair.privateKey },
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const tenantFromDb = await tenantRepo.findOne(tenant._id);
      expect(tenantFromDb).toEqual({
        _id: new ObjectId(tenant._id),
        did: orgDoc.id,
        primaryAddress,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should 201 adding a jwk to the tenant', async () => {
      const key1 = omit(['tenantId', 'key'], await newKey({ tenant }));

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          kidFragment: '#key-0',
          encoding: KeyEncodings.JWK,
          jwk: keyPair.privateKey,
        },
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        ...omit(['_id', 'tenantId', 'updatedAt', 'key', 'publicKey'], key1),
        kidFragment: '#key-0',
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        encoding: KeyEncodings.HEX,
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const keyFromDb = await mongoDb().collection('keys').findOne();
      expect(keyFromDb).toEqual({
        _id: expect.any(ObjectId),
        ...key1,
        kidFragment: '#key-0',
        tenantId: new ObjectId(tenant._id),
        key: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const decryptedKey = await kms.exportKeyOrSecret(response.json.id);
      expect(decryptedKey).toEqual({
        ...omit(['key', 'publicKey'], key1),
        id: response.json.id,
        kidFragment: '#key-0',
        privateJwk: keyPair.privateKey,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const tenantFromDb = await tenantRepo.findOne(tenant._id);
      expect(tenantFromDb).toEqual({
        _id: new ObjectId(tenant._id),
        did: orgDoc.id,
        primaryAddress,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should 201 adding a hex to the tenant', async () => {
      const key1 = omit(['tenantId', 'key'], await newKey({ tenant }));

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          kidFragment: '#key-0',
          encoding: KeyEncodings.JWK,
          publicKey: hexFromJwk(keyPair.publicKey, false),
          hexKey: hexFromJwk(keyPair.privateKey, true),
        },
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        ...omit(['_id', 'tenantId', 'updatedAt', 'key', 'publicKey'], key1),
        kidFragment: '#key-0',
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        encoding: KeyEncodings.HEX,
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const keyFromDb = await mongoDb().collection('keys').findOne();
      expect(keyFromDb).toEqual({
        _id: expect.any(ObjectId),
        ...key1,
        kidFragment: '#key-0',
        tenantId: new ObjectId(tenant._id),
        key: expect.any(String),
        publicKey: expect.any(Object),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const decryptedKey = await kms.exportKeyOrSecret(response.json.id);
      expect(decryptedKey).toEqual({
        ...omit(['key', 'publicKey'], key1),
        id: response.json.id,
        kidFragment: '#key-0',
        privateJwk: { ...keyPair.privateKey, use: 'sig' },
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      const tenantFromDb = await tenantRepo.findOne(tenant._id);
      expect(tenantFromDb).toEqual({
        _id: new ObjectId(tenant._id),
        did: orgDoc.id,
        primaryAddress,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should 404 for non-existing tenant', async () => {
      const fooTenant = { _id: new ObjectId() };
      const key1 = omit(['tenantId'], await newKey({ tenant }));
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${buildKeysUrl({ tenant: fooTenant })}`,
        payload: {
          ...key1,
          key: orgKey,
          kidFragment: '#bad-kid-fragment',
        },
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'tenant_not_found',
          message: `Tenant ${JSON.stringify({
            tenantId: fooTenant._id,
          })} not found`,
          statusCode: 404,
        })
      );
    });

    it('should 400 with bad kidFragment', async () => {
      const key1 = omit(['tenantId'], await newKey({ tenant }));

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: orgKey,
          kidFragment: '#bad-kid-fragment',
        },
      });

      expect(response.statusCode).toEqual(400);

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 with key that does not match the kid', async () => {
      const key1 = omit(['tenantId'], await newKey({ tenant }));

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: 'not-a-key',
        },
      });

      expect(response.statusCode).toEqual(400);

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 with an unrecognized purpose', async () => {
      const key1 = omit(
        ['tenantId'],
        await newKey({ tenant, purposes: ['unrecognized-purpose'] })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Unrecognized purpose detected',
          statusCode: 400,
        })
      );

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 with no purposes', async () => {
      const key1 = omit(['tenantId'], await newKey({ tenant, purposes: [] }));

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: 'body/purposes must NOT have fewer than 1 items',
          statusCode: 400,
        })
      );

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 with duplicate purposes', async () => {
      const key1 = omit(
        ['tenantId'],
        await newKey({
          tenant,
          purposes: ['DLT_TRANSACTIONS', 'DLT_TRANSACTIONS'],
        })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Duplicate key purposes detected',
          statusCode: 400,
        })
      );

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 with unrecognized algorithm', async () => {
      const key1 = omit(
        ['tenantId'],
        await newKey({ tenant, algorithm: 'unrecognized-algorithm' })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Unrecognized algorithm',
          statusCode: 400,
        })
      );

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 with unrecognized encoding', async () => {
      const key1 = omit(
        ['tenantId'],
        await newKey({ tenant, encoding: 'unrecognized-encoding' })
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          key: orgKey,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          message: 'Unrecognized encoding',
          errorCode: 'missing_error_code',
          statusCode: 400,
        })
      );

      const count = await mongoDb().collection('keys').countDocuments();
      expect(count).toEqual(0);
    });

    it('should 400 if private key is not provided', async () => {
      const key1 = omit(['tenantId', 'key'], await newKey({ tenant }));

      const response = await fastify.injectJson({
        method: 'POST',
        url: buildKeysUrl({ tenant }),
        payload: {
          ...key1,
          kidFragment: '#key-0',
          encoding: KeyEncodings.JWK,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'private_key_not_found',
          message: 'Private key not found',
          statusCode: 400,
        })
      );
    });
  });
});
