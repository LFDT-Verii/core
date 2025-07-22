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
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');

const { mongoDb } = require('@spencejs/spence-mongo-repos');

const metadataRegistration = require('@verii/metadata-registration');
const nock = require('nock');
const { mongoify, errorResponseMatcher } = require('@verii/tests-helpers');
const { generateKeyPair, KeyPurposes } = require('@verii/crypto');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { ObjectId } = require('mongodb');
const { hexFromJwk } = require('@verii/jwt');
const {
  initOfferFactory,
  initTenantFactory,
  initKeysFactory,
  initOfferExchangeFactory,
  exchangeRepoPlugin,
} = require('../../src/entities');

jest.mock(
  '../../src/fetchers/push-gateway/generate-push-gateway-token',
  () => ({ generatePushGatewayToken: () => Promise.resolve('token') })
);
jest.mock('@verii/metadata-registration');
const testPushEndpointURL = new URL('https://push.localhost.test/push');

const getUrl = (tenant, credentialId) =>
  `/operator-api/v0.8/tenants/${tenant._id}/issued-credentials/${credentialId}/revoke`;

describe('Credentials checking tests', () => {
  const keyPair = generateKeyPair({ format: 'jwk' });
  const primaryPair = generateKeyPair();
  const primaryAddress = toEthereumAddress(primaryPair.privateKey);

  let fastify;
  let tenant;
  let exchange;
  let persistTenant;
  let persistKey;
  let persistOffer;
  let persistOfferExchange;
  let exchangeRepo;
  let credentialId;
  let mockSetRevokedStatusSigned;
  let offer;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistOffer } = initOfferFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeysFactory(fastify));
    ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  beforeEach(async () => {
    nock.cleanAll();
    jest.resetAllMocks();
    await mongoDb().collection('offers').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});

    tenant = await persistTenant({
      primaryAddress,
    });
    await persistKey({
      tenant,
      kidFragment: '#ID2',
      keyPair,
    });
    exchangeRepo = exchangeRepoPlugin(fastify)({
      tenant: { ...tenant, _id: new ObjectId(tenant._id) },
    });

    exchange = await persistOfferExchange({
      tenant,
      pushDelegate: {
        pushToken: 'token',
        pushUrl: testPushEndpointURL.href,
      },
    });
    const didSuffix = Array(40)
      .fill(0)
      .map(() => Math.random().toString(36).charAt(2))
      .join('');
    credentialId = `did:velocity:${didSuffix}`;
    offer = await persistOffer({
      did: credentialId,
      tenant,
      type: ['SomeType'],
      credentialStatus: {
        id: `ethereum:0xB457b50B6914A17Be513eD17c4aF9A9FECDB164C/getRevokedStatus?address=${primaryAddress}&listId=1000257453&index=5681`,
      },
      exchange,
    });
    await exchangeRepo.update(exchange._id, {
      finalizedOfferIds: [new ObjectId(offer._id)],
    });

    mockSetRevokedStatusSigned = jest.fn(() => Promise.resolve({}));
    metadataRegistration.initRevocationRegistry.mockResolvedValue({
      setRevokedStatusSigned: mockSetRevokedStatusSigned,
    });
  });

  it('Should return 200 when the credential is revoked successfully', async () => {
    let pushBody;
    const nockedPushEndpoint = nock(testPushEndpointURL.origin)
      .post(testPushEndpointURL.pathname, (body) => {
        pushBody = body;
        return body;
      })
      .reply(204, null);

    const response = await fastify.injectJson({
      method: 'POST',
      url: getUrl(tenant, credentialId),
      payload: {},
    });

    expect(response.statusCode).toEqual(200);
    const dbOffer = await mongoDb()
      .collection('offers')
      .findOne({ did: credentialId });

    expect(dbOffer).toEqual({
      ...mongoify(offer),
      tenantId: new ObjectId(tenant._id),
      did: credentialId,
      notifiedOfRevocationAt: expect.any(Date),
      credentialStatus: {
        ...offer.credentialStatus,
        revokedAt: expect.any(Date),
      },
      updatedAt: expect.any(Date),
    });

    expect(metadataRegistration.initRevocationRegistry.mock.calls).toEqual([
      [
        expect.objectContaining({
          privateKey: hexFromJwk(keyPair.privateKey, true),
        }),
        expect.any(Object),
      ],
    ]);

    expect(mockSetRevokedStatusSigned).toHaveBeenCalledWith({
      accountId: primaryAddress,
      caoDid: 'did:ion:cao',
      index: '5681',
      listId: '1000257453',
    });
    expect(nockedPushEndpoint.isDone()).toEqual(true);
    expect(pushBody).toEqual({
      data: {
        count: 1,
        credentialId,
        credentialTypes: ['SomeType'],
        issuer: tenant.did,
        exchangeId: expect.any(String),
        notificationType: 'CredentialRevoked',
      },
      id: expect.any(String),
      pushToken: 'token',
    });
  });

  it('Should fallback to using the REVOCATIONS_FALLBACK key', async () => {
    const fallbackKeyPair = generateKeyPair({ format: 'jwk' });
    await persistKey({
      tenant,
      kidFragment: '#ID3',
      keyPair: fallbackKeyPair,
      purposes: [KeyPurposes.REVOCATIONS_FALLBACK],
    });

    exchange = await persistOfferExchange({
      tenant,
    });
    const didSuffix = Array(40)
      .fill(0)
      .map(() => Math.random().toString(36).charAt(2))
      .join('');
    const altCredentialId = `did:velocity:${didSuffix}`;
    const altOffer = await persistOffer({
      did: altCredentialId,
      tenant,
      type: ['SomeType'],
      credentialStatus: {
        id: `ethereum:0xB457b50B6914A17Be513eD17c4aF9A9FECDB164C/getRevokedStatus?address=${toEthereumAddress(
          hexFromJwk(fallbackKeyPair.publicKey, false)
        )}&listId=1000257453&index=5682`,
      },
      exchange,
    });

    const response = await fastify.injectJson({
      method: 'POST',
      url: getUrl(tenant, altCredentialId),
      payload: {},
    });
    const dbOffer = await mongoDb().collection('offers').findOne({
      did: altCredentialId,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({});

    expect(dbOffer).toEqual({
      ...mongoify(altOffer),
      tenantId: new ObjectId(tenant._id),
      did: altCredentialId,
      credentialStatus: {
        ...altOffer.credentialStatus,
        revokedAt: expect.any(Date),
      },
      updatedAt: expect.any(Date),
    });

    expect(metadataRegistration.initRevocationRegistry).toHaveBeenCalledWith(
      expect.objectContaining({
        privateKey: hexFromJwk(fallbackKeyPair.privateKey),
      }),
      expect.any(Object)
    );
    expect(mockSetRevokedStatusSigned).toHaveBeenCalledWith({
      accountId: primaryAddress,
      caoDid: 'did:ion:cao',
      index: '5682',
      listId: '1000257453',
    });
  });

  it('Should not return notifiedOfRevocationAt when pushDelegate.pushToken is absent', async () => {
    exchange = await persistOfferExchange({
      tenant,
      pushDelegate: {
        pushUrl: testPushEndpointURL.href,
      },
    });
    const didSuffix = Array(40)
      .fill(0)
      .map(() => Math.random().toString(36).charAt(2))
      .join('');
    const altCredentialId = `did:velocity:${didSuffix}`;
    const altOffer = await persistOffer({
      did: altCredentialId,
      tenant,
      type: ['SomeType'],
      credentialStatus: {
        id: `ethereum:0xB457b50B6914A17Be513eD17c4aF9A9FECDB164C/getRevokedStatus?address=${primaryAddress}&listId=1000257453&index=5682`,
      },
      exchange,
    });

    const response = await fastify.injectJson({
      method: 'POST',
      url: getUrl(tenant, altCredentialId),
      payload: {},
    });
    const dbOffer = await mongoDb().collection('offers').findOne({
      did: altCredentialId,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({});

    expect(dbOffer).toEqual({
      ...mongoify(altOffer),
      tenantId: new ObjectId(tenant._id),
      did: altCredentialId,
      credentialStatus: {
        ...altOffer.credentialStatus,
        revokedAt: expect.any(Date),
      },
      updatedAt: expect.any(Date),
    });

    expect(mockSetRevokedStatusSigned).toHaveBeenCalledWith({
      accountId: primaryAddress,
      caoDid: 'did:ion:cao',
      index: '5682',
      listId: '1000257453',
    });
  });

  it('Should not return notifiedOfRevocationAt when pushDelegate.pushUrl is absent', async () => {
    exchange = await persistOfferExchange({
      tenant,
      pushDelegate: {
        pushToken: 'foo',
      },
    });
    const didSuffix = Array(40)
      .fill(0)
      .map(() => Math.random().toString(36).charAt(2))
      .join('');
    const altCredentialId = `did:velocity:${didSuffix}`;
    const altOffer = await persistOffer({
      did: altCredentialId,
      tenant,
      type: ['SomeType'],
      credentialStatus: {
        id: `ethereum:0xB457b50B6914A17Be513eD17c4aF9A9FECDB164C/getRevokedStatus?address=${primaryAddress}&listId=1000257453&index=5682`,
      },
      exchange,
    });

    const response = await fastify.injectJson({
      method: 'POST',
      url: getUrl(tenant, altCredentialId),
      payload: {},
    });
    const dbOffer = await mongoDb().collection('offers').findOne({
      did: altCredentialId,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({});
    expect(dbOffer).toEqual({
      ...mongoify(altOffer),
      tenantId: new ObjectId(tenant._id),
      did: altCredentialId,
      credentialStatus: {
        ...altOffer.credentialStatus,
        revokedAt: expect.any(Date),
      },
      updatedAt: expect.any(Date),
    });
    expect(mockSetRevokedStatusSigned).toHaveBeenCalledWith({
      accountId: primaryAddress,
      caoDid: 'did:ion:cao',
      index: '5682',
      listId: '1000257453',
    });
  });

  it('Should return 200 when the credential is already revoked', async () => {
    let pushBody;
    const nockedPushEndpoint = nock(testPushEndpointURL.origin)
      .post(testPushEndpointURL.pathname, (body) => {
        pushBody = body;
        return body;
      })
      .reply(204, null);
    const response = await fastify.injectJson({
      method: 'POST',
      url: getUrl(tenant, credentialId),
      payload: {},
    });
    expect(response.statusCode).toEqual(200);
    expect(pushBody).toEqual({
      data: {
        count: 1,
        credentialId,
        credentialTypes: ['SomeType'],
        issuer: tenant.did,
        exchangeId: expect.any(String),
        notificationType: 'CredentialRevoked',
      },
      id: expect.any(String),
      pushToken: 'token',
    });
    expect(mockSetRevokedStatusSigned).toHaveBeenCalledTimes(1);

    const twicedRevokedResponse = await fastify.injectJson({
      method: 'POST',
      url: getUrl(tenant, credentialId),
      payload: {},
    });
    expect(twicedRevokedResponse.statusCode).toEqual(200);
    expect(twicedRevokedResponse.json).toEqual({});

    expect(mockSetRevokedStatusSigned).toHaveBeenCalledTimes(1);
    expect(nockedPushEndpoint.isDone()).toEqual(true);
  });

  it('Should be the valid push parameters when it requests with the linkedOffer', async () => {
    let pushBody;
    const nockedPushEndpoint = nock(testPushEndpointURL.origin)
      .post(testPushEndpointURL.pathname, (body) => {
        pushBody = body;
        return body;
      })
      .reply(204, null);

    const response = await fastify.injectJson({
      method: 'POST',
      url: getUrl(tenant, credentialId),
      payload: {
        message: 'Some custom message instead of the generated default message',
        linkedOffer: { credentialType: 'SomeCredentialType' },
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      notifiedOfRevocationAt: expect.any(String),
    });

    expect(mockSetRevokedStatusSigned).toHaveBeenCalledWith({
      accountId: primaryAddress,
      caoDid: 'did:ion:cao',
      index: '5681',
      listId: '1000257453',
    });

    expect(nockedPushEndpoint.isDone()).toEqual(true);
    expect(pushBody).toEqual({
      data: {
        count: 1,
        credentialId,
        credentialTypes: ['SomeType'],
        issuer: tenant.did,
        exchangeId: expect.any(String),
        notificationType: 'CredentialReplaced',
        replacementCredentialType: 'SomeCredentialType',
      },
      id: expect.any(String),
      message: 'Some custom message instead of the generated default message',
      pushToken: 'token',
    });
  });

  it('Should be the valid push parameters when it requests custom message', async () => {
    let pushBody;
    const nockedPushEndpoint = nock(testPushEndpointURL.origin)
      .post(testPushEndpointURL.pathname, (body) => {
        pushBody = body;
        return body;
      })
      .reply(204, null);

    const response = await fastify.injectJson({
      method: 'POST',
      url: getUrl(tenant, credentialId),
      payload: {
        message: 'Some custom message instead of the generated default message',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      notifiedOfRevocationAt: expect.any(String),
    });

    expect(mockSetRevokedStatusSigned).toHaveBeenCalledWith({
      accountId: primaryAddress,
      caoDid: 'did:ion:cao',
      index: '5681',
      listId: '1000257453',
    });

    expect(nockedPushEndpoint.isDone()).toEqual(true);
    expect(pushBody).toEqual({
      data: {
        count: 1,
        credentialId,
        credentialTypes: ['SomeType'],
        issuer: tenant.did,
        exchangeId: expect.any(String),
        notificationType: 'CredentialRevoked',
      },
      id: expect.any(String),
      message: 'Some custom message instead of the generated default message',
      pushToken: 'token',
    });
  });

  it('Should return 404 when credential is not exist', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: getUrl(tenant, 'unexistedId'),
      payload: {},
    });
    expect(response.statusCode).toEqual(404);
  });

  it('Should return 400 when credential status is not exist', async () => {
    await mongoDb()
      .collection('offers')
      .updateOne({ did: credentialId }, { $set: { credentialStatus: null } });
    const response = await fastify.injectJson({
      method: 'POST',
      url: getUrl(tenant, credentialId),
      payload: {},
    });
    expect(response.statusCode).toEqual(400);
  });

  it('Should return 500 when the blockchain doesnt respond', async () => {
    mockSetRevokedStatusSigned.mockRejectedValue(
      new Error('Transaction failed')
    );
    const response = await fastify.injectJson({
      method: 'POST',
      url: getUrl(tenant, credentialId),
      payload: {},
    });
    expect(response.statusCode).toEqual(500);
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 500,
        error: 'Internal Server Error',
        errorCode: 'missing_error_code',
        message: expect.stringContaining('Transaction failed'),
      })
    );

    expect(mockSetRevokedStatusSigned).toHaveBeenCalledWith({
      accountId: primaryAddress,
      caoDid: 'did:ion:cao',
      index: '5681',
      listId: '1000257453',
    });
  });
});
