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

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const {
  mongoFactoryWrapper,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const { generateKeyPair } = require('@verii/crypto');

const {
  deployPermissionContract,
  deployVerificationCouponContract,
  deployRevocationContract,
  deployMetadataContract,
  deployerPrivateKey,
  rpcProvider,
  rpcUrl,
} = require('@verii/metadata-registration/test/helpers/deploy-contracts');
const { initPermissions } = require('@verii/contract-permissions');
const {
  toEthereumAddress,
} = require('@verii/blockchain-functions');
const { hexFromJwk, jwtDecode } = require('@verii/jwt');
const { ObjectId } = require('mongodb');
const nock = require('nock');
const { KeyPurposes } = require('@verii/crypto');
const { jwtVcExpectation } = require('./helpers/jwt-vc-expectation');
const buildFastify = require('./helpers/credentialagent-holder-build-fastify');
const {
  ExchangeStates,
  initTenantFactory,
  initKeysFactory,
  VendorEndpoint,
  initDisclosureFactory,
  initOfferExchangeFactory,
  initOfferFactory,
  initUserFactory,
} = require('../../src/entities');
const {
  nockCredentialTypes,
  freeCredentialTypesList,
} = require('./helpers/credential-type-metadata');
const {
  generateTestAccessToken,
} = require('./helpers/generate-test-access-token');

let fastify;
let persistTenant;
let persistDisclosure;
let persistKey;
let persistOffer;
let persistOfferExchange;
let persistVendorUserIdMapping;

describe('e2e issuing tests', () => {
  jest.setTimeout(45000);

  let tenant;
  let tenantKeys;
  let disclosure;
  let exchange;
  let user;
  let authToken;
  let offer;
  let keyPair;
  let operatorKeyPair;

  beforeAll(async () => {
    await mongoFactoryWrapper('test-credential-agent', {
      log: console,
    });
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});

    const contractContext = {
      log: console,
      config: {
        rpcUrl,
      },
    };

    const permissionsAddress = await deployPermissionContract();
    const verificationCouponAddress = await deployVerificationCouponContract(
      permissionsAddress,
      contractContext
    );
    const revocationContractAddress = await deployRevocationContract(
      permissionsAddress,
      contractContext
    );
    const metadataRegistryContractAddress = await deployMetadataContract(
      freeCredentialTypesList,
      verificationCouponAddress,
      permissionsAddress,
      contractContext
    );

    contractContext.config = {
      revocationContractAddress,
      metadataRegistryContractAddress,
    };

    const deployerPermissionsClient = await initPermissions(
      {
        privateKey: deployerPrivateKey,
        contractAddress: permissionsAddress,
        rpcProvider,
      },
      contractContext
    );
    await deployerPermissionsClient.addAddressScope({
      address: metadataRegistryContractAddress,
      scope: 'coupon:burn',
    });
    await mongoCloseWrapper();

    fastify = buildFastify({
      storeIssuerAsString: false,
      ...contractContext.config,
    });
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeysFactory(fastify));
    ({ persistDisclosure } = initDisclosureFactory(fastify));
    ({ persistOffer } = initOfferFactory(fastify));
    ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
    ({ persistVendorUserIdMapping } = initUserFactory(fastify));

    keyPair = generateKeyPair({ format: 'jwk' });
    tenant = await persistTenant({
      serviceIds: ['#foo-service-id-1'],
      primaryAddress: toEthereumAddress(keyPair.publicKey),
    });
    tenantKeys = await persistKey({
      tenant,
      kidFragment: '#key0',
      keyPair,
      purposes: [KeyPurposes.ISSUING_METADATA, KeyPurposes.EXCHANGES],
    });
    operatorKeyPair = generateKeyPair({ format: 'jwk' });
    await persistKey({
      tenant,
      kidFragment: '#key1',
      keyPair: operatorKeyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    await deployerPermissionsClient.addPrimary({
      primary: tenant.primaryAddress,
      permissioning: tenant.primaryAddress,
      rotation: tenant.primaryAddress,
    });
    await deployerPermissionsClient.addAddressScope({
      address: tenant.primaryAddress,
      scope: 'transactions:write',
    });
    await deployerPermissionsClient.addAddressScope({
      address: tenant.primaryAddress,
      scope: 'credential:issue',
    });
    await deployerPermissionsClient.addAddressScope({
      address: tenant.primaryAddress,
      scope: 'credential:contactissue',
    });

    const operatorPermissionsClient = await initPermissions(
      {
        privateKey: hexFromJwk(keyPair.privateKey),
        contractAddress: permissionsAddress,
        rpcProvider,
      },
      contractContext
    );
    await operatorPermissionsClient.addOperatorKey({
      primary: tenant.primaryAddress,
      operator: toEthereumAddress(operatorKeyPair.publicKey),
    });
  });

  beforeEach(async () => {
    jest.resetAllMocks();

    await mongoDb().collection('disclosures').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('offers').deleteMany({});
    await mongoDb().collection('vendorUserIdMappings').deleteMany({});
    await mongoDb().collection('allocations').deleteMany({});

    disclosure = await persistDisclosure({
      tenant,
      vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
    });

    user = await persistVendorUserIdMapping({ tenant });

    exchange = await persistOfferExchange({
      tenant,
      disclosure,
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        {
          state: ExchangeStates.IDENTIFIED,
          timestamp: new Date(),
        },
      ],
      vendorUserId: user.vendorUserId,
      challenge: 'challenge',
      challengeIssuedAt: 12341,
    });

    authToken = await genAuthToken(tenant, tenantKeys, exchange, user, keyPair);
    nockCredentialTypes();
    offer = await persistFinalizableOffer();
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  const persistFinalizableOffer = async (overrides = {}) => {
    const val = await persistOffer({
      tenant,
      exchange,
      ...overrides,
    });
    await mongoDb()
      .collection('exchanges')
      .updateOne(
        { _id: new ObjectId(exchange._id) },
        { $set: { offerIds: { $push: [new ObjectId(val._id)] } } }
      );
    return val;
  };

  it('should issue and anchor to the blockchain', async () => {
    // await updateExchangeOffersIds(exchangeId, [offer0._id]);
    const response = await fastify.injectJson({
      method: 'POST',
      url: issuingUrl(tenant, 'finalize-offers'),
      payload: {
        exchangeId: exchange._id,
        approvedOfferIds: [offer._id],
      },
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toHaveLength(1);
    expect(response.json).toEqual([expect.any(String)]);
    const vc = jwtDecode(response.json[0]);
    expect(vc).toEqual(
      jwtVcExpectation({
        tenant,
        credentialId: vc.payload.jti,
        offer,
      })
    );

    const metadataListAllocation = await mongoDb()
      .collection('allocations')
      .findOne({ entityName: 'metadataListAllocations' });
    expect(metadataListAllocation).toEqual({
      _id: expect.any(ObjectId),
      createdAt: expect.any(Date),
      currentListId: expect.any(Number),
      entityName: 'metadataListAllocations',
      freeIndexes: expect.any(Array),
      operatorAddress: toEthereumAddress(operatorKeyPair.publicKey),
      tenantId: new ObjectId(tenant._id),
      updatedAt: expect.any(Date),
    });
    const revocationListAllocation = await mongoDb()
      .collection('allocations')
      .findOne({ entityName: 'revocationListAllocations' });
    expect(revocationListAllocation).toEqual({
      _id: expect.any(ObjectId),
      createdAt: expect.any(Date),
      currentListId: expect.any(Number),
      entityName: 'revocationListAllocations',
      freeIndexes: expect.any(Array),
      operatorAddress: toEthereumAddress(operatorKeyPair.publicKey),
      tenantId: new ObjectId(tenant._id),
      updatedAt: expect.any(Date),
    });
  });
  it('should issue and anchor to the blockchain when legacy tenantKey doesnt contain publicKey', async () => {
    await mongoDb()
      .collection('keys')
      .updateMany({}, { $unset: { publicKey: 1 } });
    const response = await fastify.injectJson({
      method: 'POST',
      url: issuingUrl(tenant, 'finalize-offers'),
      payload: {
        exchangeId: exchange._id,
        approvedOfferIds: [offer._id],
      },
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toHaveLength(1);
    expect(response.json).toEqual([expect.any(String)]);
    const vc = jwtDecode(response.json[0]);
    expect(vc).toEqual(
      jwtVcExpectation({
        tenant,
        credentialId: vc.payload.jti,
        offer,
      })
    );

    const metadataListAllocation = await mongoDb()
      .collection('allocations')
      .findOne({ entityName: 'metadataListAllocations' });
    expect(metadataListAllocation).toEqual({
      _id: expect.any(ObjectId),
      createdAt: expect.any(Date),
      currentListId: expect.any(Number),
      entityName: 'metadataListAllocations',
      freeIndexes: expect.any(Array),
      operatorAddress: toEthereumAddress(operatorKeyPair.publicKey),
      tenantId: new ObjectId(tenant._id),
      updatedAt: expect.any(Date),
    });
    const revocationListAllocation = await mongoDb()
      .collection('allocations')
      .findOne({ entityName: 'revocationListAllocations' });
    expect(revocationListAllocation).toEqual({
      _id: expect.any(ObjectId),
      createdAt: expect.any(Date),
      currentListId: expect.any(Number),
      entityName: 'revocationListAllocations',
      freeIndexes: expect.any(Array),
      operatorAddress: toEthereumAddress(operatorKeyPair.publicKey),
      tenantId: new ObjectId(tenant._id),
      updatedAt: expect.any(Date),
    });
  });
  it('should issue and anchor to the blockchain when legacy tenantKey doesnt contain publicKey', async () => {
    await mongoDb()
      .collection('keys')
      .updateMany({}, { $unset: { publicKey: 1 } });
    const response = await fastify.injectJson({
      method: 'POST',
      url: issuingUrl(tenant, 'finalize-offers'),
      payload: {
        exchangeId: exchange._id,
        approvedOfferIds: [offer._id],
      },
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toHaveLength(1);
    expect(response.json).toEqual([expect.any(String)]);
    const vc = jwtDecode(response.json[0]);
    expect(vc).toEqual(
      jwtVcExpectation({
        tenant,
        credentialId: vc.payload.jti,
        offer,
      })
    );

    const metadataListAllocation = await mongoDb()
      .collection('allocations')
      .findOne({ entityName: 'metadataListAllocations' });
    expect(metadataListAllocation).toEqual({
      _id: expect.any(ObjectId),
      createdAt: expect.any(Date),
      currentListId: expect.any(Number),
      entityName: 'metadataListAllocations',
      freeIndexes: expect.any(Array),
      operatorAddress: toEthereumAddress(operatorKeyPair.publicKey),
      tenantId: new ObjectId(tenant._id),
      updatedAt: expect.any(Date),
    });
    const revocationListAllocation = await mongoDb()
      .collection('allocations')
      .findOne({ entityName: 'revocationListAllocations' });
    expect(revocationListAllocation).toEqual({
      _id: expect.any(ObjectId),
      createdAt: expect.any(Date),
      currentListId: expect.any(Number),
      entityName: 'revocationListAllocations',
      freeIndexes: expect.any(Array),
      operatorAddress: toEthereumAddress(operatorKeyPair.publicKey),
      tenantId: new ObjectId(tenant._id),
      updatedAt: expect.any(Date),
    });
  });
});

const issuingUrl = ({ did }, suffix = '') =>
  `/api/holder/v0.6/org/${did}/issue/${suffix}`;

const genAuthToken = async (tenant, tenantKeys, exchange, user, keyPair) =>
  generateTestAccessToken(
    exchange._id.toString(),
    tenant.did,
    user._id,
    null,
    null,
    '30d',
    null,
    keyPair.privateKey,
    tenantKeys.kidFragment
  );
