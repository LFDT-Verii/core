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

const mockLookupPrimary = mock.fn();
const mockContractPermissionsModule = {
  initPermissions: mock.fn(() => ({ lookupPrimary: mockLookupPrimary })),
};
const {
  mockHttpClientJsonRoute,
  mockHttpClientModule,
} = require('../helpers/mock-http-client');

mock.module('@verii/contract-permissions', {
  namedExports: mockContractPermissionsModule,
});

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { first, map, omit, pick } = require('lodash/fp');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const { errorResponseMatcher, mongoify } = require('@verii/tests-helpers');
const {
  generateKeyPair,
  KeyPurposes,
  KeyEncodings,
  publicKeyFromPrivateKey,
} = require('@verii/crypto');
const { toEthereumAddress } = require('@verii/blockchain-functions');

const { applyOverrides } = require('@verii/common-functions');
const createTestFastify = require('../helpers/create-test-fastify');
const { buildIssuerDidDoc } = require('../helpers/build-issuer-did-doc');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { CihKeyPurposes, initKeyFactory } = require('../../src/entities/keys');
const {
  TenantErrors,
} = require('../../src/entities/tenants/domain/tenant-errors');

describe('Tenants management test suite', () => {
  let fastify;
  let newTenant;
  let persistTenant;
  let persistKey;
  let persistIssuerService;
  let orgDoc;
  let orgKeys;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();

    ({ persistTenant, newTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ didDoc: orgDoc, keys: orgKeys } = buildIssuerDidDoc());
  });

  beforeEach(async () => {
    fastify.resetOverrides();
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });

  describe('Tenant Creation Tests', () => {
    const createUrl = '/operator/tenants/create';
    const newTenantMinimalPayload = async (overrides) =>
      pick(['did', 'name', 'logo'], await newTenant(overrides));

    it('should 404 when DID document is empty', async () => {
      const { didDoc, keys } = buildIssuerDidDoc();
      setupCreateTenantRegistrarMocks(didDoc.id, {});

      const payload = {
        tenant: await newTenantMinimalPayload({ did: didDoc.id }),
        keys,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'did_document_not_found',
          message: 'did_document_not_found',
          statusCode: 400,
        }),
      );
    });

    it('should 404 when registrar returns 404', async () => {
      const { didDoc, keys } = buildIssuerDidDoc();
      const payload = {
        tenant: await newTenantMinimalPayload({ did: didDoc.id }),
        keys,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'did_document_not_found',
          message: 'did_document_not_found',
          statusCode: 400,
        }),
      );
    });

    it('should 400 and not create tenant or keys when no key purpose is provided', async () => {
      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: [{ ...first(orgKeys), purposes: [] }],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: 'body/keys/0/purposes must NOT have fewer than 1 items',
          statusCode: 400,
        }),
      );
    });

    it('should 400 and not create tenant or keys when a key purpose is not recognized', async () => {
      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: [{ ...first(orgKeys), purposes: ['unrecognized-purpose'] }],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            'body/keys/0/purposes/0 must be equal to one of the allowed values',
          statusCode: 400,
        }),
      );
    });

    it('should 400 and not create tenant or keys when a key purpose is duplicated', async () => {
      setupCreateTenantRegistrarMocks(orgDoc.id, orgDoc);
      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: orgKeys.concat(orgKeys),
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'key_purposes_not_unique',
          message: 'key_purposes_not_unique',
          statusCode: 400,
        }),
      );
    });

    it('should 400 and not create tenant or keys when a key algorithm is not recognized', async () => {
      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: [
          {
            purposes: ['DLT_TRANSACTIONS'],
            algorithm: 'unrecognized-algorithm',
            encoding: 'hex',
            kidFragment: first(orgDoc.assertionMethod),
            key: orgKeys,
          },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            'body/keys/0/algorithm must be equal to one of the allowed values',
          statusCode: 400,
        }),
      );
    });

    it('should 400 and not create tenant or keys when a key encoding is not recognized', async () => {
      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: [{ ...first(orgKeys), encoding: 'unrecognized-encoding' }],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            'body/keys/0/encoding must be equal to one of the allowed values',
          statusCode: 400,
        }),
      );
    });

    it('should 400 and not create tenant or keys when a kid fragment is duplicated', async () => {
      setupCreateTenantRegistrarMocks(orgDoc.id, orgDoc);
      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: [
          { ...first(orgKeys), purposes: ['DLT_TRANSACTIONS'] },
          { ...first(orgKeys), purposes: ['ISSUING_METADATA'] },
        ],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'key_kidFragment_not_unique',
          message: 'key_kidFragment_not_unique',
          statusCode: 400,
        }),
      );
    });

    it('should 400 and not create tenant or keys when a key service is not found on document', async () => {
      setupCreateTenantRegistrarMocks(orgDoc.id, orgDoc);

      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: [{ ...first(orgKeys), kidFragment: '#not-found-kid' }],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'key_kidFragment_not_found',
          message: 'key_kidFragment_not_found',
          statusCode: 400,
        }),
      );
    });

    it('should 400 and if no keys set', async () => {
      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: [],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: 'body/keys must NOT have fewer than 1 items',
          statusCode: 400,
        }),
      );
    });

    it('should 400 and if key with DLT_TRANSACTION does not exist', async () => {
      setupCreateTenantRegistrarMocks(orgDoc.id, orgDoc);

      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: [{ ...first(orgKeys), purposes: [KeyPurposes.EXCHANGES] }],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'dlt_transaction_key_required',
          message: 'dlt_transaction_key_required',
          statusCode: 400,
        }),
      );
    });

    it('should 400 if key with EXCHANGES does not exist', async () => {
      setupCreateTenantRegistrarMocks(orgDoc.id, orgDoc);

      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: [{ ...first(orgKeys), purposes: [KeyPurposes.DLT_TRANSACTIONS] }],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'exchanges_key_required',
          message: 'exchanges_key_required',
          statusCode: 400,
        }),
      );
    });

    it('should 400 if config.defaultCaoDid is not set and caoDID is not specified', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        defaultCaoDid: undefined,
      });

      setupCreateTenantRegistrarMocks(orgDoc.id, orgDoc);

      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: orgKeys,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: TenantErrors.CAO_DID_REQUIRED,
          message: TenantErrors.CAO_DID_REQUIRED,
        }),
      );
    });

    it('should 400 when name is missing', async () => {
      const tenantPayload = omit(['name'], await newTenantMinimalPayload());
      const payload = {
        tenant: tenantPayload,
        keys: orgKeys,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/tenant must have required property 'name'",
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when logo is missing', async () => {
      const tenantPayload = omit(['logo'], await newTenantMinimalPayload());
      const payload = {
        tenant: tenantPayload,
        keys: orgKeys,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/tenant must have required property 'logo'",
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when logo is invalid', async () => {
      const tenantPayload = await newTenantMinimalPayload({ logo: 'fooLogo' });
      const payload = {
        tenant: tenantPayload,
        keys: orgKeys,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/tenant/logo must match format "uri"',
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when name does not match profile', async () => {
      setupCreateTenantRegistrarMocks(orgDoc.id, orgDoc);
      const tenantPayload = await newTenantMinimalPayload({
        did: orgDoc.id,
        name: 'barName',
      });
      const payload = {
        tenant: tenantPayload,
        keys: orgKeys,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'name_must_match_profile',
          errorCode: 'name_must_match_profile',
        }),
      );
    });

    it('should 400 when logo does not match profile', async () => {
      setupCreateTenantRegistrarMocks(orgDoc.id, orgDoc);
      const tenantPayload = await newTenantMinimalPayload({
        did: orgDoc.id,
        logo: 'https://localhost.test/barlogo.png',
      });
      const payload = {
        tenant: tenantPayload,
        keys: orgKeys,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'logo_must_match_profile',
          errorCode: 'logo_must_match_profile',
        }),
      );
    });

    it('should 400 and not create duplicate tenant', async () => {
      setupCreateTenantRegistrarMocks(orgDoc.id, orgDoc);

      await persistTenant({
        did: orgDoc.id,
      });

      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: orgKeys,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          error: 'Bad Request',
          message: 'tenant_must_be_unique',
          errorCode: 'tenant_must_be_unique',
        }),
      );
      const tenantDocumentsCount = await mongoDb()
        .collection('tenants')
        .countDocuments();
      expect(tenantDocumentsCount).toEqual(1);
    });

    it('should 200 and create tenant, key entities with 1 purpose & defaults, name and logo matching profile root', async () => {
      const primaryAccount = toEthereumAddress(
        generateKeyPair({ format: 'jwk' }).publicKey,
      );
      mockLookupPrimary.mock.mockImplementation(() =>
        Promise.resolve(primaryAccount),
      );
      setupCreateTenantRegistrarMocks(orgDoc.id, orgDoc);

      const payload = {
        tenant: await newTenantMinimalPayload({ did: orgDoc.id }),
        keys: orgKeys,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        tenant: expectedTenant(payload.tenant, { primaryAccount }),
        keyMetadatas: expectedKeyMetadatas(payload.keys),
        requestId: expect.any(String),
      });

      const tenantFromDb = await loadDbTenant(response.json.tenant.id);

      expect(tenantFromDb).toEqual({
        _id: new ObjectId(response.json.tenant.id),
        did: orgDoc.id,
        primaryAccount,
        caoDid: 'did:ion:e89fYWr0Lkfd_pa18fdk',
        hostUrl: 'https://localhost.test',
        keysByPurpose: {
          [KeyPurposes.DLT_TRANSACTIONS]: expectedTenantKeyByPurpose(
            orgKeys[0],
          ),
          [KeyPurposes.EXCHANGES]: expectedTenantKeyByPurpose(orgKeys[0]),
          [KeyPurposes.ISSUING_METADATA]: expectedTenantKeyByPurpose(
            orgKeys[0],
          ),
          [CihKeyPurposes.HOLDER_ACCESS_TOKENS]: expectedTenantKeyByPurpose({
            encoding: KeyEncodings.BASE64URL,
          }),
        },
        logo: 'https://localhost.test/logo.png',
        name: 'fooName',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const dbKeys = await loadDbKeys(response.json.tenant.id);
      expect(dbKeys).toEqual(
        expect.arrayContaining([
          {
            _id: new ObjectId(response.json.keyMetadatas[0].id),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            tenantId: new ObjectId(response.json.tenant.id),
            publicJwk: publicKeyFromPrivateKey(payload.keys[0].jwk),
            encryptedJwk: expect.any(String),
            ...omit(['jwk'], payload.keys[0]),
          },
          {
            _id: expect.any(ObjectId),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            tenantId: new ObjectId(response.json.tenant.id),
            encryptedSecret: expect.any(String),
            encoding: KeyEncodings.BASE64URL,
            purposes: [CihKeyPurposes.HOLDER_ACCESS_TOKENS],
          },
        ]),
      );
    });

    // eslint-disable-next-line max-len
    it('should 200 and create tenant, multiple key entities & overridden primaryAddress, hostUrl, caoDID, and name and logo matching profile commercialEntity', async () => {
      const { didDoc: orgDoc2, keys: orgKeys2 } = buildIssuerDidDoc({
        keyPerPurpose: true,
      });
      const primaryAccount = toEthereumAddress(
        generateKeyPair({ format: 'jwk' }).publicKey,
      );
      setupCreateTenantRegistrarMocks(orgDoc2.id, orgDoc2, {
        commercialEntities: [
          {
            name: 'barName',
            logo: 'https://localhost.test/bar.png',
          },
        ],
      });

      const tenantPayload = {
        ...(await newTenantMinimalPayload({
          did: orgDoc2.id,
          name: 'barName',
          logo: 'https://localhost.test/bar.png',
        })),
        primaryAccount,
        caoDid: orgDoc2.id,
        hostUrl: 'https://example.com',
      };
      const payload = {
        tenant: tenantPayload,
        keys: orgKeys2,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        tenant: expectedTenant(payload.tenant),
        keyMetadatas: expectedKeyMetadatas(payload.keys),
        requestId: expect.any(String),
      });

      const tenantFromDb = await loadDbTenant(response.json.tenant.id);

      expect(tenantFromDb).toEqual({
        _id: new ObjectId(response.json.tenant.id),
        primaryAccount,
        caoDid: 'did:ion:e89fYWr0Lkfd_pa18fdk',
        hostUrl: 'https://localhost.test',
        ...payload.tenant,
        keysByPurpose: {
          [KeyPurposes.DLT_TRANSACTIONS]: expectedTenantKeyByPurpose(
            orgKeys2[0],
          ),
          [KeyPurposes.EXCHANGES]: expectedTenantKeyByPurpose(orgKeys2[1]),
          [KeyPurposes.ISSUING_METADATA]: expectedTenantKeyByPurpose(
            orgKeys2[2],
          ),
          [CihKeyPurposes.HOLDER_ACCESS_TOKENS]: expectedTenantKeyByPurpose({
            encoding: KeyEncodings.BASE64URL,
          }),
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const dbKeys = await loadDbKeys(response.json.tenant.id);
      expect(dbKeys).toEqual(
        expect.arrayContaining([
          {
            _id: new ObjectId(response.json.keyMetadatas[0].id),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            tenantId: new ObjectId(response.json.tenant.id),
            publicJwk: publicKeyFromPrivateKey(payload.keys[0].jwk),
            encryptedJwk: expect.any(String),
            ...omit(['jwk'], payload.keys[0]),
          },
          {
            _id: expect.any(ObjectId),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            tenantId: new ObjectId(response.json.tenant.id),
            encryptedSecret: expect.any(String),
            encoding: KeyEncodings.BASE64URL,
            purposes: [CihKeyPurposes.HOLDER_ACCESS_TOKENS],
          },
        ]),
      );
    });

    it('should 200 if creating tenant with did:web', async () => {
      const primaryAccount = toEthereumAddress(
        generateKeyPair({ format: 'jwk' }).publicKey,
      );
      mockLookupPrimary.mock.mockImplementation(() =>
        Promise.resolve(primaryAccount),
      );

      const { didDoc, keys } = buildIssuerDidDoc({ didMethod: 'web' });
      setupCreateTenantRegistrarMocks(didDoc.id, didDoc);

      const tenantPayload = {
        ...(await newTenantMinimalPayload({
          did: didDoc.id,
        })),
        hostUrl: 'http://other.host',
      };
      const payload = {
        tenant: tenantPayload,
        keys,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: createUrl,
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        tenant: expectedTenant(payload.tenant, { primaryAccount }),
        keyMetadatas: expectedKeyMetadatas(payload.keys),
        requestId: expect.any(String),
      });

      const tenantFromDb = await loadDbTenant(response.json.tenant.id);
      expect(tenantFromDb).toEqual({
        _id: new ObjectId(response.json.tenant.id),
        did: didDoc.id,
        primaryAccount,
        caoDid: 'did:ion:e89fYWr0Lkfd_pa18fdk',
        hostUrl: 'http://other.host',
        logo: 'https://localhost.test/logo.png',
        name: 'fooName',
        keysByPurpose: {
          [KeyPurposes.DLT_TRANSACTIONS]: expectedTenantKeyByPurpose(keys[0]),
          [KeyPurposes.EXCHANGES]: expectedTenantKeyByPurpose(keys[0]),
          [KeyPurposes.ISSUING_METADATA]: expectedTenantKeyByPurpose(keys[0]),
          [CihKeyPurposes.HOLDER_ACCESS_TOKENS]: expectedTenantKeyByPurpose({
            encoding: KeyEncodings.BASE64URL,
          }),
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const dbKeys = await loadDbKeys(response.json.tenant.id);
      expect(dbKeys).toEqual(
        expect.arrayContaining([
          {
            _id: new ObjectId(response.json.keyMetadatas[0].id),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            tenantId: new ObjectId(response.json.tenant.id),
            encryptedJwk: expect.any(String),
            publicJwk: publicKeyFromPrivateKey(payload.keys[0].jwk),
            ...omit(['jwk'], payload.keys[0]),
          },
          {
            _id: expect.any(ObjectId),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            tenantId: new ObjectId(response.json.tenant.id),
            encryptedSecret: expect.any(String),
            encoding: KeyEncodings.BASE64URL,
            purposes: [CihKeyPurposes.HOLDER_ACCESS_TOKENS],
          },
        ]),
      );
    });
  });

  describe('Tenant Deletion Tests', () => {
    const deleteUrl = '/operator/tenants/delete';
    let tenants;
    let keys;
    beforeEach(async () => {
      tenants = await Promise.all([persistTenant(), persistTenant()]);
      keys = await Promise.all(
        map((tenant) => persistKey({ tenant }), tenants),
      );
    });
    it('should 400 when no tenantId sent', async () => {
      const payload = {};
      const response = await fastify.injectJson({
        method: 'POST',
        url: deleteUrl,
        payload,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: "body must have required property 'tenantId'",
          statusCode: 400,
        }),
      );
    });
    it('should 404 when tenant not found', async () => {
      const payload = { tenantId: new ObjectId() };
      const response = await fastify.injectJson({
        method: 'POST',
        url: deleteUrl,
        payload,
      });
      expect(response.statusCode).toEqual(404);
    });
    it('should 400 when related issuer service still exists', async () => {
      const issuerService = await persistIssuerService({ tenant: tenants[0] });
      const payload = { tenantId: tenants[0]._id };
      const response = await fastify.injectJson({
        method: 'POST',
        url: deleteUrl,
        payload,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'related_service_undeleted',
          message: `Issuer Service(s) ${issuerService._id} must be deleted before deleting tenant`,
          statusCode: 400,
        }),
      );
    });

    it('should 200 & delete tenant and cascade keys', async () => {
      const payload = { tenantId: tenants[0]._id };
      const response = await fastify.injectJson({
        method: 'POST',
        url: deleteUrl,
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({ requestId: expect.any(String) });

      // delete tenant and keys removed
      await expect(loadDbTenant(tenants[0]._id)).resolves.toBeNull();

      await expect(loadDbKeys(tenants[0]._id)).resolves.toEqual([]);

      // not deleted tenant and keys exist
      await expect(loadDbTenant(tenants[1]._id)).resolves.toEqual(
        mongoify(tenants[1]),
      );

      await expect(loadDbKeys(tenants[1]._id)).resolves.toEqual([
        mongoify({ ...keys[1], encryptedJwk: expect.any(String) }),
      ]);
    });
  });

  describe('Get tenants tests', () => {
    const getUrl = '/operator/tenants/get';
    let tenants;
    beforeEach(async () => {
      tenants = await Promise.all([
        persistTenant(),
        persistTenant(),
        persistTenant(),
      ]);
    });

    it('should return empty array if there are no tenants', async () => {
      await mongoDb().collection('tenants').deleteMany({});

      const response = await fastify.injectJson({
        method: 'GET',
        url: getUrl,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        tenants: [],
        requestId: expect.any(String),
      });
    });

    it('should return empty array if tenantId doesnt exist', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${getUrl}?tenantId=${new ObjectId()}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        tenants: [],
        requestId: expect.any(String),
      });
    });

    it('should return one tenant', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${getUrl}?tenantId=${tenants[1]._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        tenants: [expectedTenant(tenants[1])],
        requestId: expect.any(String),
      });
    });

    it('should return all tenants', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: getUrl,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        tenants: expect.arrayContaining(map(expectedTenant, tenants)),
        requestId: expect.any(String),
      });
      expect(response.json.tenants).toHaveLength(3);
    });
  });

  const loadDbTenant = (tenantId) =>
    mongoDb()
      .collection('tenants')
      .findOne({
        _id: new ObjectId(tenantId),
      });

  const loadDbKeys = (tenantId) =>
    mongoDb()
      .collection('keys')
      .find({
        tenantId: new ObjectId(tenantId),
      })
      .toArray();
});

