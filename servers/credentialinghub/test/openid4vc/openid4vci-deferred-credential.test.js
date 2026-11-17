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
const { describe, it, after, before, beforeEach, mock } = require('node:test');
const { expect } = require('expect');
const { ALG_TYPE } = require('@verii/metadata-registration');

const mockAddRevocationListSigned = mock.fn();
const mockAddCredentialMetadataEntry = mock.fn();

mock.module('@verii/metadata-registration', {
  namedExports: {
    ALG_TYPE,
    initRevocationRegistry: () => ({
      addRevocationListSigned: mockAddRevocationListSigned,
    }),
    initMetadataRegistry: () => ({
      addCredentialMetadataEntry: mockAddCredentialMetadataEntry,
      createCredentialMetadataList: mock.fn(),
    }),
  },
});
const { calcSha384, generateKeyPair } = require('@verii/crypto');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { ObjectId } = require('mongodb');
const {
  mockHttpClientModule,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { jwtDecode, jwtSign } = require('@verii/jwt');
const { getUnixTime } = require('date-fns');
const { DID_FORMAT, NANO_ID_FORMAT } = require('@verii/test-regexes');
const { mongoify } = require('@verii/tests-helpers');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initDepotFactory } = require('../../src/entities/depots');
const { initCredentialFactory } = require('../../src/entities/credentials');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');

const PREAUTH_CODE = 'deferred-preauth-code';

