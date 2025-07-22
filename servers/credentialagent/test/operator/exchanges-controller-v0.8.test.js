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
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const {
  mongoify,
  errorResponseMatcher,
} = require('@verii/tests-helpers');
const {
  initTenantFactory,
  initDisclosureFactory,
  ExchangeStates,
  ExchangeTypes,
  VendorEndpoint,
  ExchangeErrors,
} = require('../../src/entities');

const url = (tenant) => `/operator-api/v0.8/tenants/${tenant._id}/exchanges`;

const clearDb = async () => {
  await mongoDb().collection('tenants').deleteMany({});
  await mongoDb().collection('disclosures').deleteMany({});
  await mongoDb().collection('exchanges').deleteMany({});
};

describe('vendor exchange creation', () => {
  let fastify;
  let persistTenant;
  let persistDisclosure;
  let tenant;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistDisclosure } = initDisclosureFactory(fastify));
  });

  beforeEach(async () => {
    await clearDb();
    tenant = await persistTenant();
  });

  afterAll(async () => {
    await clearDb();
    await fastify.close();
  });

  it('should 201 when exchangeId generated for DISCLOSURE type', async () => {
    const disclosure = await persistDisclosure({ tenant });
    const payload = { type: 'DISCLOSURE', disclosureId: disclosure._id };
    const response = await fastify.injectJson({
      method: 'POST',
      url: url(tenant),
      payload,
    });

    expect(response.statusCode).toEqual(201);
    expect(response.json).toEqual({ id: expect.any(String) });
    const dbResult = await mongoDb()
      .collection('exchanges')
      .findOne({ _id: new ObjectId(response.json.id) });
    expect(dbResult).toEqual(
      mongoify({
        ...payload,
        _id: response.json.id,
        events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
        tenantId: tenant._id,
        createdBy: 'velocity.admin@example.com',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
    );
  });

  it('should 400 when disclosureId is missing for a DISCLOSURE type', async () => {
    await persistDisclosure({ tenant });

    const response = await fastify.injectJson({
      method: 'POST',
      url: url(tenant),
      payload: { type: 'DISCLOSURE' },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      ExchangeErrors.DISCLOSURE_ID_REQUIRED
    );
  });

  it('should 400 when type is missing', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: url(tenant),
    });

    expect(response.statusCode).toEqual(400);
  });

  it('should 201 when exchangeId generated for ISSUING type', async () => {
    const disclosure = await persistDisclosure({
      vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      tenant,
    });
    const payload = {
      type: ExchangeTypes.ISSUING,
    };
    const response = await fastify.injectJson({
      method: 'POST',
      url: url(tenant),
      payload,
    });

    expect(response.statusCode).toEqual(201);
    expect(response.json).toEqual({ id: expect.any(String) });
    const dbResult = await mongoDb()
      .collection('exchanges')
      .findOne({ _id: new ObjectId(response.json.id) });
    expect(dbResult).toEqual(
      mongoify({
        ...payload,
        _id: response.json.id,
        events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
        disclosureId: disclosure._id,
        tenantId: tenant._id,
        createdBy: 'velocity.admin@example.com',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
    );
  });

  it('should 400 when exchangeId generated for ISSUING type but no disclosure is setup', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: url(tenant),
      payload: {
        type: ExchangeTypes.ISSUING,
      },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json.message).toEqual(
      ExchangeErrors.IDENTIFICATION_DISCLOSURE_MISSING_TEMPLATE(tenant)
    );
  });

  it('should 400 when wrong type specified', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: url(tenant),
      payload: { type: 'SOMETHING' },
    });

    expect(response.statusCode).toEqual(400);
  });

  describe('INTEGRATED_IDENTIFICATION exchanges', () => {
    it('should 201 when creating a properly formatted integrated issuing exchange', async () => {
      const disclosure = await persistDisclosure({
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        tenant,
        identityMatchers: {
          rules: [
            {
              valueIndex: 0, // used for identifying the value
              path: ['$.emails'], // jsonPath within the credential
              rule: 'pick', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
            },
          ],
          vendorUserIdIndex: 0,
        },
      });
      const payload = {
        type: ExchangeTypes.ISSUING,
        disclosureId: disclosure._id,
        identityMatcherValues: ['adam.smith@example.com'],
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: url(tenant),
        payload,
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({ id: expect.any(String) });
      const dbResult = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(response.json.id) });
      expect(dbResult).toEqual(
        mongoify({
          ...payload,
          _id: response.json.id,
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          tenantId: tenant._id,
          createdBy: 'velocity.admin@example.com',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });
    it('should 201 when creating a properly formatted integrated issuing exchange with sparse value array', async () => {
      const disclosure = await persistDisclosure({
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        tenant,
        identityMatchers: {
          rules: [
            {
              valueIndex: 0, // used for identifying the value
              path: ['$.emails'], // jsonPath within the credential
              rule: 'pick', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
            },
          ],
          vendorUserIdIndex: 2,
        },
      });

      const payload = {
        type: ExchangeTypes.ISSUING,
        disclosureId: disclosure._id,
        identityMatcherValues: [10, '', 'adam.smith@example.com', ''],
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: url(tenant),
        payload,
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({ id: expect.any(String) });
      const dbResult = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(response.json.id) });
      expect(dbResult).toEqual(
        mongoify({
          ...payload,
          _id: response.json.id,
          events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
          tenantId: tenant._id,
          createdBy: 'velocity.admin@example.com',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });
    it('should 201 when creating a an integrated issuing exchange with a phone number with a leading plus', async () => {
      const disclosure = await persistDisclosure({
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        tenant,
        identityMatchers: {
          rules: [
            {
              valueIndex: 0, // used for identifying the value
              path: ['$.phones'], // jsonPath within the credential
              rule: 'pick', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
            },
          ],
          vendorUserIdIndex: 0,
        },
      });
      const identityMatcherValues = ['+15556192191'];
      const response = await fastify.injectJson({
        method: 'POST',
        url: url(tenant),
        payload: {
          type: ExchangeTypes.ISSUING,
          disclosureId: disclosure._id,
          identityMatcherValues,
        },
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({ id: expect.any(String) });
      const dbResult = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(response.json.id) });
      expect(dbResult).toEqual({
        _id: new ObjectId(response.json.id),
        type: ExchangeTypes.ISSUING,
        identityMatcherValues,
        events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
        disclosureId: new ObjectId(disclosure._id),
        tenantId: new ObjectId(tenant._id),
        createdBy: 'velocity.admin@example.com',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
    it('should 400 if identityMatchValues not set', async () => {
      const disclosure = await persistDisclosure({
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        tenant,
        identityMatchers: {
          rules: [
            {
              valueIndex: 0, // used for identifying the value
              path: ['$.emails'], // jsonPath within the credential
              rule: 'pick', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
            },
          ],
          vendorUserIdIndex: 0,
        },
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: url(tenant),
        payload: {
          disclosureId: disclosure._id,
          type: ExchangeTypes.ISSUING,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message:
            'When disclosure is using the { "vendorEndpoint: "integrated-issuing-identification" } "identityMatcherValues" property is required',
        })
      );
    });

    it('should 400 if missing an identityMatchValue', async () => {
      const disclosure = await persistDisclosure({
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        tenant,
        identityMatchers: {
          rules: [
            {
              valueIndex: 0, // used for identifying the value
              path: ['$.emails'], // jsonPath within the credential
              rule: 'pick', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
            },
          ],
          vendorUserIdIndex: 0,
        },
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: url(tenant),
        payload: {
          disclosureId: disclosure._id,
          type: ExchangeTypes.ISSUING,
          identityMatcherValues: [''],
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: '"identityMatcherValues[0]" must contain a value',
        })
      );
    });

    it('should 400 when if sparse array is missing a value', async () => {
      const disclosure = await persistDisclosure({
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        tenant,
        identityMatchers: {
          rules: [
            {
              valueIndex: 0, // used for identifying the value
              path: ['$.emails'], // jsonPath within the credential
              rule: 'pick', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
            },
          ],
          vendorUserIdIndex: 1,
        },
      });
      // eslint-disable-next-line no-sparse-arrays
      const identityMatcherValues = [10, '', 'adam.smith@example.com', ''];
      const response = await fastify.injectJson({
        method: 'POST',
        url: url(tenant),
        payload: {
          type: ExchangeTypes.ISSUING,
          disclosureId: disclosure._id,
          identityMatcherValues,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'missing_error_code',
          message: '"identityMatcherValues[1]" must contain a value',
        })
      );
    });
  });
});