const expectedTenant = (tenant, overrides) =>
  applyOverrides(
    {
      id: tenant._id ?? expect.stringMatching(OBJECT_ID_FORMAT),
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      hostUrl: 'https://localhost.test',
      caoDid: 'did:ion:e89fYWr0Lkfd_pa18fdk',
      logo: 'https://localhost.test/logo.png',
      name: 'fooName',
      ...omit(['_id'], tenant),
    },
    overrides,
  );

const expectedKeyMetadatas = map((key) => ({
  id: expect.stringMatching(OBJECT_ID_FORMAT),
  createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
  ...omit(['jwk'], key),
}));

const expectedTenantKeyByPurpose = (key) => ({
  _id: expect.any(ObjectId),
  publicJwk: key.jwk ? publicKeyFromPrivateKey(key.jwk) : undefined,
  ...omit(['jwk', 'purposes'], key),
});

const setupCreateTenantRegistrarMocks = (did, didDoc, profileOverrides) => {
  const didParam = encodeURIComponent(did);
  mockHttpClientJsonRoute('get', `api/v0.6/resolve-did/${didParam}`, didDoc);
  mockHttpClientJsonRoute(
    'get',
    `api/v0.6/organizations/${didParam}/verified-profile`,
    {
      credentialSubject: {
        name: 'fooName',
        logo: 'https://localhost.test/logo.png',
        ...profileOverrides,
      },
    },
  );
};
