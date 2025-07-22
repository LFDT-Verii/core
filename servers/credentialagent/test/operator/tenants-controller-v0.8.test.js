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

// eslint-disable-next-line import/order
const nock = require('nock');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { first, last, omit } = require('lodash/fp');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { rootPrivateKey } = require('@verii/sample-data');
const { KeyPurposes, generateKeyPair, decrypt } = require('@verii/crypto');
const {
  deployTestPermissionsContract,
} = require('@verii/contract-permissions/test/helpers/deploy-test-permissions-contract');
const { hexFromJwk, publicKeyFromPrivateKey } = require('@verii/jwt');
const { jwkFromSecp256k1Key } = require('@verii/jwt');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const { createOrgDoc } = require('./helpers/create-test-org-doc');
const {
  generatePrimaryAndAddOperatorToPrimary,
} = require('./helpers/generate-primary-and-add-operator-to-primary');
const {
  nockRegistrarGetOrganizationDidDoc,
} = require('../combined/helpers/nock-registrar-get-organization-diddoc');
const {
  initTenantFactory,
  tenantRepoPlugin,
  initGroupsFactory,
  initOfferFactory,
  initOfferExchangeFactory,
  initDisclosureFactory,
  initUserFactory,
} = require('../../src/entities');
const { initFindKmsKey } = require('./helpers/find-kms-key');

const testUrl = '/operator-api/v0.8/tenants';

