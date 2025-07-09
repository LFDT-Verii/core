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

const mockSendPush = jest.fn().mockResolvedValue(undefined);
const mockVerifyCredentials = jest.fn().mockResolvedValue(undefined);
// eslint-disable-next-line import/order
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const { ObjectId } = require('mongodb');
const { map } = require('lodash/fp');
const nock = require('nock');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { KeyPurposes, generateKeyPair } = require('@verii/crypto');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const { credentialUnexpired } = require('@verii/sample-data');
const metadataRegistration = require('@verii/metadata-registration');
const { CheckResults } = require('@verii/vc-checks');
const {
  initTenantFactory,
  initKeysFactory,
  initOfferExchangeFactory,
  initDisclosureFactory,
} = require('../../src/entities');

const buildCheckCredentialsUrl = ({ _id }) =>
  `/operator-api/v0.8/tenants/${_id}/check-credentials`;

jest.mock('@verii/metadata-registration');
jest.mock('@verii/verifiable-credentials', () => ({
  verifyCredentials: mockVerifyCredentials,
}));
jest.mock('../../src/fetchers', () => ({
  sendPush: mockSendPush,
}));

describe('Credentials checking tests', () => {
  let fastify;
  let persistTenant;
  let persistKey;
  let persistOfferExchange;
  let tenant;
  let persistDisclosure;

  const checkResult = {
    credential: {
      ...credentialUnexpired,
      issuer: {
        id: '0000',
        name: 'Velocity',
        image: 'https://velocity.com/image.png',
      },
    },
    credentialChecks: {
      TRUSTED_HOLDER: 'NOT_CHECKED',
      TRUSTED_ISSUER: 'NOT_CHECKED',
      UNEXPIRED: 'NOT_CHECKED',
      UNTAMPERED: 'NOT_CHECKED',
      UNREVOKED: 'NOT_CHECKED',
    },
  };

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeysFactory(fastify));
    ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
    ({ persistDisclosure } = initDisclosureFactory(fastify));
  });

  beforeEach(async () => {
    nock.cleanAll();
    jest.resetAllMocks();
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('disclosures').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});

    tenant = await persistTenant();

    nock('http://oracle.localhost.test')
      .get('/api/v0.6/credential-types', () => {
        return true;
      })
      .reply(200, [
        {
          credentialType: 'Passport',
          issuerCategory: 'ContactIssuer',
        },
      ]);
    mockVerifyCredentials.mockImplementationOnce(async ({ credentials }) => {
      switch (credentials[0]) {
        case '0000':
          return Promise.reject(new Error('BAD JWT!'));
        case '0001':
          return Promise.resolve([
            {
              credential: {
                ...credentialUnexpired,
                issuer: {
                  id: '0000',
                  name: 'Velocity',
                  image: 'https://velocity.com/image.png',
                },
              },
              credentialChecks: {
                TRUSTED_HOLDER: CheckResults.FAIL,
                TRUSTED_ISSUER: CheckResults.PASS,
                UNEXPIRED: CheckResults.PASS,
                UNREVOKED: CheckResults.PASS,
                UNTAMPERED: CheckResults.VOUCHER_RESERVE_EXHAUSTED,
              },
            },
          ]);
        default:
          return Promise.resolve([checkResult]);
      }
    });
    metadataRegistration.initRevocationRegistry.mockImplementation(() => ({
      getRevokedStatus: () => Promise.resolve(true),
    }));
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  it('Should return 400 when request is malformed', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload: {},
    });

    expect(response.statusCode).toEqual(400);
  });

  it("Should return 400 when pushData doesn't not have sendPush", async () => {
    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
      pushData: {},
    };
    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      "body/pushData must have required property 'sendPush'"
    );
  });

  it("Should return 400 when pushData doesn't not have exchangeId", async () => {
    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
      pushData: {
        sendPush: false,
      },
    };
    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      "body/pushData must have required property 'exchangeId'"
    );
  });

  it("Should return 400 when pushData doesn't not have pushUrl", async () => {
    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
      pushData: {
        sendPush: false,
        exchangeId: '123132',
        pushDelegate: {},
      },
    };
    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      "body/pushData/pushDelegate must have required property 'pushUrl'"
    );
  });

  it("Should return 400 when pushData doesn't not have pushToken", async () => {
    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
      pushData: {
        sendPush: false,
        exchangeId: '123132',
        pushDelegate: {
          pushUrl: 'token',
        },
      },
    };
    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      "body/pushData/pushDelegate must have required property 'pushToken'"
    );
  });

  it('Should return 500 when credential is not a valid JWT', async () => {
    const keyPair = generateKeyPair({ format: 'jwk' });

    await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: '0000',
        },
      ],
    };

    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(mockSendPush).toBeCalledTimes(0);
    expect(response.statusCode).toEqual(500);
  });

  it('Should return credential checks results when credential JWT is valid', async () => {
    const keyPair = generateKeyPair({ format: 'jwk' });

    const key = await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
    };

    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(mockSendPush).toBeCalledTimes(0);
    expect(mockVerifyCredentials.mock.calls).toEqual([
      [
        {
          credentials: map('rawCredential', payload.rawCredentials),
          relyingParty: { dltOperatorKMSKeyId: new ObjectId(key._id) },
        },
        {
          resolveDid: expect.any(Function),
          getOrganizationVerifiedProfile: expect.any(Function),
          getCredentialTypeMetadata: expect.any(Function),
        },
        expect.any(Object),
      ],
    ]);

    expect(response.statusCode).toEqual(200);
    expect(response.json.credentials[0].credentialChecks).toEqual(
      checkResult.credentialChecks
    );
  });

  it('Should return credential checks and not send pushNotification if pushData is present (sendPush is false)', async () => {
    const keyPair = generateKeyPair({ format: 'jwk' });

    await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    const pushDelegate = {
      pushUrl: 'urls',
      pushToken: 'token',
    };

    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
      pushData: {
        sendPush: false,
        exchangeId: '123123',
        pushDelegate,
      },
    };

    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(mockSendPush).toBeCalledTimes(0);

    expect(response.statusCode).toEqual(200);
    expect(response.json.credentials[0].credentialChecks).toEqual(
      checkResult.credentialChecks
    );
  });
  it('Should return credential checks and send pushNotification if pushData is present (sendPush is true)', async () => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    const { did } = tenant;

    await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    const pushDelegate = {
      pushUrl: 'urls',
      pushToken: 'token',
    };

    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
      pushData: {
        sendPush: true,
        exchangeId: '123123',
        pushDelegate,
      },
    };

    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(mockSendPush).toBeCalledTimes(1);
    expect(mockSendPush).toBeCalledWith(
      {
        data: {
          exchangeId: '123123',
          issuer: did,
          notificationType: 'PresentationVerified',
          serviceEndpoint: 'urls',
        },
        id: expect.any(String),
        pushToken: 'token',
      },
      pushDelegate,
      expect.any(Object)
    );

    expect(response.statusCode).toEqual(200);
    expect(response.json.credentials[0].credentialChecks).toEqual(
      checkResult.credentialChecks
    );
  });
  it('Should send pushNotification if pushData is true but disclosure is true', async () => {
    const keyPair = generateKeyPair({ format: 'jwk' });

    const pushDelegate = {
      pushUrl: 'urls',
      pushToken: 'token',
    };

    const disclosure = await persistDisclosure({
      tenant,
      sendPushOnVerification: false,
    });
    const exchange = await persistOfferExchange({
      tenant,
      disclosure,
      pushDelegate,
    });

    await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
      pushData: {
        sendPush: true,
        exchangeId: exchange._id,
        pushDelegate,
      },
    };

    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(mockSendPush).toBeCalledTimes(0);

    expect(response.statusCode).toEqual(200);
    expect(response.json.credentials[0].credentialChecks).toEqual(
      checkResult.credentialChecks
    );
  });
  it('Should send pushNotification if pushData is false but disclosure is true', async () => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    const { did } = tenant;

    const pushDelegate = {
      pushUrl: 'urls',
      pushToken: 'token',
    };

    const disclosure = await persistDisclosure({
      tenant,
      sendPushOnVerification: true,
    });
    const exchange = await persistOfferExchange({
      tenant,
      disclosure,
      pushDelegate,
    });

    await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
      pushData: {
        sendPush: true,
        exchangeId: exchange._id,
        pushDelegate,
      },
    };

    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(mockSendPush).toBeCalledTimes(1);
    expect(mockSendPush).toBeCalledWith(
      {
        data: {
          exchangeId: exchange._id,
          issuer: did,
          notificationType: 'PresentationVerified',
          serviceEndpoint: 'urls',
        },
        id: expect.any(String),
        pushToken: 'token',
      },
      pushDelegate,
      expect.any(Object)
    );

    expect(response.statusCode).toEqual(200);
    expect(response.json.credentials[0].credentialChecks).toEqual(
      checkResult.credentialChecks
    );
  });
  it('Should send pushNotification if pushData is false but disclosure is true and disclosure does not have', async () => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    const { did } = tenant;

    const pushDelegate = {
      pushUrl: 'urls',
      pushToken: 'token',
    };

    const disclosure = await persistDisclosure({
      tenant,
      sendPushOnVerification: true,
    });
    const exchange = await persistOfferExchange({
      tenant,
      disclosure,
      pushDelegate,
    });

    await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
      pushData: {
        sendPush: true,
        exchangeId: exchange._id,
        pushDelegate,
      },
    };

    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(mockSendPush).toBeCalledTimes(1);
    expect(mockSendPush).toBeCalledWith(
      {
        data: {
          exchangeId: exchange._id,
          issuer: did,
          notificationType: 'PresentationVerified',
          serviceEndpoint: 'urls',
        },
        id: expect.any(String),
        pushToken: 'token',
      },
      pushDelegate,
      expect.any(Object)
    );

    expect(response.statusCode).toEqual(200);
    expect(response.json.credentials[0].credentialChecks).toEqual(
      checkResult.credentialChecks
    );
  });
  it('Should not send pushNotification if pushData is true and sendPushOnVerification is not present', async () => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    const { did } = tenant;

    const pushDelegate = {
      pushUrl: 'urls',
      pushToken: 'token',
    };

    const disclosure = await persistDisclosure({ tenant });
    const exchange = await persistOfferExchange({
      tenant,
      disclosure,
      pushDelegate,
    });

    await mongoDb()
      .collection('disclosures')
      .updateOne(
        { _id: new ObjectId(disclosure._id) },
        { $unset: { sendPushOnVerification: '' } }
      );

    await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
      pushData: {
        sendPush: true,
        exchangeId: exchange._id,
        pushDelegate,
      },
    };

    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(mockSendPush).toBeCalledTimes(1);
    expect(mockSendPush).toBeCalledWith(
      {
        data: {
          exchangeId: exchange._id,
          issuer: did,
          notificationType: 'PresentationVerified',
          serviceEndpoint: 'urls',
        },
        id: expect.any(String),
        pushToken: 'token',
      },
      pushDelegate,
      expect.any(Object)
    );

    expect(response.statusCode).toEqual(200);
    expect(response.json.credentials[0].credentialChecks).toEqual(
      checkResult.credentialChecks
    );
  });
  it('Should not send pushNotification sendPushOnVerification is true and has corrupted pushDelegate', async () => {
    const keyPair = generateKeyPair({ format: 'jwk' });

    const pushDelegate = {
      pushUrl: 'urls',
      pushToken: 'token',
    };

    const disclosure = await persistDisclosure({
      tenant,
      sendPushOnVerification: true,
    });
    const exchange = await persistOfferExchange({
      tenant,
      disclosure,
      pushDelegate: {
        pushUrl: 'urla',
      },
    });

    await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
      pushData: {
        sendPush: false,
        exchangeId: exchange._id,
        pushDelegate,
      },
    };

    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(mockSendPush).toBeCalledTimes(0);

    expect(response.statusCode).toEqual(200);
    expect(response.json.credentials[0].credentialChecks).toEqual(
      checkResult.credentialChecks
    );
  });
  it('Should send pushNotification sendPushOnVerification is true and has corrupted pushDelegate and pushData is correct', async () => {
    const keyPair = generateKeyPair({ format: 'jwk' });

    const pushDelegate = {
      pushUrl: 'urls',
      pushToken: 'token',
    };

    const disclosure = await persistDisclosure({
      tenant,
      sendPushOnVerification: true,
    });
    const exchange = await persistOfferExchange({
      tenant,
      disclosure,
      pushDelegate: {
        pushUrl: 'urla',
      },
    });

    await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: 'RAW-CREDENTIAL',
        },
      ],
      pushData: {
        sendPush: true,
        exchangeId: exchange._id,
        pushDelegate,
      },
    };

    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(mockSendPush).toBeCalledTimes(1);

    expect(response.statusCode).toEqual(200);
    expect(response.json.credentials[0].issuer).toEqual({
      id: '0000',
      name: 'Velocity',
      image: 'https://velocity.com/image.png',
    });
    expect(response.json.credentials[0].credentialChecks).toEqual(
      checkResult.credentialChecks
    );
  });

  it('Should return 402 when a coupon was not provided', async () => {
    const keyPair = generateKeyPair({ format: 'jwk' });

    await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    const payload = {
      rawCredentials: [
        {
          id: 'did:velocity:0x0000',
          rawCredential: '0001',
        },
      ],
    };

    const response = await fastify.injectJson({
      method: 'POST',
      url: buildCheckCredentialsUrl(tenant),
      payload,
    });

    expect(response.json).toEqual(
      errorResponseMatcher({
        error: 'Bad Request',
        errorCode: 'payment_required',
        message: 'No voucher was provided to process the request',
        statusCode: 400,
      })
    );
  });
});
