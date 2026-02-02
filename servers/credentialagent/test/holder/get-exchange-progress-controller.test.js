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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { generateKeyPair } = require('@verii/crypto');

const { jwtSign } = require('@verii/jwt');
const { getUnixTime } = require('date-fns/fp');
const {
  initTenantFactory,
  initDisclosureExchangeFactory,
  initOfferExchangeFactory,
  initUserFactory,
  initKeysFactory,
  ExchangeTypes,
  ExchangeStates,
} = require('../../src/entities');
const buildFastify = require('./helpers/credentialagent-holder-build-fastify');
const {
  generateTestAccessToken,
} = require('./helpers/generate-test-access-token');

const buildGetExchangeProgressUrl = ({ tenant }, searchParams) => {
  return `/api/holder/v0.6/org/${tenant.did}/get-exchange-progress${
    searchParams ? `?${searchParams}` : ''
  }`;
};

describe('Get exchange progress test suite', () => {
  let fastify;
  let persistOfferExchange;
  let persistDisclosureExchange;
  let persistTenant;
  let persistVendorUserIdMapping;
  let persistKey;
  let tenant;
  let user;
  let exchangePrivateKey;
  let exchangeKeyDatum;

  const genAuthToken = async (exchange) =>
    generateTestAccessToken(
      exchange._id.toString(),
      tenant.did,
      user._id,
      null,
      null,
      '30d',
      null,
      exchangePrivateKey,
      exchangeKeyDatum.kidFragment,
    );

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
    ({ persistDisclosureExchange } = initDisclosureExchangeFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistVendorUserIdMapping } = initUserFactory(fastify));
    ({ persistKey } = initKeysFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('vendorUserIdMappings').deleteMany({});

    const keyPair = generateKeyPair({ format: 'jwk' });
    exchangePrivateKey = keyPair.privateKey;
    tenant = await persistTenant();
    exchangeKeyDatum = await persistKey({
      keyPair,
      tenant,
    });
    user = await persistVendorUserIdMapping({ tenant });
  });

  after(async () => {
    await fastify.close();
  });

  it('Should 401 when bearer token is empty', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }),
      headers: {
        authorization: 'Bearer',
      },
    });

    expect(response.statusCode).toEqual(401);
  });

  it('Should 401 when bearer token is wrong', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }),
      headers: {
        authorization: 'Bearer invalid',
      },
    });

    expect(response.statusCode).toEqual(401);
  });

  it('Should 401 when sub not set', async () => {
    const exchange = await persistOfferExchange({ tenant });
    const authToken = await jwtSign({}, exchangePrivateKey, {
      iat: getUnixTime(new Date()),
      jti: exchange._id.toString(),
      issuer: tenant.did,
      audience: tenant.did,
      expiresIn: '1d',
    });
    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }),
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.statusCode).toEqual(401);
  });

  it('Should 401 when user is not in the db', async () => {
    const exchange = await persistOfferExchange({ tenant });
    const authToken = await generateTestAccessToken(
      exchange._id.toString(),
      tenant.did,
      'unknown',
      null,
      null,
      '30d',
      null,
      exchangePrivateKey,
      exchangeKeyDatum.kidFragment,
    );
    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }),
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.statusCode).toEqual(401);
  });

  it('Should 400 when "exchange_id" query parameter is missing', async () => {
    const exchange = await persistOfferExchange({ tenant });
    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }),
      headers: {
        authorization: `Bearer ${await genAuthToken(exchange)}`,
      },
    });

    expect(response.statusCode).toEqual(400);
  });

  it('Should 404 when no exchange matching "exchange_id" is found', async () => {
    const exchange = await persistOfferExchange({ tenant });
    const searchParams = new URLSearchParams();
    searchParams.set('exchange_id', 'non-existent-id');

    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }, searchParams),
      headers: {
        authorization: `Bearer ${await genAuthToken(exchange)}`,
      },
    });

    expect(response.statusCode).toEqual(404);
  });

  it('should 200 for an incomplete ISSUING exchange', async () => {
    const exchange = await persistOfferExchange({ tenant });

    const searchParams = new URLSearchParams();
    searchParams.set('exchange_id', exchange._id);

    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }, searchParams),
      headers: {
        authorization: `Bearer ${await genAuthToken(exchange)}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: exchange._id,
      type: ExchangeTypes.ISSUING,
      disclosureComplete: false,
      exchangeComplete: false,
    });
  });

  it('should 200 for an ISSUING exchange that has been IDENTIFIED', async () => {
    const exchange = await persistOfferExchange({
      tenant,
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        { state: ExchangeStates.IDENTIFIED, timestamp: new Date() },
      ],
    });

    const searchParams = new URLSearchParams();
    searchParams.set('exchange_id', exchange._id);

    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }, searchParams),
      headers: {
        authorization: `Bearer ${await genAuthToken(exchange)}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: exchange._id,
      type: ExchangeTypes.ISSUING,
      disclosureComplete: true,
      exchangeComplete: false,
    });
  });

  it('should 200 for an ISSUING exchange that has been NOT_IDENTIFIED', async () => {
    const exchange = await persistOfferExchange({
      tenant,
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        {
          state: ExchangeStates.NOT_IDENTIFIED,
          timestamp: new Date(),
        },
      ],
    });

    const searchParams = new URLSearchParams();
    searchParams.set('exchange_id', exchange._id);

    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }, searchParams),
      headers: {
        authorization: `Bearer ${await genAuthToken(exchange)}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: exchange._id,
      type: ExchangeTypes.ISSUING,
      disclosureComplete: false,
      exchangeComplete: false,
      exchangeError: ExchangeStates.NOT_IDENTIFIED,
    });
  });

  it('should 200 for an ISSUING exchange that has been UNEXPECTED_ERROR before identification', async () => {
    const exchange = await persistOfferExchange({
      tenant,
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        { state: ExchangeStates.UNEXPECTED_ERROR, timestamp: new Date() },
      ],
    });

    const searchParams = new URLSearchParams();
    searchParams.set('exchange_id', exchange._id);

    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }, searchParams),
      headers: {
        authorization: `Bearer ${await genAuthToken(exchange)}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: exchange._id,
      type: ExchangeTypes.ISSUING,
      disclosureComplete: false,
      exchangeComplete: false,
      exchangeError: ExchangeStates.UNEXPECTED_ERROR,
    });
  });

  it('should 200 for an ISSUING exchange that has been UNEXPECTED_ERROR after identification', async () => {
    const exchange = await persistOfferExchange({
      tenant,
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        {
          state: ExchangeStates.DISCLOSURE_RECEIVED,
          timestamp: new Date(),
        },
        {
          state: ExchangeStates.DISCLOSURE_CHECKED,
          timestamp: new Date(),
        },
        { state: ExchangeStates.IDENTIFIED, timestamp: new Date() },
        { state: ExchangeStates.OFFERS_REQUESTED, timestamp: new Date() },
        { state: ExchangeStates.UNEXPECTED_ERROR, timestamp: new Date() },
      ],
    });

    const searchParams = new URLSearchParams();
    searchParams.set('exchange_id', exchange._id);

    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }, searchParams),
      headers: {
        authorization: `Bearer ${await genAuthToken(exchange)}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: exchange._id,
      type: ExchangeTypes.ISSUING,
      disclosureComplete: true,
      exchangeComplete: false,
      exchangeError: ExchangeStates.UNEXPECTED_ERROR,
    });
  });

  it('should 200 for an complete ISSUING exchange', async () => {
    const exchange = await persistOfferExchange({
      tenant,
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        {
          state: ExchangeStates.DISCLOSURE_RECEIVED,
          timestamp: new Date(),
        },
        {
          state: ExchangeStates.DISCLOSURE_CHECKED,
          timestamp: new Date(),
        },
        { state: ExchangeStates.IDENTIFIED, timestamp: new Date() },
        { state: ExchangeStates.OFFERS_RECEIVED, timestamp: new Date() },
        { state: ExchangeStates.OFFERS_SENT, timestamp: new Date() },
        { state: ExchangeStates.COMPLETE, timestamp: new Date() },
      ],
    });

    const searchParams = new URLSearchParams();
    searchParams.set('exchange_id', exchange._id);

    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }, searchParams),
      headers: {
        authorization: `Bearer ${await genAuthToken(exchange)}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: exchange._id,
      type: ExchangeTypes.ISSUING,
      disclosureComplete: true,
      exchangeComplete: true,
    });
  });

  it('should 200 for an incomplete DISCLOSURE exchange', async () => {
    const disclosureExchange = await persistDisclosureExchange({
      tenant,
    });

    const searchParams = new URLSearchParams();
    searchParams.set('exchange_id', disclosureExchange._id);

    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }, searchParams),
      headers: {
        authorization: `Bearer ${await genAuthToken(disclosureExchange)}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: disclosureExchange._id,
      type: ExchangeTypes.DISCLOSURE,
      disclosureComplete: false,
      exchangeComplete: false,
    });
  });

  it('should 200 for a DISCLOSURE exchange that UNEXPECTED_ERROR', async () => {
    const disclosureExchange = await persistDisclosureExchange({
      tenant,
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        {
          state: ExchangeStates.UNEXPECTED_ERROR,
          timestamp: new Date(),
        },
      ],
    });

    const searchParams = new URLSearchParams();
    searchParams.set('exchange_id', disclosureExchange._id);

    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }, searchParams),
      headers: {
        authorization: `Bearer ${await genAuthToken(disclosureExchange)}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: disclosureExchange._id,
      type: ExchangeTypes.DISCLOSURE,
      disclosureComplete: false,
      exchangeComplete: false,
      exchangeError: ExchangeStates.UNEXPECTED_ERROR,
    });
  });

  it('should 200 for a complete DISCLOSURE exchange', async () => {
    const disclosureExchange = await persistDisclosureExchange({
      tenant,
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        {
          state: ExchangeStates.DISCLOSURE_RECEIVED,
          timestamp: new Date(),
        },
        {
          state: ExchangeStates.DISCLOSURE_CHECKED,
          timestamp: new Date(),
        },
        { state: ExchangeStates.COMPLETE, timestamp: new Date() },
      ],
    });

    const searchParams = new URLSearchParams();
    searchParams.set('exchange_id', disclosureExchange._id);

    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }, searchParams),
      headers: {
        authorization: `Bearer ${await genAuthToken(disclosureExchange)}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: disclosureExchange._id,
      type: ExchangeTypes.DISCLOSURE,
      disclosureComplete: true,
      exchangeComplete: true,
    });
  });

  it('should 200 for a complete DISCLOSURE exchange that errored after completion, errors should be suppressed', async () => {
    const disclosureExchange = await persistDisclosureExchange({
      tenant,
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        {
          state: ExchangeStates.DISCLOSURE_RECEIVED,
          timestamp: new Date(),
        },
        {
          state: ExchangeStates.DISCLOSURE_CHECKED,
          timestamp: new Date(),
        },
        { state: ExchangeStates.COMPLETE, timestamp: new Date() },
        { state: ExchangeStates.UNEXPECTED_ERROR, timestamp: new Date() },
      ],
    });

    const searchParams = new URLSearchParams();
    searchParams.set('exchange_id', disclosureExchange._id);

    const response = await fastify.injectJson({
      method: 'GET',
      url: buildGetExchangeProgressUrl({ tenant }, searchParams),
      headers: {
        authorization: `Bearer ${await genAuthToken(disclosureExchange)}`,
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: disclosureExchange._id,
      type: ExchangeTypes.DISCLOSURE,
      disclosureComplete: true,
      exchangeComplete: true,
    });
  });
});