describe('openid4vc deferred credential test suite', () => {
  let fastify;

  let persistTenant;
  let persistIssuerService;
  let persistKey;
  let persistDepot;
  let persistCredential;

  let tenant;
  let issuerKeyPair;
  let holderDid;
  let holderKeyPair;

  let issuerService;
  let depot;
  let authToken;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistCredential } = initCredentialFactory(fastify));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('issuerKeys').deleteMany({});

    ({ tenant, issuerKeyPair } = await constructTenant(
      persistTenant,
      persistKey,
    ));
  });

  beforeEach(async () => {
    resetMockHttpClient();
    mockAddRevocationListSigned.mock.resetCalls();
    mockAddCredentialMetadataEntry.mock.resetCalls();
    await mongoDb().collection('allocations').deleteMany({});
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
    await mongoDb().collection('openid4vciTransactions').deleteMany({});

    holderKeyPair = generateKeyPair({ format: 'jwk' });
    holderDid = getDidUriFromJwk(holderKeyPair.publicKey);
    issuerService = await persistIssuerService({ tenant });
    depot = await persistDepot({
      tenant,
      service: issuerService,
      preauthCode: PREAUTH_CODE,
      deferredCredentials: true,
      expectedCredentialTypes: ['Employment', 'EmailV1.0'],
    });
    authToken = await buildAuthToken(depot);
  });

  after(async () => {
    await fastify.close();
    mock.reset();
  });

  describe('credential endpoint with a deferred credential identifier', () => {
    it('should 202 with a transaction_id and interval when no credential of the type can be claimed, and store only its hash', async () => {
      const acceptedCredential = await persistCredential({
        tenant,
        depot,
        acceptedAt: new Date(),
      });

      const response = await requestDeferredIdentifier();

      expect(response.statusCode).toEqual(202);
      expect(response.json).toEqual({
        transaction_id: expect.stringMatching(/^[\w-]{32}$/),
        interval: 30,
      });
      await expect(findTransactions()).resolves.toEqual([
        {
          _id: expect.any(ObjectId),
          tenantId: new ObjectId(tenant._id),
          depotId: new ObjectId(depot._id),
          serviceId: new ObjectId(issuerService._id),
          transactionIdHash: calcSha384(response.json.transaction_id),
          credentialType: 'Employment',
          credentialSubjectId: holderDid,
          status: 'pending',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);
      await expect(findCredential(acceptedCredential)).resolves.toEqual(
        mongoify(acceptedCredential),
      );
    });

    it('should 200 with the credential at once when one of the type can be claimed', async () => {
      const credential = await persistCredential({ tenant, depot });

      const response = await requestDeferredIdentifier();

      expect(response.statusCode).toEqual(200);
      expectCredentialResponse(response);
      await expectIssued(credential, response);
    });

    it('should 400 with unknown_credential_identifier for a type the depot does not expect', async () => {
      const response = await requestDeferredIdentifier({
        credentialIdentifier: 'deferred:PhoneV1.0',
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual({
        error: 'unknown_credential_identifier',
        error_description: 'Error identifying credential deferred:PhoneV1.0',
      });
      await expect(findTransactions()).resolves.toEqual([]);
    });

    it('should 400 with unknown_credential_identifier for a depot that expects no types', async () => {
      const otherDepot = await persistDepot({
        tenant,
        service: issuerService,
        deferredCredentials: true,
      });

      const response = await requestDeferredIdentifier({
        token: await buildAuthToken(otherDepot),
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual({
        error: 'unknown_credential_identifier',
        error_description: 'Error identifying credential deferred:Employment',
      });
      await expect(findTransactions()).resolves.toEqual([]);
    });

    it('should 400 with unknown_credential_identifier for a depot without deferred credentials', async () => {
      const otherDepot = await persistDepot({
        tenant,
        service: issuerService,
        expectedCredentialTypes: ['Employment'],
      });

      const response = await requestDeferredIdentifier({
        token: await buildAuthToken(otherDepot),
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual({
        error: 'unknown_credential_identifier',
        error_description: 'Error identifying credential deferred:Employment',
      });
      await expect(findTransactions()).resolves.toEqual([]);
    });

    it('should 400 with invalid_proof and store no transaction if the proof has no nonce', async () => {
      const proof = await buildProof(undefined);

      const response = await requestCredential(proof, 'deferred:Employment');

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual({
        error: 'invalid_proof',
        error_description: "Credential request proof jwt is missing a 'nonce'.",
      });
      await expect(findTransactions()).resolves.toEqual([]);
    });
  });

  describe('deferred credential endpoint', () => {
    it('should 202 until a credential of the type is added, then 200 with a credential bound to the proof DID', async () => {
      const { transaction_id: transactionId } = (
        await requestDeferredIdentifier()
      ).json;

      const waitingResponse = await requestDeferredCredential(transactionId);

      expect(waitingResponse.statusCode).toEqual(202);
      expect(waitingResponse.json).toEqual({
        transaction_id: transactionId,
        interval: 30,
      });
      await expect(findTransactions()).resolves.toEqual([
        expect.objectContaining({ status: 'pending' }),
      ]);

      const credential = await persistCredential({ tenant, depot });
      const response = await requestDeferredCredential(transactionId);

      expect(response.statusCode).toEqual(200);
      expectCredentialResponse(response);
      await expectIssued(credential, response);
    });

    it('should 400 with invalid_transaction_id for a repeated request', async () => {
      const { transaction_id: transactionId } = (
        await requestDeferredIdentifier()
      ).json;
      await persistCredential({ tenant, depot });
      await persistCredential({ tenant, depot });
      const firstResponse = await requestDeferredCredential(transactionId);
      expect(firstResponse.statusCode).toEqual(200);

      const response = await requestDeferredCredential(transactionId);

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(invalidTransactionIdResponse);
      await expect(
        mongoDb()
          .collection('credentials')
          .countDocuments({ did: { $exists: true } }),
      ).resolves.toEqual(1);
    });

    it('should accept a notification for the signed transaction, then 400 with invalid_transaction_id for a poll', async () => {
      const { transaction_id: transactionId } = (
        await requestDeferredIdentifier()
      ).json;
      const credential = await persistCredential({ tenant, depot });
      const response = await requestDeferredCredential(transactionId);
      expect(response.statusCode).toEqual(200);

      const notificationResponse = await fastify.injectJson({
        method: 'POST',
        url: `/r/${tenant._id}/openid4vc/notification`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          notification_id: response.json.notification_id,
          event: 'credential_accepted',
        },
      });

      expect(notificationResponse.statusCode).toEqual(204);
      expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(1);
      await expect(findTransactions()).resolves.toEqual([
        expect.objectContaining({
          status: 'accepted',
          acceptedAt: expect.any(Date),
        }),
      ]);
      await expect(findCredential(credential)).resolves.toEqual(
        expect.objectContaining({ acceptedAt: expect.any(Date) }),
      );

      const pollResponse = await requestDeferredCredential(transactionId);
      expect(pollResponse.statusCode).toEqual(400);
      expect(pollResponse.json).toEqual(invalidTransactionIdResponse);
    });

    it('should deny the transaction at the next poll after depots/resolve-deferred-credentials with nothing to claim', async () => {
      const { transaction_id: transactionId } = (
        await requestDeferredIdentifier()
      ).json;

      await resolveDeferredCredentials();
      await expect(findTransactions()).resolves.toEqual([
        expect.objectContaining({ status: 'pending' }),
      ]);

      const response = await requestDeferredCredential(transactionId);

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(deniedResponse('Employment'));
      await expect(findTransactions()).resolves.toEqual([
        expect.objectContaining({ status: 'denied' }),
      ]);

      await persistCredential({ tenant, depot });
      const repeatResponse = await requestDeferredCredential(transactionId);
      expect(repeatResponse.statusCode).toEqual(400);
      expect(repeatResponse.json).toEqual(deniedResponse('Employment'));
    });

    it('should keep pending a transaction whose type has something to claim when the others are denied', async () => {
      const { transaction_id: employmentTransactionId } = (
        await requestDeferredIdentifier()
      ).json;
      const { transaction_id: emailTransactionId } = (
        await requestDeferredIdentifier({
          credentialIdentifier: 'deferred:EmailV1.0',
        })
      ).json;
      const credential = await persistCredential({ tenant, depot });

      await resolveDeferredCredentials();

      const emailResponse = await requestDeferredCredential(emailTransactionId);
      expect(emailResponse.statusCode).toEqual(400);
      expect(emailResponse.json).toEqual(deniedResponse('EmailV1.0'));

      const response = await requestDeferredCredential(employmentTransactionId);
      expect(response.statusCode).toEqual(200);
      const vcJwt = response.json.credentials[0].credential;
      expect(jwtDecode(vcJwt).payload.sub).toEqual(holderDid);
      await expect(findCredential(credential)).resolves.toEqual(
        expect.objectContaining({
          did: expect.stringMatching(DID_FORMAT),
          jwtVc: vcJwt,
        }),
      );
    });

    it("should 400 with invalid_transaction_id for another depot's access token", async () => {
      const otherDepot = await persistDepot({
        tenant,
        service: issuerService,
      });
      const { transaction_id: transactionId } = (
        await requestDeferredIdentifier()
      ).json;
      const credential = await persistCredential({ tenant, depot });

      const response = await requestDeferredCredential(transactionId, {
        token: await buildAuthToken(otherDepot),
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(invalidTransactionIdResponse);
      await expect(findCredential(credential)).resolves.toEqual(
        mongoify(credential),
      );
    });

    it('should 400 with invalid_transaction_id for an unknown transaction', async () => {
      const response = await requestDeferredCredential('foo');

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(invalidTransactionIdResponse);
    });

    it('should keep returning 202 for a transaction created after the last depots/resolve-deferred-credentials', async () => {
      await resolveDeferredCredentials();
      const { transaction_id: transactionId } = (
        await requestDeferredIdentifier()
      ).json;

      const response = await requestDeferredCredential(transactionId);

      expect(response.statusCode).toEqual(202);
      expect(response.json).toEqual({
        transaction_id: transactionId,
        interval: 30,
      });
      await expect(findTransactions()).resolves.toEqual([
        expect.objectContaining({ status: 'pending' }),
      ]);
    });

    it('should 400 with invalid_transaction_id once the depot is deleted', async () => {
      const { transaction_id: transactionId } = (
        await requestDeferredIdentifier()
      ).json;
      const deleteResponse = await fastify.injectJson({
        method: 'POST',
        url: '/operator/depots/delete',
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depotId: depot._id,
        },
      });
      expect(deleteResponse.statusCode).toEqual(200);

      const response = await requestDeferredCredential(transactionId);

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(invalidTransactionIdResponse);
      await expect(findTransactions()).resolves.toEqual([
        expect.objectContaining({ status: 'pending' }),
      ]);
    });

    it('should not sign one credential for two concurrent transactions', async () => {
      const transactionIds = [
        (await requestDeferredIdentifier()).json.transaction_id,
        (await requestDeferredIdentifier()).json.transaction_id,
      ];
      const credential = await persistCredential({ tenant, depot });

      const responses = await Promise.all(
        transactionIds.map((transactionId) =>
          requestDeferredCredential(transactionId),
        ),
      );

      expect(responses.map(({ statusCode }) => statusCode).sort()).toEqual([
        200, 202,
      ]);
      const transactions = await findTransactions();
      expect(transactions.map(({ status }) => status).sort()).toEqual([
        'pending',
        'signed',
      ]);
      const signedTransaction = transactions.find(
        ({ status }) => status === 'signed',
      );
      await expect(findCredential(credential)).resolves.toEqual(
        expect.objectContaining({
          did: expect.stringMatching(DID_FORMAT),
          deferredTransactionId: signedTransaction._id,
        }),
      );
      expect(signedTransaction.credentialId).toEqual(
        new ObjectId(credential._id),
      );
      expect(mockAddRevocationListSigned.mock.callCount()).toEqual(1);
    });

    it('should 500 with server_error if signing fails, release the claim and keep the transaction pending', async () => {
      const { transaction_id: transactionId } = (
        await requestDeferredIdentifier()
      ).json;
      const credential = await persistCredential({ tenant, depot });
      mockAddRevocationListSigned.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('error')),
      );

      const response = await requestDeferredCredential(transactionId);

      expect(response.statusCode).toEqual(500);
      expect(response.json).toEqual({
        error: 'server_error',
        error_description:
          'revocationRegistry.addWalletToRegistrySigned is not a function',
      });
      await expect(findCredential(credential)).resolves.toEqual(
        mongoify(credential),
      );
      const [transaction] = await findTransactions();
      expect(transaction).toEqual(
        expect.objectContaining({
          status: 'pending',
          err: 'revocationRegistry.addWalletToRegistrySigned is not a function',
        }),
      );
      expect(transaction).not.toHaveProperty('credentialId');
      expect(transaction).not.toHaveProperty('notificationId');

      const retryResponse = await requestDeferredCredential(transactionId);

      expect(retryResponse.statusCode).toEqual(200);
      await expectIssued(credential, retryResponse);
    });

    it('should leave the credential unclaimed and the transaction pending if the service lookup fails', async (t) => {
      const { transaction_id: transactionId } = (
        await requestDeferredIdentifier()
      ).json;
      const credential = await persistCredential({ tenant, depot });
      const collectionPrototype = Object.getPrototypeOf(
        mongoDb().collection('issuerServices'),
      );
      const { findOne } = collectionPrototype;
      t.mock.method(
        collectionPrototype,
        'findOne',
        function failIssuerServices(...args) {
          return this.collectionName === 'issuerServices'
            ? Promise.reject(new Error('lookup failed'))
            : findOne.apply(this, args);
        },
      );

      const response = await requestDeferredCredential(transactionId);

      expect(response.statusCode).toEqual(500);
      await expect(findCredential(credential)).resolves.toEqual(
        mongoify(credential),
      );
      await expect(findTransactions()).resolves.toEqual([
        expect.objectContaining({ status: 'pending' }),
      ]);

      t.mock.restoreAll();
      const retryResponse = await requestDeferredCredential(transactionId);

      expect(retryResponse.statusCode).toEqual(200);
      await expectIssued(credential, retryResponse);
    });

    it('should accept a new access token from the same pre-authorized code after the first one expired', async () => {
      const firstToken = await requestAccessToken();
      const { transaction_id: transactionId } = (
        await requestDeferredIdentifier({ token: firstToken })
      ).json;
      const credential = await persistCredential({ tenant, depot });
      const expiredToken = await buildAuthToken(depot, {
        exp: getUnixTime(new Date()) - 3600,
      });
      const expiredResponse = await requestDeferredCredential(transactionId, {
        token: expiredToken,
      });
      expect(expiredResponse.statusCode).toEqual(401);

      const response = await requestDeferredCredential(transactionId, {
        token: await requestAccessToken(),
      });

      expect(response.statusCode).toEqual(200);
      await expectIssued(credential, response);
    });

    it('should 401 with invalid_token without an access token', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `/r/${tenant._id}/openid4vc/deferred_credential`,
        payload: { transaction_id: 'foo' },
      });

      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual({
        error: 'invalid_token',
        error_description: 'invalid_token',
      });
    });

    it('should 400 with invalid_credential_request without a transaction_id', async () => {
      const response = await requestDeferredCredential(undefined);

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual({
        error: 'invalid_credential_request',
        error_description: expect.any(String),
      });
    });

    it('should 400 with invalid_encryption_parameters if response encryption is requested', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `/r/${tenant._id}/openid4vc/deferred_credential`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          transaction_id: 'foo',
          credential_response_encryption: {
            jwk: { ...holderKeyPair.publicKey, alg: 'ECDH-ES' },
            enc: 'A256GCM',
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual({
        error: 'invalid_encryption_parameters',
        error_description:
          'The credential issuer does not support credential response encryption',
      });
    });
  });

  const buildAuthToken = (tokenDepot, payload = {}) =>
    jwtSign(
      { depot_id: `${tokenDepot._id}`, ...payload },
      issuerKeyPair.privateKey,
      {
        subject: `https://localhost.test/r/${tenant._id}`,
      },
    );

  const requestAccessToken = async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: `/r/${tenant._id}/oauth/token`,
      body: `grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code&pre-authorized_code=${PREAUTH_CODE}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    expect(response.statusCode).toEqual(200);
    return response.json().access_token;
  };

  const requestNonce = async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/nonce`,
    });
    return response.json.c_nonce;
  };

  const buildProof = async (nonce) => ({
    proof_type: 'jwt',
    jwt: await jwtSign(
      {
        aud: `https://localhost.test/r/${tenant._id}`,
        nonce,
        iss: holderDid,
      },
      holderKeyPair.privateKey,
      { alg: 'ES256K', typ: 'openid4vci-proof+jwt', kid: `${holderDid}#0` },
    ),
  });

  const requestCredential = (proof, credentialIdentifier, token = authToken) =>
    fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/credential`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        credential_identifier: credentialIdentifier,
        proofs: { jwt: [proof.jwt] },
      },
    });

  const requestDeferredIdentifier = async ({
    credentialIdentifier = 'deferred:Employment',
    token = authToken,
  } = {}) =>
    requestCredential(
      await buildProof(await requestNonce()),
      credentialIdentifier,
      token,
    );

  const requestDeferredCredential = (
    transactionId,
    { token = authToken } = {},
  ) =>
    fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/deferred_credential`,
      headers: { authorization: `Bearer ${token}` },
      payload: { transaction_id: transactionId },
    });

  const resolveDeferredCredentials = () =>
    fastify.injectJson({
      method: 'POST',
      url: '/operator/depots/resolve-deferred-credentials',
      payload: { tenantId: tenant._id, depotId: depot._id },
    });

  const findTransactions = () =>
    mongoDb().collection('openid4vciTransactions').find({}).toArray();

  const findCredential = (credential) =>
    mongoDb()
      .collection('credentials')
      .findOne({ _id: new ObjectId(credential._id) });

  const expectCredentialResponse = (response) =>
    expect(response.json).toEqual({
      credentials: [{ credential: expect.any(String) }],
      notification_id: expect.stringMatching(NANO_ID_FORMAT),
    });

  const expectIssued = async (credential, response) => {
    const vcJwt = response.json.credentials[0].credential;
    expect(jwtDecode(vcJwt).payload.sub).toEqual(holderDid);
    const [transaction] = await findTransactions();
    expect(transaction).toEqual(
      expect.objectContaining({
        status: 'signed',
        credentialType: 'Employment',
        credentialSubjectId: holderDid,
        credentialId: new ObjectId(credential._id),
        notificationId: response.json.notification_id,
        credentialMetadata: expect.objectContaining({
          credentialType: 'Employment',
        }),
      }),
    );
    const dbCredential = await findCredential(credential);
    expect(dbCredential).toEqual(
      expect.objectContaining({
        did: expect.stringMatching(DID_FORMAT),
        credentialSubjectId: holderDid,
        jwtVc: vcJwt,
        deferredTransactionId: transaction._id,
      }),
    );
    expect(dbCredential).not.toHaveProperty('exchange');
  };
});

const deniedResponse = (credentialType) => ({
  error: 'credential_request_denied',
  error_description: `No ${credentialType} credential can be issued`,
});

const invalidTransactionIdResponse = {
  error: 'invalid_transaction_id',
  error_description: 'Error identifying the deferred credential transaction',
};
