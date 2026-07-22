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
 */

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const createTestFastify = require('../helpers/create-test-fastify');
const { initTenantFactory } = require('../../src/entities/tenants');
const { initExchangeFactory } = require('../../src/entities/exchanges');
const {
  ExchangeProtocols,
  ExchangeStates,
  ExchangeTypes,
} = require('../../src/entities/exchanges/domain');

const testUrl = '/operator/exchanges/get';

describe('operator exchange inspection', () => {
  let fastify;
  let persistTenant;
  let persistExchange;
  let tenant;

  before(async () => {
    fastify = createTestFastify({ logSeverity: 'fatal' });
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistExchange } = initExchangeFactory(fastify));
  });

  beforeEach(async () => {
    await Promise.all([
      mongoDb().collection('exchanges').deleteMany({}),
      mongoDb().collection('presentations').deleteMany({}),
      mongoDb().collection('tenants').deleteMany({}),
    ]);
    tenant = await persistTenant();
  });

  after(async () => {
    await fastify.close();
  });

  it('rejects a request without an exchange or depot filter', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${testUrl}?tenantId=${tenant._id}`,
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json.errorCode).toEqual('request_validation_failed');
  });

  it('rejects a request with both exchange and depot filters', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${testUrl}?tenantId=${tenant._id}&exchangeId=${new ObjectId()}&depotId=${new ObjectId()}`,
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json.errorCode).toEqual('request_validation_failed');
  });

  it('rejects malformed exchange and depot identifiers', async () => {
    const [exchangeResponse, depotResponse] = await Promise.all([
      fastify.injectJson({
        method: 'GET',
        url: `${testUrl}?tenantId=${tenant._id}&exchangeId=not-an-object-id`,
      }),
      fastify.injectJson({
        method: 'GET',
        url: `${testUrl}?tenantId=${tenant._id}&depotId=not-an-object-id`,
      }),
    ]);

    expect(exchangeResponse.statusCode).toEqual(400);
    expect(exchangeResponse.json.errorCode).toEqual(
      'request_validation_failed',
    );
    expect(depotResponse.statusCode).toEqual(400);
    expect(depotResponse.json.errorCode).toEqual('request_validation_failed');
  });

  it('returns a safe direct exchange projection with related identifiers', async () => {
    const depotId = new ObjectId();
    const offeredCredentialId = new ObjectId();
    const finalizedCredentialId = new ObjectId();
    const presentationId = new ObjectId();
    const exchange = await persistExchange({
      tenant,
      depotId,
      type: ExchangeTypes.RELYING_PARTY,
      protocolMetadata: { protocol: ExchangeProtocols.VN_API },
      credentialIds: [offeredCredentialId],
      finalizedCredentialIds: [finalizedCredentialId],
      events: [
        {
          state: ExchangeStates.NEW,
          timestamp: new Date('2026-07-21T01:00:00.000Z'),
        },
        {
          state: ExchangeStates.PRESENTATION_SUBMISSION_RECEIVED,
          timestamp: new Date('2026-07-21T01:01:00.000Z'),
          privateProtocolValue: 'never-return-this',
        },
      ],
    });
    await mongoDb()
      .collection('presentations')
      .insertOne({
        _id: presentationId,
        tenantId: new ObjectId(tenant._id),
        exchangeId: new ObjectId(exchange._id),
        presentation: 'private.jwt',
      });

    const response = await fastify.injectJson({
      method: 'GET',
      url: `${testUrl}?tenantId=${tenant._id}&exchangeId=${exchange._id}`,
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json.exchange).toEqual(
      expect.objectContaining({
        id: exchange._id,
        depotId: depotId.toString(),
        serviceId: exchange.serviceId,
        type: ExchangeTypes.RELYING_PARTY,
        protocol: ExchangeProtocols.VN_API,
        state: ExchangeStates.PRESENTATION_SUBMISSION_RECEIVED,
        credentialIds: [
          offeredCredentialId.toString(),
          finalizedCredentialId.toString(),
        ],
        presentationIds: [presentationId.toString()],
      }),
    );
    expect(response.json.exchange.events).toEqual([
      { state: ExchangeStates.NEW, timestamp: '2026-07-21T01:00:00.000Z' },
      {
        state: ExchangeStates.PRESENTATION_SUBMISSION_RECEIVED,
        timestamp: '2026-07-21T01:01:00.000Z',
      },
    ]);
    expect(JSON.stringify(response.json)).not.toContain('never-return-this');
    expect(JSON.stringify(response.json)).not.toContain('private.jwt');
  });

  it('returns the latest VN API exchange for a depot', async () => {
    const depotId = new ObjectId();
    await persistExchange({
      tenant,
      depotId,
      protocolMetadata: { protocol: ExchangeProtocols.VN_API },
      createdAt: new Date('2026-07-21T01:00:00.000Z'),
    });
    const expectedExchange = await persistExchange({
      tenant,
      depotId,
      protocolMetadata: { protocol: ExchangeProtocols.VN_API },
      createdAt: new Date('2026-07-21T02:00:00.000Z'),
    });
    await persistExchange({
      tenant,
      depotId,
      protocolMetadata: { protocol: ExchangeProtocols.OPENID4VCI },
      createdAt: new Date('2026-07-21T03:00:00.000Z'),
    });

    const response = await fastify.injectJson({
      method: 'GET',
      url: `${testUrl}?tenantId=${tenant._id}&depotId=${depotId}`,
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json.exchange.id).toEqual(expectedExchange._id);
  });

  it('does not expose an exchange from another tenant', async () => {
    const otherTenant = await persistTenant();
    const exchange = await persistExchange({ tenant: otherTenant });

    const response = await fastify.injectJson({
      method: 'GET',
      url: `${testUrl}?tenantId=${tenant._id}&exchangeId=${exchange._id}`,
    });

    expect(response.statusCode).toEqual(404);
    expect(response.json.errorCode).toEqual('exchange_not_found');
  });

  it('returns not found for an unknown exchange', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: `${testUrl}?tenantId=${tenant._id}&exchangeId=${new ObjectId()}`,
    });

    expect(response.statusCode).toEqual(404);
    expect(response.json.errorCode).toEqual('exchange_not_found');
  });

  it('maps persisted exchange failures to safe public errors', async () => {
    const exchange = await persistExchange({
      tenant,
      err: 'database password should not escape',
      protocolMetadata: { protocol: ExchangeProtocols.VN_API },
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        { state: ExchangeStates.UNEXPECTED_ERROR, timestamp: new Date() },
      ],
    });

    const response = await fastify.injectJson({
      method: 'GET',
      url: `${testUrl}?tenantId=${tenant._id}&exchangeId=${exchange._id}`,
    });

    expect(response.json.exchange.error).toEqual({
      code: 'unexpected_error',
      message: 'The exchange ended unexpectedly.',
    });
    expect(JSON.stringify(response.json)).not.toContain('database password');
  });
});
