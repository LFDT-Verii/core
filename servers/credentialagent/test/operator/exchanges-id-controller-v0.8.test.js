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
const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { omit } = require('lodash/fp');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const {
  initTenantFactory,
  initDisclosureFactory,
  initOfferExchangeFactory,
  ExchangeStates,
} = require('../../src/entities');

const buildExchangeIdUrl = (tenant, exchange) =>
  `/operator-api/v0.8/tenants/${tenant._id}/exchanges/${exchange._id}`;

const clearDb = async () => {
  await mongoDb().collection('tenants').deleteMany({});
  await mongoDb().collection('disclosures').deleteMany({});
  await mongoDb().collection('exchanges').deleteMany({});
};

describe('Exchange of specific Id Controller Test Suite', () => {
  let fastify;
  let persistTenant;
  let persistDisclosure;
  let persistOfferExchange;
  let tenant;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistDisclosure } = initDisclosureFactory(fastify));
    ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
  });

  beforeEach(async () => {
    await clearDb();
    tenant = await persistTenant();
  });

  after(async () => {
    await clearDb();
    await fastify.close();
  });

  it("should 404 when exchange doesn't exist", async () => {
    const url = buildExchangeIdUrl(tenant, { _id: 'foo' });
    const response = await fastify.injectJson({
      method: 'GET',
      url,
    });
    expect(response.statusCode).toEqual(404);
  });

  it('should 200 and return an exchange in which errors occurred', async () => {
    const disclosure = await persistDisclosure({ tenant });
    const exchange = await persistOfferExchange({
      tenant,
      disclosure,
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        { state: ExchangeStates.UNEXPECTED_ERROR, timestamp: new Date() },
      ],
      err: 'test error',
    });
    const url = buildExchangeIdUrl(tenant, exchange);
    const response = await fastify.injectJson({
      method: 'GET',
      url,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      exchange: {
        ...omit(['credentialTypes', 'offerHashes', '_id', 'err'], exchange),
        id: exchange._id,
        err: 'test error',
      },
    });
  });

  it('Should get an Exchange HTTP Deep Link', async () => {
    const disclosure = await persistDisclosure({ tenant });
    const exchange = await persistOfferExchange({
      tenant,
      disclosure,
      vendorOfferStatuses: {
        fooOfferId: 'OK',
      },
      protocolMetadata: {
        protocol: 'foo',
      },
      events: [
        { state: ExchangeStates.OFFERS_RECEIVED, timestamp: new Date() },
      ],
    });
    const url = buildExchangeIdUrl(tenant, exchange);
    const urlEncodedDid = encodeURIComponent(tenant.did);

    const response = await fastify.inject({
      method: 'GET',
      url: `${url}/deep-link`,
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({
      deepLink:
        // eslint-disable-next-line max-len
        `http://localhost.test/app-redirect?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${urlEncodedDid}%2Fissue%2Fget-credential-manifest%3Fid%3D${exchange.disclosureId}%26exchange_id%3D${exchange._id}&issuerDid=${urlEncodedDid}&exchange_type=issue`,
    });
  });

  it('should 200 and return an exchange', async () => {
    const disclosure = await persistDisclosure({ tenant });
    const exchange = await persistOfferExchange({
      tenant,
      disclosure,
      vendorOfferStatuses: {
        fooOfferId: 'OK',
      },
      protocolMetadata: {
        protocol: 'foo',
      },
      foo: 'bar',
    });

    const url = buildExchangeIdUrl(tenant, exchange);
    const response = await fastify.injectJson({
      method: 'GET',
      url,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      exchange: {
        ...omit(['credentialTypes', 'offerHashes', '_id'], exchange),
        id: exchange._id,
        vendorOfferStatuses: {
          fooOfferId: 'OK',
        },
        protocolMetadata: {
          protocol: 'foo',
        },
      },
    });
  });
});
