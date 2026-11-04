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

const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const {
  mockHttpClient,
  mockHttpClientModule,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { map } = require('lodash/fp');
const { nanoid } = require('nanoid');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initDepotFactory } = require('../../src/entities/depots');
const { initCredentialFactory } = require('../../src/entities/credentials');
const {
  initExchangeFactory,
  ExchangeProtocols,
  ExchangeStates,
} = require('../../src/entities/exchanges');

const testUrl = '/operator/depots/resolve-deferred-credentials';
const messagingSettings = {
  webhookUrl: 'https://wallet.example.com/push',
  authToken: 'push-token-123',
};

describe('Resolve Deferred Credentials Test Suite', () => {
  let fastify;
  let persistTenant;
  let persistKey;
  let persistIssuerService;
  let persistDepot;
  let persistCredential;
  let persistExchange;

  let tenant;
  let issuerService;
  let depot;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistCredential } = initCredentialFactory(fastify));
    ({ persistExchange } = initExchangeFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    ({ tenant } = await constructTenant(persistTenant, persistKey));
    issuerService = await persistIssuerService({
      tenant,
      authMethods: ['preauth'],
    });
    depot = await persistDepot({
      tenant,
      service: issuerService,
      userReference: nanoid(),
      deferredCredentials: true,
      expectedCredentialTypes: ['EmailV1.0', 'PhoneV1.0'],
    });
    resetMockHttpClient();
  });

  after(async () => {
    await fastify.close();
  });

  const resolveDeferredCredentials = (
    depotId = depot._id,
    tenantId = tenant._id,
  ) =>
    fastify.injectJson({
      method: 'POST',
      url: testUrl,
      payload: { tenantId, depotId },
    });

  const persistVnApiExchange = (states, overrides = {}) =>
    persistExchange({
      tenant,
      service: issuerService,
      depotId: new ObjectId(depot._id),
      protocolMetadata: { protocol: ExchangeProtocols.VN_API },
      messagingSettings,
      events: map(
        (state) => ({ state, timestamp: new Date() }),
        [
          ExchangeStates.NEW,
          ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
          ExchangeStates.AUTHENTICATION_SUCCESS,
          ...states,
        ],
      ),
      ...overrides,
    });

  const persistWaitingExchange = (overrides) =>
    persistVnApiExchange(
      [ExchangeStates.OFFERS_REQUESTED, ExchangeStates.OFFERS_WAITING],
      overrides,
    );

  const persistTypedCredential = (type, overrides = {}) =>
    persistCredential({
      tenant,
      depot,
      content: {
        type: [type],
        credentialSubject: { id: nanoid() },
      },
      ...overrides,
    });

  const findDbDepot = () =>
    mongoDb()
      .collection('depots')
      .findOne({ _id: new ObjectId(depot._id) });

  const findDbExchangeStates = async (exchangeId) => {
    const exchange = await mongoDb()
      .collection('exchanges')
      .findOne({ _id: new ObjectId(exchangeId) });
    return map('state', exchange.events);
  };

  const expectedDepot = () => ({
    id: depot._id,
    serviceId: depot.serviceId,
    userReference: depot.userReference,
    deferredCredentials: true,
    expectedCredentialTypes: depot.expectedCredentialTypes,
    deferredCredentialsResolvedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
  });

  const postedMessages = () =>
    map(
      ({ arguments: [url, body] }) => ({ url, body }),
      mockHttpClient.post.mock.calls,
    );

  it('should 400 if depotId is missing', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: testUrl,
      payload: { tenantId: tenant._id },
    });
    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        errorCode: 'request_validation_failed',
        message: "body must have required property 'depotId'",
      }),
    );
  });

  it('should 404 if the depot is unknown', async () => {
    const depotId = new ObjectId().toString();
    const response = await resolveDeferredCredentials(depotId);
    expect(response.statusCode).toEqual(404);
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 404,
        error: 'Not Found',
        errorCode: 'depot_not_found',
        message: `Depot ${depotId} not found`,
      }),
    );
  });

  it("should 404 for another tenant's depot", async () => {
    const { tenant: tenant2 } = await constructTenant(
      persistTenant,
      persistKey,
    );
    const response = await resolveDeferredCredentials(depot._id, tenant2._id);
    expect(response.statusCode).toEqual(404);
    expect(response.json.errorCode).toEqual('depot_not_found');
  });

  it('should return skipped_no_waiting_exchange for a depot without deferred credentials', async () => {
    const otherDepot = await persistDepot({
      tenant,
      service: issuerService,
      userReference: nanoid(),
    });
    const response = await resolveDeferredCredentials(otherDepot._id);
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      depot: {
        id: otherDepot._id,
        serviceId: otherDepot.serviceId,
        userReference: otherDepot.userReference,
        deferredCredentials: false,
        deferredCredentialsResolvedAt:
          expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      },
      notification: { status: 'skipped_no_waiting_exchange' },
      requestId: expect.any(String),
    });
    expect(mockHttpClient.post.mock.callCount()).toEqual(0);
  });

  it('should return skipped_no_waiting_exchange and change no exchange when no wallet is waiting', async () => {
    const exchange = await persistVnApiExchange([
      ExchangeStates.OFFERS_REQUESTED,
      ExchangeStates.OFFERS_SENT,
    ]);
    const dbDepot = await findDbDepot();
    const response = await resolveDeferredCredentials();
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      depot: expectedDepot(),
      notification: { status: 'skipped_no_waiting_exchange' },
      requestId: expect.any(String),
    });
    expect(mockHttpClient.post.mock.callCount()).toEqual(0);
    await expect(findDbDepot()).resolves.toEqual({
      ...dbDepot,
      deferredCredentialsResolvedAt: new Date(
        response.json.depot.deferredCredentialsResolvedAt,
      ),
      updatedAt: expect.any(Date),
    });
    await expect(findDbExchangeStates(exchange._id)).resolves.toEqual(
      map('state', exchange.events),
    );
  });

  it('should send NewOffersReady with the claimable types and count of the waiting exchange', async () => {
    await persistTypedCredential('EmailV1.0');
    await persistTypedCredential('EmailV1.0');
    await persistTypedCredential('PhoneV1.0');
    await persistTypedCredential('EmailV1.0', { acceptedAt: new Date() });
    await persistTypedCredential('EmailV1.0', { rejectedAt: new Date() });
    const exchange = await persistWaitingExchange();

    const response = await resolveDeferredCredentials();

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      depot: expectedDepot(),
      notification: { status: 'sent', exchangeId: exchange._id },
      requestId: expect.any(String),
    });
    expect(postedMessages()).toEqual([
      {
        url: messagingSettings.webhookUrl,
        body: expect.objectContaining({
          data: expect.objectContaining({
            notificationType: 'NewOffersReady',
            exchangeId: exchange._id,
            credentialTypes: expect.arrayContaining(['EmailV1.0', 'PhoneV1.0']),
            count: 3,
          }),
        }),
      },
    ]);
    expect(postedMessages()[0].body.data.credentialTypes).toHaveLength(2);
    // The wallet collects the offers with credential-offers, so the exchange stays open
    await expect(findDbExchangeStates(exchange._id)).resolves.toEqual(
      map('state', exchange.events),
    );
  });

  it("should count only the types the waiting exchange's link asked for", async () => {
    await persistTypedCredential('EmailV1.0');
    await persistTypedCredential('PhoneV1.0');
    const exchange = await persistWaitingExchange({
      credentialTypes: ['PhoneV1.0'],
    });

    const response = await resolveDeferredCredentials();

    expect(response.json.notification).toEqual({
      status: 'sent',
      exchangeId: exchange._id,
    });
    expect(postedMessages()[0].body.data).toEqual(
      expect.objectContaining({
        notificationType: 'NewOffersReady',
        credentialTypes: ['PhoneV1.0'],
        count: 1,
      }),
    );
  });

  it('should send NoOffersFound and leave the exchange unchanged when the depot has no claimable credentials', async () => {
    await persistTypedCredential('EmailV1.0', { acceptedAt: new Date() });
    const exchange = await persistWaitingExchange();

    const response = await resolveDeferredCredentials();

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      depot: expectedDepot(),
      notification: { status: 'sent', exchangeId: exchange._id },
      requestId: expect.any(String),
    });
    expect(postedMessages()).toEqual([
      {
        url: messagingSettings.webhookUrl,
        body: expect.objectContaining({
          data: expect.objectContaining({
            notificationType: 'NoOffersFound',
            exchangeId: exchange._id,
          }),
        }),
      },
    ]);
    await expect(findDbExchangeStates(exchange._id)).resolves.toEqual(
      map('state', exchange.events),
    );
  });

  it('should return skipped_no_messaging_settings and leave the exchange unchanged without messaging settings', async () => {
    const exchange = await persistWaitingExchange({
      messagingSettings: undefined,
    });

    const response = await resolveDeferredCredentials();

    expect(response.statusCode).toEqual(200);
    expect(response.json.notification).toEqual({
      status: 'skipped_no_messaging_settings',
      exchangeId: exchange._id,
    });
    expect(mockHttpClient.post.mock.callCount()).toEqual(0);
    await expect(findDbExchangeStates(exchange._id)).resolves.toEqual(
      map('state', exchange.events),
    );
  });

  it('should return a failed notification when the push url fails', async () => {
    await persistTypedCredential('EmailV1.0');
    await persistWaitingExchange();
    mockHttpClient.post.mock.mockImplementationOnce(() =>
      Promise.reject(new Error('Response Error')),
    );

    const response = await resolveDeferredCredentials();

    expect(response.statusCode).toEqual(200);
    expect(response.json.notification).toEqual({
      status: 'failed',
      error: 'Response Error',
      exchangeId: expect.stringMatching(OBJECT_ID_FORMAT),
    });
  });

  it('should send NoOffersFound again when called again, and leave the exchange unchanged', async () => {
    const exchange = await persistWaitingExchange();

    const firstResponse = await resolveDeferredCredentials();
    const secondResponse = await resolveDeferredCredentials();

    expect(map('json.notification', [firstResponse, secondResponse])).toEqual([
      { status: 'sent', exchangeId: exchange._id },
      { status: 'sent', exchangeId: exchange._id },
    ]);
    expect(map('body.data.notificationType', postedMessages())).toEqual([
      'NoOffersFound',
      'NoOffersFound',
    ]);
    await expect(findDbExchangeStates(exchange._id)).resolves.toEqual(
      map('state', exchange.events),
    );
  });

  it('should message the waiting exchange again when called again', async () => {
    await persistTypedCredential('EmailV1.0');
    const exchange = await persistWaitingExchange();

    const firstResponse = await resolveDeferredCredentials();
    const secondResponse = await resolveDeferredCredentials();

    expect(firstResponse.json.notification).toEqual({
      status: 'sent',
      exchangeId: exchange._id,
    });
    expect(secondResponse.json).toEqual({
      depot: expectedDepot(),
      notification: { status: 'sent', exchangeId: exchange._id },
      requestId: expect.any(String),
    });
    expect(map('body.data.notificationType', postedMessages())).toEqual([
      'NewOffersReady',
      'NewOffersReady',
    ]);
  });

  it('should set deferredCredentialsResolvedAt before messaging, and depots/get should return it', async () => {
    await persistWaitingExchange();
    let dbDepotAtMessage;
    mockHttpClient.post.mock.mockImplementationOnce(async () => {
      dbDepotAtMessage = await findDbDepot();
      return { statusCode: 204 };
    });

    const response = await resolveDeferredCredentials();

    const { deferredCredentialsResolvedAt } = response.json.depot;
    expect(deferredCredentialsResolvedAt).toMatch(ISO_DATETIME_FORMAT);
    expect(dbDepotAtMessage.deferredCredentialsResolvedAt).toEqual(
      new Date(deferredCredentialsResolvedAt),
    );
    const getResponse = await fastify.injectJson({
      method: 'GET',
      url: `/operator/depots/get?tenantId=${tenant._id}&depotId=${depot._id}`,
    });
    expect(getResponse.json.depots).toEqual([
      expect.objectContaining({ deferredCredentialsResolvedAt }),
    ]);
  });

  it('should message only the latest waiting exchange, not a newer one that never waited, and leave the older one alone', async () => {
    await persistTypedCredential('EmailV1.0');
    const olderWaitingExchange = await persistWaitingExchange();
    const latestWaitingExchange = await persistWaitingExchange();
    await persistVnApiExchange([
      ExchangeStates.OFFERS_REQUESTED,
      ExchangeStates.OFFERS_SENT,
    ]);
    await persistVnApiExchange([]);

    const response = await resolveDeferredCredentials();

    expect(response.json.notification).toEqual({
      status: 'sent',
      exchangeId: latestWaitingExchange._id,
    });
    expect(mockHttpClient.post.mock.callCount()).toEqual(1);
    expect(postedMessages()[0].body.data.exchangeId).toEqual(
      latestWaitingExchange._id,
    );
    await expect(
      findDbExchangeStates(olderWaitingExchange._id),
    ).resolves.toEqual(map('state', olderWaitingExchange.events));
  });

  it('should skip a waiting exchange that is already complete', async () => {
    await persistTypedCredential('EmailV1.0');
    const waitingExchange = await persistWaitingExchange();
    await persistVnApiExchange([
      ExchangeStates.OFFERS_REQUESTED,
      ExchangeStates.OFFERS_WAITING,
      ExchangeStates.COMPLETE,
    ]);

    const response = await resolveDeferredCredentials();

    expect(response.json.notification).toEqual({
      status: 'sent',
      exchangeId: waitingExchange._id,
    });
    expect(mockHttpClient.post.mock.callCount()).toEqual(1);
    expect(postedMessages()[0].body.data.exchangeId).toEqual(
      waitingExchange._id,
    );
  });

  it('should skip an exchange that waited and has started claiming its credentials', async () => {
    const exchange = await persistVnApiExchange([
      ExchangeStates.OFFERS_REQUESTED,
      ExchangeStates.OFFERS_WAITING,
      ExchangeStates.OFFERS_REQUESTED,
      ExchangeStates.OFFERS_SENT,
      ExchangeStates.CLAIMING_IN_PROGRESS,
    ]);

    const response = await resolveDeferredCredentials();

    expect(response.json.notification).toEqual({
      status: 'skipped_no_waiting_exchange',
    });
    expect(mockHttpClient.post.mock.callCount()).toEqual(0);
    await expect(findDbExchangeStates(exchange._id)).resolves.toEqual(
      map('state', exchange.events),
    );
  });

  describe('message bodies', () => {
    // The same bodies as the Credential Agent's offers/complete pushes
    it('should send a NewOffersReady body that matches the Credential Agent', async () => {
      await persistTypedCredential('EmailV1.0');
      const exchange = await persistWaitingExchange();

      await resolveDeferredCredentials();

      const [url, body, { headers }] =
        mockHttpClient.post.mock.calls[0].arguments;
      expect(url).toEqual(messagingSettings.webhookUrl);
      expect(body).toEqual({
        id: expect.stringMatching(/^[\w-]{21}$/),
        pushToken: messagingSettings.authToken,
        data: {
          notificationType: 'NewOffersReady',
          issuer: tenant.did,
          exchangeId: exchange._id,
          serviceEndpoint: messagingSettings.webhookUrl,
          credentialTypes: ['EmailV1.0'],
          count: 1,
        },
      });
      expect(headers.Authorization).toMatch(/^Bearer /);
    });

    it('should send a NoOffersFound body that matches the Credential Agent', async () => {
      const exchange = await persistWaitingExchange();

      await resolveDeferredCredentials();

      const [url, body, { headers }] =
        mockHttpClient.post.mock.calls[0].arguments;
      expect(url).toEqual(messagingSettings.webhookUrl);
      expect(body).toEqual({
        id: expect.stringMatching(/^[\w-]{21}$/),
        pushToken: messagingSettings.authToken,
        data: {
          notificationType: 'NoOffersFound',
          issuer: tenant.did,
          exchangeId: exchange._id,
          serviceEndpoint: messagingSettings.webhookUrl,
        },
      });
      expect(headers.Authorization).toMatch(/^Bearer /);
    });
  });
});
