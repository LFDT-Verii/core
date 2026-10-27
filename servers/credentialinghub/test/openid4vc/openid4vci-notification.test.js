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
const { applyOverrides } = require('@verii/common-functions');
const { jwtSign } = require('@verii/jwt');
const { mongoify } = require('@verii/tests-helpers');
const { subMinutes } = require('date-fns');
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
const { ExchangeStates } = require('../../src/entities/exchanges');

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
    await mongoDb().collection('notifications').deleteMany({});
  });

  after(async () => {
    await fastify.close();
    mock.reset();
  });

  const persistSignedCredential = async (
    exchangeOverrides,
    credentialOverrides,
  ) => {
    const issuerService = await persistIssuerService({ tenant });
    const depot = await persistDepot({ tenant, service: issuerService });
    const exchange = {
      id: nanoid(),
      serviceId: new ObjectId(issuerService._id),
      credentialMetadata: {
        isNewList: true,
        listId: 1,
        index: 2,
        contentHash: 'foo',
        algType: 'aes-256-gcm',
      },
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        { state: ExchangeStates.CREDENTIALS_SIGNED, timestamp: new Date() },
      ],
      ...exchangeOverrides,
    };
    const credential = await persistCredential({
      tenant,
      depot,
      exchange,
      ...credentialOverrides,
    });
    return { credential, exchange };
  };

  const acceptedExchangeFields = {
    acceptingAt: expect.any(Date),
    acceptedAt: expect.any(Date),
  };

  const stillAcceptingResponse = {
    error: 'temporarily_unavailable',
    error_description:
      'The credential is still being accepted. Retry the notification later.',
  };

  const sendNotification = async (payload) => {
    const authToken = await jwtSign({}, issuerKeyPair.privateKey, {
      subject: `https://localhost.test/r/${tenant._id}`,
    });
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
        const authToken = await jwtSign({}, issuerKeyPair.privateKey, {
          subject: `https://localhost.test/r/${tenant._id}`,
        });
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
      it('should 400 with server_error due to anchoring error', async () => {
        const errorMessage = 'Mock Error';
        mockAddCredentialMetadataEntry.mock.mockImplementationOnce(() =>
          Promise.reject(new Error(errorMessage)),
        );
        const issuerService = await persistIssuerService({ tenant });
        const depot = await persistDepot({
          tenant,
          service: issuerService,
        });
        const exchange = {
          id: nanoid(),
          serviceId: new ObjectId(issuerService._id),
          credentialMetadata: {
            isNewList: true,
            listId: 1,
            index: 2,
            contentHash: 'foo',
          },
          events: [
            {
              state: ExchangeStates.NEW,
              timestamp: new Date(),
            },
            {
              state: ExchangeStates.CREDENTIALS_SIGNED,
              timestamp: new Date(),
            },
          ],
        };
        const credential = await persistCredential({
          tenant,
          depot,
          exchange,
        });

        const authToken = await jwtSign({}, issuerKeyPair.privateKey, {
          subject: `https://localhost.test/r/${tenant._id}`,
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/notification`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            notification_id: exchange.id,
            event: 'credential_accepted',
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'server_error',
          error_description: errorMessage,
        });
        const credentialFromDb = await mongoDb()
          .collection('credentials')
          .findOne({ _id: new ObjectId(credential._id) });
        expect(credentialFromDb).toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(
            exchange,
            [ExchangeStates.UNEXPECTED_ERROR],
            { err: errorMessage },
          ),
          updatedAt: expect.any(Date),
        });
      });
      it('should 400 if career_issuing_not_permitted is returned', async () => {
        const error = new Error('errorMessage');
        error.errorCode = 'career_issuing_not_permitted';
        mockAddCredentialMetadataEntry.mock.mockImplementationOnce(() =>
          Promise.reject(error),
        );
        const issuerService = await persistIssuerService({ tenant });
        const depot = await persistDepot({
          tenant,
          service: issuerService,
        });

        const exchange = {
          id: nanoid(),
          serviceId: new ObjectId(issuerService._id),
          credentialMetadata: {
            isNewList: true,
            listId: 1,
            index: 2,
            contentHash: 'foo',
          },
          events: [
            {
              state: ExchangeStates.NEW,
              timestamp: new Date(),
            },
            {
              state: ExchangeStates.CREDENTIALS_SIGNED,
              timestamp: new Date(),
            },
          ],
        };
        const credential = await persistCredential({
          tenant,
          depot,
          exchange,
        });
        const authToken = await jwtSign({}, issuerKeyPair.privateKey, {
          subject: `https://localhost.test/r/${tenant._id}`,
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/notification`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            notification_id: exchange.id,
            event: 'credential_accepted',
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'server_error',
          error_description: 'errorMessage',
        });

        await expect(
          mongoDb()
            .collection('credentials')
            .findOne({ _id: new ObjectId(credential._id) }),
        ).resolves.toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(
            exchange,
            [(ExchangeStates.NEW, ExchangeStates.UNEXPECTED_ERROR)],
            {
              errorCode: 'career_issuing_not_permitted',
              err: 'errorMessage',
            },
          ),
        });
      });
    });
    describe('openid4vc notification endpoint success cases', () => {
      it('should 204 with credential_accepted', async () => {
        const issuerService = await persistIssuerService({ tenant });
        const depot = await persistDepot({
          tenant,
          service: issuerService,
        });

        const exchange = {
          id: nanoid(),
          serviceId: new ObjectId(issuerService._id),
          credentialMetadata: {
            isNewList: true,
            listId: 1,
            index: 2,
            contentHash: 'foo',
            algType: 'aes-256-gcm',
          },
          events: [
            {
              state: ExchangeStates.NEW,
              timestamp: new Date(),
            },
            {
              state: ExchangeStates.CREDENTIALS_SIGNED,
              timestamp: new Date(),
            },
          ],
        };
        const credential = await persistCredential({
          tenant,
          depot,
          exchange,
        });

        const authToken = await jwtSign({}, issuerKeyPair.privateKey, {
          subject: `https://localhost.test/r/${tenant._id}`,
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/notification`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            notification_id: exchange.id,
            event: 'credential_accepted',
          },
        });

        expect(response.statusCode).toEqual(204);
        const credentialFromDb = await mongoDb()
          .collection('credentials')
          .findOne({ _id: new ObjectId(credential._id) });
        expect(credentialFromDb).toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(
            exchange,
            [ExchangeStates.COMPLETE],
            acceptedExchangeFields,
          ),
          acceptedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(credentialFromDb.exchange.acceptedAt).toEqual(
          credentialFromDb.acceptedAt,
        );
        expect(mockAddCredentialMetadataEntry.mock.calls[0].arguments).toEqual([
          exchange.credentialMetadata,
          exchange.credentialMetadata.contentHash,
          tenant.caoDid,
          'aes-256-gcm',
        ]);
      });
      it('should 204 and anchor once when credential_accepted is repeated', async () => {
        const { credential, exchange } = await persistSignedCredential();
        const payload = {
          notification_id: exchange.id,
          event: 'credential_accepted',
        };

        const firstResponse = await sendNotification(payload);
        const credentialAfterFirst = await findCredentialInDb(credential);
        const secondResponse = await sendNotification(payload);

        expect(firstResponse.statusCode).toEqual(204);
        expect(secondResponse.statusCode).toEqual(204);
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(1);
        const credentialFromDb = await findCredentialInDb(credential);
        expect(credentialFromDb).toEqual(credentialAfterFirst);
        expect(credentialFromDb).toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(
            exchange,
            [ExchangeStates.COMPLETE],
            acceptedExchangeFields,
          ),
          acceptedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
      it('should 503 a credential_accepted that arrives while another is anchoring, and 204 once that one is done', async () => {
        const { credential, exchange } = await persistSignedCredential();
        const payload = {
          notification_id: exchange.id,
          event: 'credential_accepted',
        };
        const anchorStarted = Promise.withResolvers();
        const anchorReleased = Promise.withResolvers();
        mockAddCredentialMetadataEntry.mock.mockImplementationOnce(() => {
          anchorStarted.resolve();
          return anchorReleased.promise;
        });

        const firstResponsePromise = sendNotification(payload);
        await anchorStarted.promise;
        const secondResponse = await sendNotification(payload);
        anchorReleased.resolve();
        const firstResponse = await firstResponsePromise;
        const thirdResponse = await sendNotification(payload);

        expect(firstResponse.statusCode).toEqual(204);
        expect(secondResponse.statusCode).toEqual(503);
        expect(secondResponse.json).toEqual(stillAcceptingResponse);
        expect(thirdResponse.statusCode).toEqual(204);
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(1);
        expect(await findCredentialInDb(credential)).toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(
            exchange,
            [ExchangeStates.COMPLETE],
            acceptedExchangeFields,
          ),
          acceptedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
      it('should anchor on a credential_accepted retry after anchoring failed', async () => {
        const errorMessage = 'Mock Error';
        mockAddCredentialMetadataEntry.mock.mockImplementationOnce(() =>
          Promise.reject(new Error(errorMessage)),
        );
        const { credential, exchange } = await persistSignedCredential();
        const payload = {
          notification_id: exchange.id,
          event: 'credential_accepted',
        };

        const firstResponse = await sendNotification(payload);
        const secondResponse = await sendNotification(payload);

        expect(firstResponse.statusCode).toEqual(400);
        expect(secondResponse.statusCode).toEqual(204);
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(2);
        expect(await findCredentialInDb(credential)).toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(
            exchange,
            [ExchangeStates.UNEXPECTED_ERROR, ExchangeStates.COMPLETE],
            { err: errorMessage, ...acceptedExchangeFields },
          ),
          acceptedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
      it('should 503 without anchoring or recording an error while another credential_accepted holds the claim', async () => {
        const acceptingAt = new Date();
        const { credential, exchange } = await persistSignedCredential({
          acceptingAt,
        });

        const response = await sendNotification({
          notification_id: exchange.id,
          event: 'credential_accepted',
        });

        expect(response.statusCode).toEqual(503);
        expect(response.json).toEqual(stillAcceptingResponse);
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(0);
        expect(await findCredentialInDb(credential)).toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(exchange),
          updatedAt: expect.any(Date),
        });
      });
      it('should anchor when an earlier credential_accepted claim has gone stale', async () => {
        const acceptingAt = subMinutes(new Date(), 10);
        const { credential, exchange } = await persistSignedCredential({
          acceptingAt,
        });

        const response = await sendNotification({
          notification_id: exchange.id,
          event: 'credential_accepted',
        });

        expect(response.statusCode).toEqual(204);
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(1);
        const credentialFromDb = await findCredentialInDb(credential);
        expect(credentialFromDb).toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(
            exchange,
            [ExchangeStates.COMPLETE],
            acceptedExchangeFields,
          ),
          acceptedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(credentialFromDb.exchange.acceptingAt > acceptingAt).toBe(true);
      });
      it('should keep the claim of a request that took over a stale claim when the stale claimant fails', async () => {
        const errorMessage = 'Mock Error';
        const { credential, exchange } = await persistSignedCredential();
        const payload = {
          notification_id: exchange.id,
          event: 'credential_accepted',
        };
        const staleAnchorStarted = Promise.withResolvers();
        const staleAnchorReleased = Promise.withResolvers();
        mockAddCredentialMetadataEntry.mock.mockImplementationOnce(() => {
          staleAnchorStarted.resolve();
          return staleAnchorReleased.promise;
        }, 0);
        const takeoverAnchorStarted = Promise.withResolvers();
        const takeoverAnchorReleased = Promise.withResolvers();
        mockAddCredentialMetadataEntry.mock.mockImplementationOnce(() => {
          takeoverAnchorStarted.resolve();
          return takeoverAnchorReleased.promise;
        }, 1);

        const staleResponsePromise = sendNotification(payload);
        await staleAnchorStarted.promise;
        await mongoDb()
          .collection('credentials')
          .updateOne(
            { _id: new ObjectId(credential._id) },
            { $set: { 'exchange.acceptingAt': subMinutes(new Date(), 10) } },
          );
        const takeoverResponsePromise = sendNotification(payload);
        await takeoverAnchorStarted.promise;
        staleAnchorReleased.reject(new Error(errorMessage));
        const staleResponse = await staleResponsePromise;
        const duringTakeoverResponse = await sendNotification(payload);
        takeoverAnchorReleased.resolve();
        const takeoverResponse = await takeoverResponsePromise;

        expect(staleResponse.statusCode).toEqual(400);
        expect(duringTakeoverResponse.statusCode).toEqual(503);
        expect(takeoverResponse.statusCode).toEqual(204);
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(2);
        expect(await findCredentialInDb(credential)).toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(
            exchange,
            [ExchangeStates.UNEXPECTED_ERROR, ExchangeStates.COMPLETE],
            { err: errorMessage, ...acceptedExchangeFields },
          ),
          acceptedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
      it('should anchor a credential issued again after an earlier issuance was accepted', async () => {
        const previouslyAcceptedAt = new Date('2026-01-01T00:00:00.000Z');
        const { credential, exchange } = await persistSignedCredential(
          {},
          { acceptedAt: previouslyAcceptedAt },
        );

        const response = await sendNotification({
          notification_id: exchange.id,
          event: 'credential_accepted',
        });

        expect(response.statusCode).toEqual(204);
        expect(mockAddCredentialMetadataEntry.mock.callCount()).toEqual(1);
        const credentialFromDb = await findCredentialInDb(credential);
        expect(credentialFromDb).toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(
            exchange,
            [ExchangeStates.COMPLETE],
            acceptedExchangeFields,
          ),
          acceptedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(credentialFromDb.acceptedAt > previouslyAcceptedAt).toBe(true);
      });
      it('should 204 with credential_deleted', async () => {
        const issuerService = await persistIssuerService({ tenant });
        const depot = await persistDepot({
          tenant,
          service: issuerService,
        });
        const exchange = {
          id: nanoid(),
          serviceId: new ObjectId(issuerService._id),
          credentialMetadata: {
            isNewList: true,
            listId: 1,
            index: 2,
            contentHash: 'foo',
          },
          events: [
            {
              state: ExchangeStates.NEW,
              timestamp: new Date(),
            },
            {
              state: ExchangeStates.CREDENTIALS_SIGNED,
              timestamp: new Date(),
            },
          ],
        };
        const credential = await persistCredential({
          tenant,
          depot,
          exchange,
        });
        const authToken = await jwtSign({}, issuerKeyPair.privateKey, {
          subject: `https://localhost.test/r/${tenant._id}`,
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/notification`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            notification_id: exchange.id,
            event: 'credential_deleted',
          },
        });

        expect(response.statusCode).toEqual(204);
        const credentialFromDb = await mongoDb()
          .collection('credentials')
          .findOne({ _id: new ObjectId(credential._id) });
        expect(credentialFromDb).toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(exchange, [ExchangeStates.COMPLETE]),
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
      it('should 204 with credential_failure', async () => {
        const issuerService = await persistIssuerService({ tenant });
        const depot = await persistDepot({
          tenant,
          service: issuerService,
        });
        const exchange = {
          id: nanoid(),
          serviceId: new ObjectId(issuerService._id),
          credentialMetadata: {
            isNewList: true,
            listId: 1,
            index: 2,
            contentHash: 'foo',
          },
          events: [
            {
              state: ExchangeStates.NEW,
              timestamp: new Date(),
            },
            {
              state: ExchangeStates.CREDENTIALS_SIGNED,
              timestamp: new Date(),
            },
          ],
        };
        const credential = await persistCredential({
          tenant,
          depot,
          exchange,
        });

        const authToken = await jwtSign({}, issuerKeyPair.privateKey, {
          subject: `https://localhost.test/r/${tenant._id}`,
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/notification`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            notification_id: exchange.id,
            event: 'credential_failure',
            event_description:
              'Could not store the Credential. Out of storage.',
          },
        });

        expect(response.statusCode).toEqual(204);
        const credentialFromDb = await mongoDb()
          .collection('credentials')
          .findOne({ _id: new ObjectId(credential._id) });
        expect(credentialFromDb).toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(
            exchange,
            [ExchangeStates.CLIENT_ERROR],
            {
              err: 'client_credential_failure',
              errorDescription:
                'Could not store the Credential. Out of storage.',
            },
          ),
          failedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
    });
  });
});

const expectedDbExchange = (exchange, newEvents, overrides) =>
  applyOverrides(
    {
      ...mongoify(exchange),
      events: exchange.events.concat(
        (newEvents ?? []).map((state) => ({
          state,
          timestamp: expect.any(Date),
        })),
      ),
    },
    overrides,
  );
