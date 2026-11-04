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
const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const {
  initDepotFactory,
} = require('../../src/entities/depots/factories/depot-factory');
const {
  initRelyingPartyServiceFactory,
} = require('../../src/entities/relying-party-services');
const { initTenantFactory } = require('../../src/entities/tenants');
const { initKeyFactory } = require('../../src/entities/keys');
const {
  ExchangeProtocols,
  ExchangeStates,
  ExchangeTypes,
  initExchangeFactory,
} = require('../../src/entities/exchanges');
const {
  DefaultNotificationEventTypes,
  NotificationEventTypes,
} = require('../../src/entities/notifications');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');

const testUrl = ({ did }) => `/vn-api/r/${did}/decline-presentation`;

describe('vn-api > decline-presentation', () => {
  let fastify;
  let persistTenant;
  let persistRelyingPartyService;
  let persistDepot;
  let persistExchange;
  let persistKey;
  let tenant;
  let relyingPartyService;
  let depot;
  let exchange;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistRelyingPartyService } = initRelyingPartyServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistExchange } = initExchangeFactory(fastify));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    ({ tenant } = await constructTenant(persistTenant, persistKey));
  });

  beforeEach(async () => {
    fastify.resetOverrides();
    fastify.overrides.reqConfig = enableNotifications([
      NotificationEventTypes.PRESENTATION_DECLINED,
    ]);
    await mongoDb().collection('relyingPartyServices').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('notification_events').deleteMany({});
    relyingPartyService = await persistRelyingPartyService({ tenant });
    depot = await persistDepot({ tenant, service: relyingPartyService });
    exchange = await persistVnApiExchange();
  });

  after(async () => {
    await fastify.close();
  });

  const persistVnApiExchange = (overrides = {}) =>
    persistExchange({
      tenant,
      service: relyingPartyService,
      depotId: new ObjectId(depot._id),
      type: ExchangeTypes.RELYING_PARTY,
      protocolMetadata: { protocol: ExchangeProtocols.VN_API },
      ...overrides,
    });

  const decline = (payload, declineTenant = tenant) =>
    fastify.injectJson({
      method: 'POST',
      url: testUrl(declineTenant),
      payload,
    });

  const findDbExchange = (exchangeId = exchange._id) =>
    mongoDb()
      .collection('exchanges')
      .findOne({ _id: new ObjectId(exchangeId) });

  const findNotificationEvents = () =>
    mongoDb().collection('notification_events').find({}).toArray();

  it('should 204, add the declined state, store the reason and emit one event', async () => {
    const response = await decline({
      exchange_id: exchange._id,
      reason: '  I would rather not share this  ',
    });

    expect(response.statusCode).toEqual(204);
    expect(response.body).toEqual('');
    const dbExchange = await findDbExchange();
    expect(dbExchange).toEqual(
      expect.objectContaining({
        declinedAt: expect.any(Date),
        declineReason: 'I would rather not share this',
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.PRESENTATION_DECLINED,
            timestamp: expect.any(Date),
          },
        ],
      }),
    );
    await expect(findNotificationEvents()).resolves.toEqual([
      expect.objectContaining({
        type: NotificationEventTypes.PRESENTATION_DECLINED,
        payload: {
          id: expect.stringMatching(/^evt_/),
          type: NotificationEventTypes.PRESENTATION_DECLINED,
          version: 1,
          occurredAt: dbExchange.declinedAt.toISOString(),
          tenantId: tenant._id,
          tenantDid: tenant.did,
          caoDid: tenant.caoDid,
          serviceId: relyingPartyService._id,
          depotId: depot._id,
          exchangeId: exchange._id,
          resource: { type: 'exchange', id: exchange._id },
          data: {
            protocol: ExchangeProtocols.VN_API,
            declinedAt: dbExchange.declinedAt.toISOString(),
            reason: 'I would rather not share this',
          },
          links: {
            exchange: `/operator/exchanges/get?tenantId=${tenant._id}&exchangeId=${exchange._id}`,
          },
        },
      }),
    ]);
  });

  it('should 204 on a repeat decline without changing the exchange or emitting again', async () => {
    await decline({ exchange_id: exchange._id, reason: 'first' });
    const declinedExchange = await findDbExchange();

    const response = await decline({
      exchange_id: exchange._id,
      reason: 'second',
    });

    expect(response.statusCode).toEqual(204);
    await expect(findDbExchange()).resolves.toEqual(declinedExchange);
    await expect(findNotificationEvents()).resolves.toHaveLength(1);
  });

  it('should store a blank reason as none and leave it out of the event', async () => {
    const response = await decline({ exchange_id: exchange._id, reason: '  ' });

    expect(response.statusCode).toEqual(204);
    const dbExchange = await findDbExchange();
    expect(dbExchange.declinedAt).toEqual(expect.any(Date));
    expect(dbExchange).not.toHaveProperty('declineReason');
    const [event] = await findNotificationEvents();
    expect(event.payload.data).toEqual({
      protocol: ExchangeProtocols.VN_API,
      declinedAt: dbExchange.declinedAt.toISOString(),
    });
  });

  it('should store a 500-character reason that ends in an emoji intact', async () => {
    const reason = `${'a'.repeat(499)}😀`;

    const response = await decline({ exchange_id: exchange._id, reason });

    expect(response.statusCode).toEqual(204);
    await expect(findDbExchange()).resolves.toEqual(
      expect.objectContaining({ declineReason: reason }),
    );
  });

  it('should 400 when the reason is longer than 500 characters', async () => {
    const response = await decline({
      exchange_id: exchange._id,
      reason: 'a'.repeat(501),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json.errorCode).toEqual('request_validation_failed');
    await expect(findDbExchange()).resolves.not.toHaveProperty('declinedAt');
  });

  it('should not enqueue the event with the default event types', async () => {
    fastify.overrides.reqConfig = enableNotifications(
      DefaultNotificationEventTypes,
    );

    const response = await decline({ exchange_id: exchange._id });

    expect(response.statusCode).toEqual(204);
    await expect(findNotificationEvents()).resolves.toEqual([]);
  });

  it('should return the decline from exchanges/get', async () => {
    await decline({ exchange_id: exchange._id, reason: 'no thanks' });
    const dbExchange = await findDbExchange();

    const response = await fastify.injectJson({
      method: 'GET',
      url: `/operator/exchanges/get?tenantId=${tenant._id}&exchangeId=${exchange._id}`,
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json.exchange).toEqual(
      expect.objectContaining({
        state: ExchangeStates.PRESENTATION_DECLINED,
        decline: {
          declinedAt: dbExchange.declinedAt.toISOString(),
          reason: 'no thanks',
        },
      }),
    );
  });

  describe('exchanges that cannot be declined', () => {
    const expectNotDeclinable = async (notDeclinableExchange) => {
      const unchangedExchange = await findDbExchange(notDeclinableExchange._id);

      const response = await decline({
        exchange_id: notDeclinableExchange._id,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'exchange_not_declinable',
          message: 'Exchange cannot be declined',
          statusCode: 400,
        }),
      );
      await expect(findDbExchange(notDeclinableExchange._id)).resolves.toEqual(
        unchangedExchange,
      );
      await expect(findNotificationEvents()).resolves.toEqual([]);
    };

    it('should 400 for an issuing exchange', async () => {
      await expectNotDeclinable(
        await persistVnApiExchange({ type: ExchangeTypes.ISSUER }),
      );
    });

    it('should 400 for an OpenID4VP exchange', async () => {
      await expectNotDeclinable(
        await persistVnApiExchange({
          protocolMetadata: { protocol: ExchangeProtocols.OPENID4VP },
        }),
      );
    });

    it('should 400 for an exchange that already has a submission', async () => {
      await expectNotDeclinable(
        await persistVnApiExchange({
          events: [
            { state: ExchangeStates.NEW, timestamp: new Date() },
            {
              state: ExchangeStates.PRESENTATION_SUBMISSION_RECEIVED,
              timestamp: new Date(),
            },
          ],
        }),
      );
    });
  });

  describe('exchanges that cannot be found', () => {
    const expectNotFound = async (exchangeId) => {
      const response = await decline({ exchange_id: exchangeId });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'referenced_exchange_not_found',
          message: 'Referenced exchange not found',
          statusCode: 400,
        }),
      );
      await expect(findNotificationEvents()).resolves.toEqual([]);
    };

    it('should 400 for an unknown exchange', async () => {
      await expectNotFound(new ObjectId().toString());
    });

    it("should 400 for another tenant's exchange", async () => {
      const otherTenant = await persistTenant();
      const otherExchange = await persistExchange({
        tenant: otherTenant,
        type: ExchangeTypes.RELYING_PARTY,
        protocolMetadata: { protocol: ExchangeProtocols.VN_API },
      });

      await expectNotFound(otherExchange._id);
      await expect(
        findDbExchange(otherExchange._id),
      ).resolves.not.toHaveProperty('declinedAt');
    });
  });
});

const enableNotifications = (eventTypes) => (config) => ({
  ...config,
  notifications: {
    ...config.notifications,
    enabled: true,
    webhook: {
      ...config.notifications.webhook,
      url: 'https://operator.localhost.test/events',
      eventTypes,
      secret: 'test-secret',
    },
  },
});
