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
const { describe, it, after, before, beforeEach, mock } = require('node:test');
const { expect } = require('expect');
const {
  mockHttpClientModule,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });
const mockAddCredentialMetadataEntry = mock.fn();
const mockCreateCredentialMetadataList = mock.fn();
const mockAddRevocationListSigned = mock.fn();
mock.module('@verii/metadata-registration', {
  namedExports: {
    ...require('@verii/metadata-registration'),
    initRevocationRegistry: () => ({
      addRevocationListSigned: mockAddRevocationListSigned,
    }),
    initMetadataRegistry: () => ({
      addCredentialMetadataEntry: mockAddCredentialMetadataEntry,
      createCredentialMetadataList: mockCreateCredentialMetadataList,
    }),
    initVerificationCoupon: () => ({}),
  },
});
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { jwtSign } = require('@verii/jwt');
const { mongoify } = require('@verii/tests-helpers');
const { ObjectId } = require('mongodb');
const { nanoid } = require('nanoid');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initDepotFactory } = require('../../src/entities/depots');
const { initCredentialFactory } = require('../../src/entities/credentials');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');

describe('openid4vc notification test suite', () => {
  let fastify;

  let persistTenant;
  let persistIssuerService;
  let persistKey;
  let persistDepot;
  let persistCredential;

  let tenant;
  let issuerKeyPair;

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
    mockCreateCredentialMetadataList.mock.resetCalls();
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
    await mongoDb().collection('openid4vciTransactions').deleteMany({});
    await mongoDb().collection('notifications').deleteMany({});
  });

  after(async () => {
    await fastify.close();
    mock.reset();
  });

  const persistSignedTransaction = async (credentialOverrides) => {
    const issuerService = await persistIssuerService({ tenant });
    const depot = await persistDepot({ tenant, service: issuerService });
    const credential = await persistCredential({
      tenant,
      depot,
      ...credentialOverrides,
    });
    const transaction = {
      tenantId: new ObjectId(tenant._id),
      depotId: new ObjectId(depot._id),
      serviceId: new ObjectId(issuerService._id),
      credentialId: new ObjectId(credential._id),
      credentialSubjectId: 'did:jwk:holder',
      notificationId: nanoid(12),
      status: 'signed',
      credentialMetadata: {
        isNewList: true,
        listId: 1,
        index: 2,
        contentHash: 'foo',
        algType: 'aes-256-gcm',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await mongoDb().collection('openid4vciTransactions').insertOne(transaction);
    return { credential, depot, transaction };
  };

  const sendNotification = async (payload, depot) => {
    const authToken = await jwtSign(
      { depot_id: `${depot._id}` },
      issuerKeyPair.privateKey,
      {
        subject: `https://localhost.test/r/${tenant._id}`,
      },
    );
    return fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/notification`,
      headers: { authorization: `Bearer ${authToken}` },
      payload,
    });
  };

  const findCredentialInDb = (credential) =>
    mongoDb()
      .collection('credentials')
      .findOne({ _id: new ObjectId(credential._id) });

  const findTransactionInDb = (transaction) =>
    mongoDb()
      .collection('openid4vciTransactions')
      .findOne({ _id: transaction._id });

  describe('openid4vc notification test suite', () => {
    describe('openid4vc notification endpoint error cases', () => {
      it("should 400 with invalid_notification_request when missing 'notification_id'", async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/notification`,
          payload: { foo: 'bar' },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'invalid_notification_request',
          error_description:
            "body must have required property 'notification_id'",
        });
      });
      it("should 400 with invalid_notification_request when missing 'event'", async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/notification`,
          payload: { notification_id: 'foo' },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'invalid_notification_request',
          error_description: "body must have required property 'event'",
        });
      });
      it("should 400 with invalid_notification_request when 'event' is malformed", async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/notification`,
          payload: { notification_id: 'foo', event: 'foo' },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'invalid_notification_request',
          error_description:
            'body/event must be equal to one of the allowed values',
        });
      });
      it("should 400 with invalid_notification_request when 'event' is malformed", async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/notification`,
          payload: { notification_id: 'foo', event: 'foo' },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'invalid_notification_request',
          error_description:
            'body/event must be equal to one of the allowed values',
        });
      });
      it('should 401 with invalid_token', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/notification`,
          headers: {
            authorization: 'Bearer foo',
          },
          payload: { notification_id: 'foo', event: 'credential_accepted' },
        });
        expect(response.statusCode).toEqual(401);
        expect(response.json).toEqual({
          error: 'invalid_token',
          error_description: 'invalid_token',
        });
      });
      it('should 400 with invalid_notification_id', async () => {
        const authToken = await jwtSign(
          { depot_id: `${new ObjectId()}` },
          issuerKeyPair.privateKey,
          {
            subject: `https://localhost.test/r/${tenant._id}`,
          },
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/notification`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: { notification_id: 'foo', event: 'credential_accepted' },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'invalid_notification_id',
          error_description: 'Error identifying notification foo',
        });
      });
      it("should 400 with invalid_notification_id for another depot's transaction", async () => {
        const { credential, transaction } = await persistSignedTransaction();
        const otherDepot = await persistDepot({
          tenant,
          service: await persistIssuerService({ tenant }),
        });

        const response = await sendNotification(
          {
            notification_id: transaction.notificationId,
            event: 'credential_accepted',
          },
          otherDepot,
        );

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'invalid_notification_id',
          error_description: `Error identifying notification ${transaction.notificationId}`,
        });
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
        expect(await findTransactionInDb(transaction)).toEqual(transaction);
        expect(await findCredentialInDb(credential)).toEqual(
          mongoify(credential),
        );
      });
      it('should 400 with server_error due to anchoring error', async () => {
        const errorMessage = 'Mock Error';
        mockAddCredentialMetadataEntry.mock.mockImplementationOnce(() =>
          Promise.reject(new Error(errorMessage)),
        );
        const { credential, depot, transaction } =
          await persistSignedTransaction();

        const response = await sendNotification(
          {
            notification_id: transaction.notificationId,
            event: 'credential_accepted',
          },
          depot,
        );

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'server_error',
          error_description: errorMessage,
        });
        expect(await findTransactionInDb(transaction)).toEqual({
          ...transaction,
          err: errorMessage,
          updatedAt: expect.any(Date),
        });
        expect(await findCredentialInDb(credential)).toEqual(
          mongoify(credential),
        );
      });
      it('should 400 if career_issuing_not_permitted is returned', async () => {
        const error = new Error('errorMessage');
        error.errorCode = 'career_issuing_not_permitted';
        mockAddCredentialMetadataEntry.mock.mockImplementationOnce(() =>
          Promise.reject(error),
        );
        const { credential, depot, transaction } =
          await persistSignedTransaction();

        const response = await sendNotification(
          {
            notification_id: transaction.notificationId,
            event: 'credential_accepted',
          },
          depot,
        );

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'server_error',
          error_description: 'errorMessage',
        });
        expect(await findTransactionInDb(transaction)).toEqual({
          ...transaction,
          err: 'errorMessage',
          errorCode: 'career_issuing_not_permitted',
          updatedAt: expect.any(Date),
        });
        expect(await findCredentialInDb(credential)).toEqual(
          mongoify(credential),
        );
      });
      it('should 400 with invalid_notification_id when the operator deleted the credential', async () => {
        const { credential, depot, transaction } =
          await persistSignedTransaction();
        await mongoDb()
          .collection('credentials')
          .deleteOne({ _id: new ObjectId(credential._id) });

        const response = await sendNotification(
          {
            notification_id: transaction.notificationId,
            event: 'credential_accepted',
          },
          depot,
        );

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'invalid_notification_id',
          error_description: `Error identifying notification ${transaction.notificationId}`,
        });
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
        expect(await findTransactionInDb(transaction)).toEqual(transaction);
      });
    });
    describe('openid4vc notification endpoint success cases', () => {
      it('should 204 with credential_accepted', async () => {
        const { credential, depot, transaction } =
          await persistSignedTransaction();

        const response = await sendNotification(
          {
            notification_id: transaction.notificationId,
            event: 'credential_accepted',
          },
          depot,
        );

        expect(response.statusCode).toEqual(204);
        const transactionFromDb = await findTransactionInDb(transaction);
        expect(transactionFromDb).toEqual({
          ...transaction,
          status: 'accepted',
          acceptedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(await findCredentialInDb(credential)).toEqual({
          ...mongoify(credential),
          acceptedAt: transactionFromDb.acceptedAt,
          updatedAt: expect.any(Date),
        });
        expect(mockAddCredentialMetadataEntry.mock.calls[0].arguments).toEqual([
          transaction.credentialMetadata,
          transaction.credentialMetadata.contentHash,
          tenant.caoDid,
          'aes-256-gcm',
        ]);
      });
      it('should 204 without anchoring again when credential_accepted is repeated', async () => {
        const { credential, depot, transaction } =
          await persistSignedTransaction();
        const payload = {
          notification_id: transaction.notificationId,
          event: 'credential_accepted',
        };

        const firstResponse = await sendNotification(payload, depot);
        const transactionAfterFirst = await findTransactionInDb(transaction);
        const credentialAfterFirst = await findCredentialInDb(credential);
        const secondResponse = await sendNotification(payload, depot);

        expect(firstResponse.statusCode).toEqual(204);
        expect(secondResponse.statusCode).toEqual(204);
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(1);
        expect(transactionAfterFirst.status).toEqual('accepted');
        expect(await findTransactionInDb(transaction)).toEqual(
          transactionAfterFirst,
        );
        expect(await findCredentialInDb(credential)).toEqual(
          credentialAfterFirst,
        );
      });
      it('should 204 without anchoring again when credential_accepted follows credential_deleted', async () => {
        const { depot, transaction } = await persistSignedTransaction();
        const sendEvent = (event) =>
          sendNotification(
            { notification_id: transaction.notificationId, event },
            depot,
          );

        const acceptedResponse = await sendEvent('credential_accepted');
        const deletedResponse = await sendEvent('credential_deleted');
        const reacceptedResponse = await sendEvent('credential_accepted');

        expect(acceptedResponse.statusCode).toEqual(204);
        expect(deletedResponse.statusCode).toEqual(204);
        expect(reacceptedResponse.statusCode).toEqual(204);
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(1);
        expect(await findTransactionInDb(transaction)).toEqual({
          ...transaction,
          status: 'deleted',
          acceptedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
      it('should 204 when credential_accepted is retried after an anchoring error', async () => {
        mockAddCredentialMetadataEntry.mock.mockImplementationOnce(() =>
          Promise.reject(new Error('Mock Error')),
        );
        const { credential, depot, transaction } =
          await persistSignedTransaction();
        const payload = {
          notification_id: transaction.notificationId,
          event: 'credential_accepted',
        };

        const failedResponse = await sendNotification(payload, depot);
        const retriedResponse = await sendNotification(payload, depot);

        expect(failedResponse.statusCode).toEqual(400);
        expect(retriedResponse.statusCode).toEqual(204);
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(2);
        const transactionFromDb = await findTransactionInDb(transaction);
        expect(transactionFromDb).toEqual({
          ...transaction,
          status: 'accepted',
          acceptedAt: expect.any(Date),
          err: 'Mock Error',
          updatedAt: expect.any(Date),
        });
        expect(await findCredentialInDb(credential)).toEqual({
          ...mongoify(credential),
          acceptedAt: transactionFromDb.acceptedAt,
          updatedAt: expect.any(Date),
        });
      });
      it('should anchor a credential issued again after an earlier issuance was accepted', async () => {
        const previouslyAcceptedAt = new Date('2026-01-01T00:00:00.000Z');
        const { credential, depot, transaction } =
          await persistSignedTransaction({
            acceptedAt: previouslyAcceptedAt,
          });

        const response = await sendNotification(
          {
            notification_id: transaction.notificationId,
            event: 'credential_accepted',
          },
          depot,
        );

        expect(response.statusCode).toEqual(204);
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(1);
        const credentialFromDb = await findCredentialInDb(credential);
        expect(credentialFromDb).toEqual({
          ...mongoify(credential),
          acceptedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(credentialFromDb.acceptedAt > previouslyAcceptedAt).toBe(true);
      });
      it('should 204 with credential_deleted', async () => {
        const { credential, depot, transaction } =
          await persistSignedTransaction();

        const response = await sendNotification(
          {
            notification_id: transaction.notificationId,
            event: 'credential_deleted',
          },
          depot,
        );

        expect(response.statusCode).toEqual(204);
        expect(await findTransactionInDb(transaction)).toEqual({
          ...transaction,
          status: 'deleted',
          updatedAt: expect.any(Date),
        });
        expect(await findCredentialInDb(credential)).toEqual({
          ...mongoify(credential),
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
      });
      it('should 204 with credential_failure', async () => {
        const { credential, depot, transaction } =
          await persistSignedTransaction();

        const response = await sendNotification(
          {
            notification_id: transaction.notificationId,
            event: 'credential_failure',
            event_description:
              'Could not store the Credential. Out of storage.',
          },
          depot,
        );

        expect(response.statusCode).toEqual(204);
        expect(await findTransactionInDb(transaction)).toEqual({
          ...transaction,
          status: 'failed',
          err: 'client_credential_failure',
          errorDescription: 'Could not store the Credential. Out of storage.',
          updatedAt: expect.any(Date),
        });
        expect(await findCredentialInDb(credential)).toEqual({
          ...mongoify(credential),
          failedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
      });
    });
  });
});
