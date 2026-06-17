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
          exchange: expectedDbExchange(exchange, [ExchangeStates.COMPLETE]),
          acceptedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(mockAddCredentialMetadataEntry.mock.calls[0].arguments).toEqual([
          exchange.credentialMetadata,
          exchange.credentialMetadata.contentHash,
          tenant.caoDid,
          'aes-256-gcm',
        ]);
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
