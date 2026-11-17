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
const { times } = require('lodash/fp');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const {
  errorResponseMatcher,
} = require('@verii/tests-helpers/src/error-matchers');
const createTestFastify = require('../helpers/create-test-fastify');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  ExchangeProtocols,
  ExchangeTypes,
  initExchangeFactory,
} = require('../../src/entities/exchanges');
const { initPresentationFactory } = require('../../src/entities/presentations');

const testUrl = '/operator/presentations/delete';

describe('operator presentation deletion', () => {
  let fastify;
  let persistTenant;
  let persistExchange;
  let persistPresentation;
  let tenant;

  const deletePresentations = (payload) =>
    fastify.injectJson({ method: 'POST', url: testUrl, payload });

  const findPresentation = (presentation) =>
    mongoDb()
      .collection('presentations')
      .findOne({ _id: new ObjectId(presentation._id) });

  before(async () => {
    fastify = createTestFastify({ logSeverity: 'fatal' });
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistExchange } = initExchangeFactory(
      fastify,
      ExchangeTypes.RELYING_PARTY,
    ));
    ({ persistPresentation } = initPresentationFactory(fastify));
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

  it('should 400 if presentationIds is missing', async () => {
    const response = await deletePresentations({ tenantId: tenant._id });

    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        errorCode: 'request_validation_failed',
        message: "body must have required property 'presentationIds'",
      }),
    );
  });

  it('should 400 if presentationIds is empty', async () => {
    const response = await deletePresentations({
      tenantId: tenant._id,
      presentationIds: [],
    });

    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        errorCode: 'request_validation_failed',
        message: 'body/presentationIds must NOT have fewer than 1 items',
      }),
    );
  });

  // The repo deletes at most 200 matches per call, so a longer list is refused rather than cut short
  it('should 400 if presentationIds has more than 200 items', async () => {
    const response = await deletePresentations({
      tenantId: tenant._id,
      presentationIds: times(() => new ObjectId().toString(), 201),
    });

    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        errorCode: 'request_validation_failed',
        message: 'body/presentationIds must NOT have more than 200 items',
      }),
    );
  });

  it('should 200 and delete the presentations with their verifications', async () => {
    const exchange = await persistExchange({
      tenant,
      protocolMetadata: { protocol: ExchangeProtocols.VN_API },
    });
    const presentation = await persistPresentation({
      tenant,
      exchange,
      verifications: [{ verified: true, createdAt: new Date() }],
    });
    const remainingPresentation = await persistPresentation({
      tenant,
      exchange,
    });

    const response = await deletePresentations({
      tenantId: tenant._id,
      presentationIds: [presentation._id],
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({ requestId: expect.any(String) });
    expect(await findPresentation(presentation)).toBeNull();

    const getResponse = await fastify.injectJson({
      method: 'GET',
      url: `/operator/presentations/get?tenantId=${tenant._id}&presentationId=${presentation._id}`,
    });
    expect(getResponse.statusCode).toEqual(200);
    expect(getResponse.json.presentations).toEqual([]);

    const exchangeResponse = await fastify.injectJson({
      method: 'GET',
      url: `/operator/exchanges/get?tenantId=${tenant._id}&exchangeId=${exchange._id}`,
    });
    expect(exchangeResponse.statusCode).toEqual(200);
    expect(exchangeResponse.json.exchange.presentationIds).toEqual([
      `${remainingPresentation._id}`,
    ]);
  });

  it("should not delete another tenant's presentation", async () => {
    const otherTenant = await persistTenant();
    const otherTenantPresentation = await persistPresentation({
      tenant: otherTenant,
    });

    const response = await deletePresentations({
      tenantId: tenant._id,
      presentationIds: [otherTenantPresentation._id],
    });

    expect(response.statusCode).toEqual(200);
    expect(await findPresentation(otherTenantPresentation)).not.toBeNull();
  });

  it('should 200 if presentationIds are unknown', async () => {
    const response = await deletePresentations({
      tenantId: tenant._id,
      presentationIds: [`${new ObjectId()}`, 'not-an-id'],
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({ requestId: expect.any(String) });
  });
});