describe('Tenants management Test suite', () => {
  let fastify;
  let persistTenant;
  let persistGroup;
  let persistDisclosure;
  let persistOffer;
  let persistOfferExchange;
  let persistVendorUserIdMapping;
  let orgDoc;
  let orgKey;
  let orgPublicKey;
  let primaryAddress;
  let tenantRepo;
  let findKmsKey;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistGroup } = initGroupsFactory(fastify));
    ({ persistOffer } = initOfferFactory(fastify));
    ({ persistDisclosure } = initDisclosureFactory(fastify));
    ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
    ({ persistVendorUserIdMapping } = initUserFactory(fastify));

    const deployedContract = await deployTestPermissionsContract(
      rootPrivateKey,
      fastify.config.rpcUrl
    );
    fastify.config.permissionsContractAddress =
      await deployedContract.getAddress();
    tenantRepo = tenantRepoPlugin(fastify)();
    findKmsKey = initFindKmsKey(fastify);
    ({ orgDoc, orgKey, orgPublicKey } = await createOrgDoc());

    primaryAddress = await generatePrimaryAndAddOperatorToPrimary(
      toEthereumAddress(orgPublicKey),
      {
        config: fastify.config,
        log: fastify.log,
      }
    );
  }, 10000);

  beforeEach(async () => {
    nock.cleanAll();
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('groups').deleteMany({});
    nockRegistrarGetOrganizationDidDoc(orgDoc.id, orgDoc);
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  describe('Tenant Creation tests', () => {
    it('should HTTP 404 when DID not found when trying to create', async () => {
      const { orgDoc: orgDoc2, orgKey: orgKey2 } = await createOrgDoc();
      nockRegistrarGetOrganizationDidDoc(orgDoc2.id, {});

      const payload = {
        did: orgDoc2.id,
        serviceIds: [`${orgDoc2.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: first(orgDoc2.assertionMethod),
            key: orgKey2,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'did_not_found',
          message: 'DID not found on the Velocity network registrar.',
          statusCode: 404,
        })
      );
    });

    it('should HTTP 404 when registrar return 500', async () => {
      const { orgDoc: orgDoc2, orgKey: orgKey2 } = await createOrgDoc();
      nock('http://oracle.localhost.test')
        .get(`/api/v0.6/resolve-did/${orgDoc2.id}`)
        .reply(404, {});
      const payload = {
        did: orgDoc2.id,
        serviceIds: [`${orgDoc2.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: first(orgDoc2.assertionMethod),
            key: orgKey2,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'did_not_found',
          message: 'DID not found on the Velocity network registrar.',
          statusCode: 404,
        })
      );
    });

    it('should HTTP 409 and not create additional tenant', async () => {
      await persistTenant({
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
      });

      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(409);
      expect(response.json).toEqual({
        code: '11000',
        statusCode: 409,
        error: 'Conflict',
        message: expect.stringMatching(/duplicate key/gi),
      });
      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(1);
    });

    it('should HTTP 400 and not create tenant or keys when no key purpose is provided', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: [],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: first(orgDoc.assertionMethod),
            key: orgKey,
          },
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: `${first(orgDoc.assertionMethod)}2`,
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: 'body/keys/0/purposes must NOT have fewer than 1 items',
          statusCode: 400,
        })
      );

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a key purpose is not recognized', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['unrecognized-purpose'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: first(orgDoc.assertionMethod),
            key: orgKey,
          },
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: `${first(orgDoc.assertionMethod)}2`,
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
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

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a key purpose is duplicated', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: first(orgDoc.assertionMethod),
            key: orgKey,
          },
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: `${first(orgDoc.assertionMethod)}2`,
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
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

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a key algorithm is not recognized', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'unrecognized-algorithm',
            encoding: 'hex',
            kidFragment: first(orgDoc.assertionMethod),
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
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

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a key encoding is not recognized', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'unrecognized-encoding',
            kidFragment: first(orgDoc.assertionMethod),
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Unrecognized encoding',
          statusCode: 400,
        })
      );

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a kid fragment is duplicated', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: first(orgDoc.assertionMethod),
            key: orgKey,
          },
          {
            purposes: ['ISSUING_METADATA'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: first(orgDoc.assertionMethod),
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Duplicate kid fragments purposes detected',
          statusCode: 400,
        })
      );

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a key service is not found on document', async () => {
      const serviceId = `${orgDoc.id}#not-a-service`;
      const payload = {
        did: orgDoc.id,
        serviceIds: [serviceId],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: first(orgDoc.assertionMethod),
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: `ServiceId ${serviceId} is not on did document for did: ${orgDoc.id}`,
          statusCode: 400,
        })
      );

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a private key does not match with public key on document', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: first(orgDoc.assertionMethod),
            key: 'non-matching-key',
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Private key not matched to document',
          statusCode: 400,
        })
      );

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should 400 if webhookUrl is not uri', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [],
        webhookUrl: 'customUrl',
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: 'body/webhookUrl must match format "uri"',
          statusCode: 400,
        })
      );
    });

    it('should 400 if webhookAuth type is not a bearer', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [],
        webhookAuth: {
          type: 'foo',
          bearerToken: 'secret',
        },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            'body/webhookAuth/type must be equal to one of the allowed values',
          statusCode: 400,
        })
      );
    });

    it('should 200 and create a tenant db document and no key db document when creating tenant with no keys', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const tenantFromDb = await mongoDb()
        .collection('tenants')
        .findOne({ _id: new ObjectId(response.json.id) });
      expect(tenantFromDb).toEqual({
        _id: new ObjectId(response.json.id),
        serviceIds: [`${orgDoc.id}#test-service`],
        did: orgDoc.id,
        dids: [orgDoc.id, ...orgDoc.alsoKnownAs],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should 201 create a tenant with webhookAuth', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: ['#test-service'],
        keys: [],
        webhookAuth: {
          type: 'bearer',
          bearerToken: 'secret',
        },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      const updatedTenant = await tenantRepo.findOne(
        new ObjectId(response.json.id)
      );

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
      expect(
        decrypt(
          updatedTenant.webhookAuth.bearerToken,
          fastify.config.mongoSecret
        )
      ).toEqual('secret');
    });

    it('should 201 create a tenant when relative serviceIds are supplied', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: ['#test-service'],
        keys: [],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
    });

    it('should 201 and create a tenant and key db documents when creating tenant with a key with 1 purpose', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: first(orgDoc.assertionMethod),
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const tenantFromDb = await mongoDb()
        .collection('tenants')
        .findOne({ _id: new ObjectId(response.json.id) });
      expect(tenantFromDb).toEqual({
        _id: new ObjectId(response.json.id),
        serviceIds: [`${orgDoc.id}#test-service`],
        did: orgDoc.id,
        dids: [orgDoc.id, ...orgDoc.alsoKnownAs],
        primaryAddress,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(
        await findKmsKey({ tenantId: new ObjectId(response.json.id) })
      ).toEqual({
        _id: expect.any(ObjectId),
        key: jwkFromSecp256k1Key(orgKey),
        kidFragment: last(orgDoc.assertionMethod),
      });
    });

    it('should 201 and create a tenant and do not lookup primaryAddress for tenant if key with DLT_TRANSACTION does not exist', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: [KeyPurposes.ISSUING_METADATA],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: first(orgDoc.assertionMethod),
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const tenantFromDb = await mongoDb()
        .collection('tenants')
        .findOne({ _id: new ObjectId(response.json.id) });
      expect(tenantFromDb).toEqual({
        _id: new ObjectId(response.json.id),
        serviceIds: [`${orgDoc.id}#test-service`],
        did: orgDoc.id,
        dids: [orgDoc.id, ...orgDoc.alsoKnownAs],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('Tenant Retrieving tests', () => {
    it('should return empty array if there is not tenants', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual([]);
    });

    it('should return all tenants if user admin', async () => {
      await persistTenant();
      await persistTenant();
      await persistTenant();
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toHaveLength(3);
    });
  });

  describe('Tenant with group tests', () => {
    describe('Tenant creation', () => {
      it('should 404 if group not exists', async () => {
        const payload = {
          did: orgDoc.id,
          serviceIds: ['#test-service'],
          keys: [],
          webhookAuth: {
            type: 'bearer',
            bearerToken: 'secret',
          },
        };

        const groupId = 'no';

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl,
          payload,
          headers: {
            'x-override-auth-user-group-id': groupId,
          },
        });
        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Not Found',
            errorCode: 'group_does_not_exist',
            message: 'Group does not exist',
            statusCode: 404,
          })
        );
      });
    });

    describe('Tenant Retrieving', () => {
      it('should return tenants from the group', async () => {
        const groupId = 'secret';
        await persistTenant();
        const tenant = await persistTenant();
        const tenant2 = await persistTenant();

        await persistGroup({ _id: groupId, dids: [tenant.did] });
        await persistGroup({ _id: 'on-oiu', dids: [tenant2.did] });

        const response = await fastify.injectJson({
          method: 'GET',
          url: testUrl,
          headers: {
            'x-override-auth-user-group-id': groupId,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toHaveLength(1);
        expect(response.json).toEqual([
          { ...omit(['_id'], tenant), id: tenant._id },
        ]);
      });
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
      service: [
        {
          id: '#test-service',
          type: 'VlcCareerIssuer_v1',
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        },
      ],
    });
    let keyPair;

    beforeAll(async () => {
      keyPair = await generateKeyPair({ format: 'jwk' });
      orgKey = keyPair.privateKey;
      orgDoc = getDidWebDoc(
        {
          id: 'did:web:123%3A3000#key-0',
          type: 'JsonWebKey2020',
          controller: 'did:web:123',
          publicKeyJwk: keyPair.publicKey,
        },
        'did:web:123%3A3000'
      );
      orgPublicKey = hexFromJwk(keyPair.publicKey, false);

      primaryAddress = await generatePrimaryAndAddOperatorToPrimary(
        toEthereumAddress(orgPublicKey),
        {
          config: fastify.config,
          log: fastify.log,
        }
      );
    }, 10000);

    beforeEach(async () => {
      nockRegistrarGetOrganizationDidDoc('did:web:123', orgDoc);
    });

    it('should HTTP 404 when DID not found when trying to create', async () => {
      const { orgDoc: orgDoc2, orgKey: orgKey2 } = await createOrgDoc();
      nockRegistrarGetOrganizationDidDoc(orgDoc2.id, {});

      const payload = {
        did: orgDoc2.id,
        serviceIds: [`${orgDoc2.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: first(orgDoc2.assertionMethod),
            key: orgKey2,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'did_not_found',
          message: 'DID not found on the Velocity network registrar.',
          statusCode: 404,
        })
      );
    });

    it('should HTTP 404 when registrar return 500', async () => {
      const { orgDoc: orgDoc2, orgKey: orgKey2 } = await createOrgDoc();
      nock('http://oracle.localhost.test')
        .get(`/api/v0.6/resolve-did/${orgDoc2.id}`)
        .reply(404, {});
      const payload = {
        did: orgDoc2.id,
        serviceIds: [`${orgDoc2.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
            key: orgKey2,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'did_not_found',
          message: 'DID not found on the Velocity network registrar.',
          statusCode: 404,
        })
      );
    });

    it('should HTTP 409 and not create additional tenant', async () => {
      await persistTenant({
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
      });

      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(409);
      expect(response.json).toEqual({
        code: '11000',
        statusCode: 409,
        error: 'Conflict',
        message: expect.stringMatching(/duplicate key/gi),
      });
      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(1);
    });

    it('should HTTP 400 and not create tenant or keys when no key purpose is provided', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: [],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
            key: orgKey,
          },
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: 'body/keys/0/purposes must NOT have fewer than 1 items',
          statusCode: 400,
        })
      );

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a key purpose is not recognized', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['unrecognized-purpose'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
            key: orgKey,
          },
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-1',
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
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

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a key purpose is duplicated', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
            key: orgKey,
          },
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-1',
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
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

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a key algorithm is not recognized', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'unrecognized-algorithm',
            encoding: 'hex',
            kidFragment: '#key-0',
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
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

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a key encoding is not recognized', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'unrecognized-encoding',
            kidFragment: '#key-0',
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Unrecognized encoding',
          statusCode: 400,
        })
      );

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a kid fragment is duplicated', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
            key: orgKey,
          },
          {
            purposes: ['ISSUING_METADATA'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Duplicate kid fragments purposes detected',
          statusCode: 400,
        })
      );

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a key service is not found on document', async () => {
      const serviceId = `${orgDoc.id}#not-a-service`;
      const payload = {
        did: orgDoc.id,
        serviceIds: [serviceId],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
            key: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: `ServiceId ${serviceId} is not on did document for did: ${orgDoc.id}`,
          statusCode: 400,
        })
      );

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should HTTP 400 and not create tenant or keys when a private key does not match with public key on document', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
            key: 'non-matching-key',
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: 'Private key not matched to document',
          statusCode: 400,
        })
      );

      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(0);

      const keyDocumentsCount = await mongoDb()
        .collection('keys')
        .countDocuments();
      expect(keyDocumentsCount).toEqual(0);
    });

    it('should 400 if webhookUrl is not uri', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [],
        webhookUrl: 'customUrl',
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: 'body/webhookUrl must match format "uri"',
          statusCode: 400,
        })
      );
    });

    it('should 400 if webhookAuth type is not a bearer', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [],
        webhookAuth: {
          type: 'foo',
          bearerToken: 'secret',
        },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            'body/webhookAuth/type must be equal to one of the allowed values',
          statusCode: 400,
        })
      );
    });

    it('should 400 if private key is not provided', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
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

    it('should 201 and create a tenant and key', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
            key: hexFromJwk(orgKey, true),
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const tenantFromDb = await mongoDb()
        .collection('tenants')
        .findOne({ _id: new ObjectId(response.json.id) });
      expect(tenantFromDb).toEqual({
        _id: new ObjectId(response.json.id),
        serviceIds: [`${orgDoc.id}#test-service`],
        did: orgDoc.id,
        dids: [orgDoc.id],
        primaryAddress,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(
        await findKmsKey({ tenantId: new ObjectId(response.json.id) })
      ).toEqual({
        _id: expect.any(ObjectId),
        key: { use: 'sig', ...orgKey },
        kidFragment: '#key-0',
      });
    });

    it('should 201 and create a tenant and key with jwk in the body', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
            jwk: orgKey,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const tenantFromDb = await mongoDb()
        .collection('tenants')
        .findOne({ _id: new ObjectId(response.json.id) });
      expect(tenantFromDb).toEqual({
        _id: new ObjectId(response.json.id),
        serviceIds: [`${orgDoc.id}#test-service`],
        did: orgDoc.id,
        dids: [orgDoc.id],
        primaryAddress,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(
        await findKmsKey({ tenantId: new ObjectId(response.json.id) })
      ).toEqual({
        _id: expect.any(ObjectId),
        key: orgKey,
        kidFragment: '#key-0',
      });
    });

    it('should 201 and create a tenant and key with hexKey in the body', async () => {
      const payload = {
        did: orgDoc.id,
        serviceIds: [`${orgDoc.id}#test-service`],
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'SECP256K1',
            encoding: 'hex',
            kidFragment: '#key-0',
            hexKey: hexFromJwk(orgKey, true),
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload,
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const tenantFromDb = await mongoDb()
        .collection('tenants')
        .findOne({ _id: new ObjectId(response.json.id) });
      expect(tenantFromDb).toEqual({
        _id: new ObjectId(response.json.id),
        serviceIds: [`${orgDoc.id}#test-service`],
        did: orgDoc.id,
        dids: [orgDoc.id],
        primaryAddress,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(
        await findKmsKey({ tenantId: new ObjectId(response.json.id) })
      ).toEqual({
        _id: expect.any(ObjectId),
        key: { use: 'sig', ...orgKey },
        kidFragment: '#key-0',
      });
    });
  });

  describe('Tenant Did Refresh tests', () => {
    beforeEach(async () => {
      await mongoDb().collection('offers').deleteMany({});
      await mongoDb().collection('disclosures').deleteMany({});
      await mongoDb().collection('exchanges').deleteMany({});
    });
    it("should 400 when 'all' and 'did' props are missing from body", async () => {
      const payload = {
        foo: 'bar',
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/refresh`,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            "body must have required property 'all', body must have required property 'did', body must match exactly one schema in oneOf",
          statusCode: 400,
        })
      );
    });
    it("should 400 when both 'all' and 'did' props are present in body", async () => {
      const payload = {
        all: true,
        did: 'did:test:foo',
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/refresh`,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: 'body must match exactly one schema in oneOf',
          statusCode: 400,
        })
      );
    });
    it("should 400 if 'all' is false", async () => {
      const payload = {
        all: false,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/refresh`,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            // eslint-disable-next-line max-len
            "body/all must be equal to one of the allowed values, body must have required property 'did', body must match exactly one schema in oneOf",
          statusCode: 400,
        })
      );
    });
    it("should 400 if 'all' is true and no tenants", async () => {
      const payload = {
        all: true,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/refresh`,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message:
            // eslint-disable-next-line max-len
            'No tenants to refresh',
          statusCode: 400,
        })
      );
    });
    it("should 400 if 'did' is provided and no tenants", async () => {
      const payload = {
        did: 'did:test:foo',
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/refresh`,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message:
            // eslint-disable-next-line max-len
            'No tenants to refresh',
          statusCode: 400,
        })
      );
    });
    it("should 200 if 'all' is true and not update anything if no preferred dids are found", async () => {
      const oldDid1 = 'did:test:foo1';
      const newDid1 = 'did:notweb:foo1';
      const tenant1 = await persistTenant({ did: oldDid1 });
      const disclosure1 = await persistDisclosure({ tenant: tenant1 });
      const user1 = await persistVendorUserIdMapping({ tenant: tenant1 });
      const exchange1 = await persistOfferExchange({
        tenant: tenant1,
        disclosure: disclosure1,
      });
      const offer1 = await persistOffer({
        tenant: tenant1,
        exchange: exchange1,
        user: user1,
      });
      nockRegistrarGetOrganizationDidDoc(oldDid1, {
        id: oldDid1,
        alsoKnownAs: [newDid1],
      });

      const payload = {
        all: true,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/refresh`,
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({});
      const tenant1FromDb = await mongoDb()
        .collection('tenants')
        .findOne(
          { _id: new ObjectId(tenant1._id) },
          { projection: { did: 1, aliases: 1 } }
        );
      expect(tenant1FromDb).toEqual({
        _id: new ObjectId(tenant1._id),
        did: oldDid1,
      });
      const offer1FromDb = await mongoDb()
        .collection('offers')
        .findOne(
          { _id: new ObjectId(offer1._id) },
          { projection: { 'issuer.id': 1 } }
        );
      expect(offer1FromDb).toEqual({
        _id: new ObjectId(offer1._id),
        issuer: {
          id: oldDid1,
        },
      });
    });
    it("should 200 if 'all' is true and update existing tenants with preferred dids, serviceIds and their offers", async () => {
      const oldDid1 = 'did:test:foo1';
      const oldDid2 = 'did:test:foo2';
      const oldDid3 = 'did:test:foo3';
      const newDid1 = 'did:web:foo1';
      const newDid2 = 'did:web:foo2';
      const newDid3 = 'did:notweb:foo3';
      const tenant1 = await persistTenant({
        did: oldDid1,
        serviceIds: [`${oldDid1}#foo`],
      });
      const tenant2 = await persistTenant({ did: oldDid2 });
      const tenant3 = await persistTenant({ did: oldDid3 });
      const disclosure1 = await persistDisclosure({ tenant: tenant1 });
      const disclosure2 = await persistDisclosure({ tenant: tenant2 });
      const user1 = await persistVendorUserIdMapping({ tenant: tenant1 });
      const user2 = await persistVendorUserIdMapping({ tenant: tenant2 });
      const exchange1 = await persistOfferExchange({
        tenant: tenant1,
        disclosure: disclosure1,
      });
      const exchange2 = await persistOfferExchange({
        tenant: tenant2,
        disclosure: disclosure2,
      });
      const offer1 = await persistOffer({
        tenant: tenant1,
        exchange: exchange1,
        user: user1,
      });
      const offer2 = await persistOffer({
        tenant: tenant2,
        exchange: exchange2,
        user: user2,
        credentialSubject: {
          foo: oldDid2,
        },
      });
      nockRegistrarGetOrganizationDidDoc(oldDid1, {
        id: oldDid1,
        alsoKnownAs: [newDid1],
      });
      nockRegistrarGetOrganizationDidDoc(oldDid2, {
        id: oldDid2,
        alsoKnownAs: [newDid2],
      });
      nockRegistrarGetOrganizationDidDoc(oldDid3, {
        id: oldDid3,
        alsoKnownAs: [newDid3],
      });

      const payload = {
        all: true,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/refresh`,
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({});
      const tenant1FromDb = await mongoDb()
        .collection('tenants')
        .findOne(
          { _id: new ObjectId(tenant1._id) },
          { projection: { did: 1, dids: 1, serviceIds: 1 } }
        );
      expect(tenant1FromDb).toEqual({
        _id: new ObjectId(tenant1._id),
        did: newDid1,
        dids: [oldDid1, newDid1],
        serviceIds: [`${newDid1}#foo`],
      });
      const tenant2FromDb = await mongoDb()
        .collection('tenants')
        .findOne(
          { _id: new ObjectId(tenant2._id) },
          { projection: { did: 1, dids: 1 } }
        );
      expect(tenant2FromDb).toEqual({
        _id: new ObjectId(tenant2._id),
        did: newDid2,
        dids: [oldDid2, newDid2],
      });
      const tenant3FromDb = await mongoDb()
        .collection('tenants')
        .findOne(
          { _id: new ObjectId(tenant3._id) },
          { projection: { did: 1, aliases: 1 } }
        );
      expect(tenant3FromDb).toEqual({
        _id: new ObjectId(tenant3._id),
        did: oldDid3,
      });
      const offer1FromDb = await mongoDb()
        .collection('offers')
        .findOne(
          { _id: new ObjectId(offer1._id) },
          { projection: { 'issuer.id': 1 } }
        );
      expect(offer1FromDb).toEqual({
        _id: new ObjectId(offer1._id),
        issuer: {
          id: newDid1,
        },
      });
      const offer2FromDb = await mongoDb()
        .collection('offers')
        .findOne(
          { _id: new ObjectId(offer2._id) },
          { projection: { 'issuer.id': 1, 'credentialSubject.foo': 1 } }
        );
      expect(offer2FromDb).toEqual({
        _id: new ObjectId(offer2._id),
        issuer: {
          id: newDid2,
        },
        credentialSubject: { foo: newDid2 },
      });
    });
    it("should 200 if 'did' is passed and update a specific tenant and it's offers", async () => {
      const oldDid1 = 'did:test:foo1';
      const oldDid2 = 'did:test:foo2';
      const newDid1 = 'did:web:foo1';
      const tenant1 = await persistTenant({
        did: oldDid1,
        serviceIds: [`${oldDid1}#foo`],
      });
      const tenant2 = await persistTenant({
        did: oldDid2,
        serviceIds: [`${oldDid2}#foo`],
      });
      const disclosure1 = await persistDisclosure({ tenant: tenant1 });
      const disclosure2 = await persistDisclosure({ tenant: tenant2 });
      const user1 = await persistVendorUserIdMapping({ tenant: tenant1 });
      const user2 = await persistVendorUserIdMapping({ tenant: tenant2 });
      const exchange1 = await persistOfferExchange({
        tenant: tenant1,
        disclosure: disclosure1,
      });
      const exchange2 = await persistOfferExchange({
        tenant: tenant2,
        disclosure: disclosure2,
      });
      const offer1 = await persistOffer({
        tenant: tenant1,
        exchange: exchange1,
        user: user1,
      });
      const offer2 = await persistOffer({
        tenant: tenant2,
        exchange: exchange2,
        user: user2,
      });
      nockRegistrarGetOrganizationDidDoc(tenant1.did, {
        id: oldDid1,
        alsoKnownAs: [newDid1],
      });

      const payload = {
        did: tenant1.did,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/refresh`,
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({});
      const tenant1FromDb = await mongoDb()
        .collection('tenants')
        .findOne(
          { _id: new ObjectId(tenant1._id) },
          { projection: { did: 1, dids: 1, serviceIds: 1 } }
        );
      expect(tenant1FromDb).toEqual({
        _id: new ObjectId(tenant1._id),
        did: newDid1,
        dids: [oldDid1, newDid1],
        serviceIds: [`${newDid1}#foo`],
      });
      const tenant2FromDb = await mongoDb()
        .collection('tenants')
        .findOne(
          { _id: new ObjectId(tenant2._id) },
          { projection: { did: 1, dids: 1, serviceIds: 1 } }
        );
      expect(tenant2FromDb).toEqual({
        _id: new ObjectId(tenant2._id),
        did: oldDid2,
        serviceIds: [`${oldDid2}#foo`],
      });
      const offer1FromDb = await mongoDb()
        .collection('offers')
        .findOne(
          { _id: new ObjectId(offer1._id) },
          { projection: { 'issuer.id': 1 } }
        );
      expect(offer1FromDb).toEqual({
        _id: new ObjectId(offer1._id),
        issuer: {
          id: newDid1,
        },
      });
      const offer2FromDb = await mongoDb()
        .collection('offers')
        .findOne(
          { _id: new ObjectId(offer2._id) },
          { projection: { 'issuer.id': 1 } }
        );
      expect(offer2FromDb).toEqual({
        _id: new ObjectId(offer2._id),
        issuer: {
          id: oldDid2,
        },
      });
    });
  });
});
describe.skip('Private key to ethereum account test suite', () => {
  it('brute force eth account conversion with original jwk', () => {
    // This test is to showcase what is happening in
    // https://velocitycareerlabs.atlassian.net/browse/VL-4120
    // It will fail and should be skipped,
    // but running it should recreate the error observed on mainnet

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < 300; i++) {
      const keyPairJwkInternal = generateKeyPair({ format: 'jwk' });
      const privateJwkInternalToHex = hexFromJwk(
        keyPairJwkInternal.privateKey,
        true
      );
      const publicFromPrivateHex = publicKeyFromPrivateKey(
        privateJwkInternalToHex
      );
      const ethAccountFromPrivate = toEthereumAddress(privateJwkInternalToHex);

      // eslint-disable-next-line no-console
      console.log(`Will we finish iteration ${i}?: --------------`);
      const ethAccountFromPublic = toEthereumAddress(publicFromPrivateHex);
      expect(ethAccountFromPrivate).toEqual(ethAccountFromPublic);
    }
  });
  it('brute force eth account conversion with original hex', () => {
    // This test is different from the previous test in that it uses the
    // hexes coming directly out of generateKeyPair
    // results seem the same, possibly slightly more common

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < 300; i++) {
      const keyPairHexInternal = generateKeyPair({ format: 'hex' });
      const privateJwkInternalToHex = keyPairHexInternal.privateKey;
      const publicFromPrivateHex = publicKeyFromPrivateKey(
        privateJwkInternalToHex
      );
      const ethAccountFromPrivate = toEthereumAddress(privateJwkInternalToHex);

      // eslint-disable-next-line no-console
      console.log(`Will we finish iteration ${i}?: --------------`);
      const ethAccountFromPublic = toEthereumAddress(publicFromPrivateHex);
      expect(ethAccountFromPrivate).toEqual(ethAccountFromPublic);
    }
  });
});
