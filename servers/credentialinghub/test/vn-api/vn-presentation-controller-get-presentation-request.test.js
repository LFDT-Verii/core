/*
 * Copyright 2025 Velocity Team
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
  mockHttpClientJsonResponse,
  mockHttpClient,
  mockHttpClientModule,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const qs = require('qs');
const { ObjectId } = require('mongodb');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const { jwtVerify } = require('@verii/jwt');
const { map, entries, omit, set } = require('lodash/fp');
const testPresentationDefinition = require('../helpers/presentation-definition.json');
const {
  ExchangeStates,
  ExchangeProtocols,
  ExchangeTypes,
  ExchangeErrors,
} = require('../../src/entities/exchanges');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initRelyingPartyServiceFactory,
} = require('../../src/entities/relying-party-services');
const { initDepotFactory } = require('../../src/entities/depots');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');

const agentUrl = 'https://localhost.test';

const vnUrl = ({ did }) => `/vn-api/r/${did}`;

const testUrl = (tenant2, queryParams) => {
  const baseUrl = `${vnUrl(tenant2)}/get-presentation-request`;
  const queryString = qs.stringify(queryParams, { indices: false });
  return `${baseUrl}?${queryString}`;
};

describe('vn-api > get presentation requests', () => {
  let fastify;

  let tenant;
  let relyingPartyKey;
  let relyingPartyKeyPair;

  let persistTenant;
  let persistKey;
  let persistRelyingPartyService;
  let persistDepot;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistRelyingPartyService } = initRelyingPartyServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    ({
      tenant,
      issuerKey: relyingPartyKey,
      issuerKeyPair: relyingPartyKeyPair,
    } = await constructTenant(persistTenant, persistKey));
  });

  beforeEach(async () => {
    await mongoDb().collection('relyingPartyServices').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    resetMockHttpClient();
  });

  after(async () => {
    await fastify.close();
  });

  it("should 400 when serviceId can't be found", async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: testUrl(tenant, { id: new ObjectId().toString() }),
    });

    expect(response.statusCode).toEqual(400);
  });

  it('should 400, when invalid push_delegate provided', async () => {
    const relyingPartyService = await persistRelyingPartyService({
      tenant,
      description: 'Presentation Disclosure',
    });

    const payload = {
      id: relyingPartyService._id,
      'push_delegate.push_url': 'https://wallet.com/push_gateway',
      locale: 'en_US',
    };
    const response = await fastify.injectJson({
      method: 'GET',
      url: testUrl(tenant, payload),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        errorCode: ExchangeErrors.MESSAGING_SETTINGS_INVALID,
        message: ExchangeErrors.MESSAGING_SETTINGS_INVALID,
      }),
    );

    const dbExchange = await mongoDb()
      .collection('exchanges')
      .findOne({ serviceId: new ObjectId(relyingPartyService._id) });
    expect(dbExchange).toBeNull();
  });

  it('should 400 with referenced_service_not_found when service is deactivated', async () => {
    const relyingPartyService = await persistRelyingPartyService({
      tenant,
      description: 'Presentation Disclosure',
      deactivationDate: new Date(),
    });

    const payload = { id: relyingPartyService._id };
    const response = await fastify.injectJson({
      method: 'GET',
      url: testUrl(tenant, payload),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        errorCode: 'referenced_service_not_found',
        message: 'referenced_service_not_found',
      }),
    );

    const dbExchange = await mongoDb()
      .collection('exchanges')
      .findOne({ serviceId: new ObjectId(relyingPartyService._id) });
    expect(dbExchange).toBeNull();
  });

  it('should 400 with referenced_depot_not_found when vendorOriginContext references a depot for another service', async () => {
    const relyingPartyService = await persistRelyingPartyService({
      tenant,
      description: 'Presentation Disclosure',
    });
    const otherRelyingPartyService = await persistRelyingPartyService({
      tenant,
      description: 'Other Presentation Disclosure',
    });
    const otherDepot = await persistDepot({
      tenant,
      service: otherRelyingPartyService,
    });

    const response = await fastify.injectJson({
      method: 'GET',
      url: testUrl(tenant, {
        id: relyingPartyService._id,
        vendorOriginContext: `depot:${otherDepot._id}`,
      }),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        errorCode: ExchangeErrors.REFERENCED_DEPOT_NOT_FOUND,
        message: ExchangeErrors.REFERENCED_DEPOT_NOT_FOUND,
      }),
    );

    const dbExchange = await mongoDb()
      .collection('exchanges')
      .findOne({ serviceId: new ObjectId(relyingPartyService._id) });
    expect(dbExchange).toBeNull();
  });

  describe('successful use cases', () => {
    it('should 200 for disclosureRequest', async () => {
      const relyingPartyService = await persistRelyingPartyService({
        tenant,
        description: 'Presentation Disclosure',
        disclosureRequest: {
          types: [{ type: 'EmailV1.0' }],
          purpose: 'Identification',
          retentionPeriod: '3w',
        },
      });

      mockHttpClientJsonResponse('get', inputDescriptor('EmailV1.0'));
      const payload = {
        id: relyingPartyService._id,
        format: 'json',
      };
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl(tenant, payload),
      });

      expect(response.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ serviceId: new ObjectId(relyingPartyService._id) });
      expect(dbExchange).toEqual(
        expectedDbExchange(tenant, relyingPartyService),
      );

      expect(response.json).toEqual({
        presentation_request: expectedPresentationRequest(
          tenant,
          relyingPartyService,
          dbExchange,
          payload,
        ),
      });

      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        'api/v0.6/credential-type-descriptors/EmailV1.0',
        {
          searchParams: new URLSearchParams('includeDisplay=false'),
        },
      ]);

      const dbDepot = await mongoDb()
        .collection('depots')
        .findOne({ _id: new ObjectId(dbExchange.depotId) });
      expect(dbDepot).toEqual(expectedDbDepot(tenant, relyingPartyService));
    });

    it('should 200 and reuse a depot from vendorOriginContext', async () => {
      const relyingPartyService = await persistRelyingPartyService({
        tenant,
        description: 'Presentation Disclosure',
        disclosureRequest: {
          types: [{ type: 'EmailV1.0' }],
          purpose: 'Identification',
          retentionPeriod: '3w',
        },
      });
      const depot = await persistDepot({
        tenant,
        service: relyingPartyService,
      });

      mockHttpClientJsonResponse('get', inputDescriptor('EmailV1.0'));
      const payload = {
        id: relyingPartyService._id,
        vendorOriginContext: `depot:${depot._id}`,
        format: 'json',
      };
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl(tenant, payload),
      });

      expect(response.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ serviceId: new ObjectId(relyingPartyService._id) });
      expect(dbExchange).toEqual(
        expectedDbExchange(tenant, relyingPartyService, undefined, {
          depotId: new ObjectId(depot._id),
        }),
      );

      expect(response.json).toEqual({
        presentation_request: expectedPresentationRequest(
          tenant,
          relyingPartyService,
          dbExchange,
          payload,
        ),
      });

      const dbDepots = await mongoDb().collection('depots').find({}).toArray();
      expect(dbDepots).toEqual([
        expectedDbDepot(tenant, relyingPartyService, {
          _id: new ObjectId(depot._id),
        }),
      ]);
    });

    it('should 200 for a feed', async () => {
      const relyingPartyService = await persistRelyingPartyService({
        mode: 'feed',
        tenant,
        description: 'Presentation Disclosure',
        disclosureRequest: {
          types: [{ type: 'EmailV1.0' }],
          purpose: 'Identification',
          retentionPeriod: '3w',
        },
      });

      mockHttpClientJsonResponse('get', inputDescriptor('EmailV1.0'));
      const payload = {
        id: relyingPartyService._id,
        format: 'json',
      };
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl(tenant, payload),
      });

      expect(response.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ serviceId: new ObjectId(relyingPartyService._id) });
      expect(dbExchange).toEqual(
        expectedDbExchange(tenant, relyingPartyService),
      );

      expect(response.json).toEqual({
        presentation_request: expectedPresentationRequest(
          tenant,
          relyingPartyService,
          dbExchange,
          payload,
        ),
      });

      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        'api/v0.6/credential-type-descriptors/EmailV1.0',
        {
          searchParams: new URLSearchParams('includeDisplay=false'),
        },
      ]);

      const dbDepot = await mongoDb()
        .collection('depots')
        .findOne({ _id: new ObjectId(dbExchange.depotId) });
      expect(dbDepot).toEqual(expectedDbDepot(tenant, relyingPartyService));
    });

    it('should 200, for presentationDefinition auth', async () => {
      const relyingPartyService = await persistRelyingPartyService({
        tenant,
        description: 'Presentation Disclosure',
        presentationDefinition: testPresentationDefinition,
      });

      const payload = {
        id: relyingPartyService._id,
        format: 'json',
      };
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl(tenant, payload),
      });
      expect(response.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ serviceId: new ObjectId(relyingPartyService._id) });
      expect(dbExchange).toEqual(
        expectedDbExchange(tenant, relyingPartyService),
      );

      expect(response.json).toEqual({
        presentation_request: expectedPresentationRequest(
          tenant,
          relyingPartyService,
          dbExchange,
          payload,
        ),
      });

      const dbDepot = await mongoDb()
        .collection('depots')
        .findOne({ _id: new ObjectId(dbExchange.depotId) });
      expect(dbDepot).toEqual(expectedDbDepot(tenant, relyingPartyService));
    });

    it('should 200 when pushDelegate, english locale provided', async () => {
      const relyingPartyService = await persistRelyingPartyService({
        tenant,
        description: 'Presentation Disclosure',
      });
      mockHttpClientJsonResponse('get', descriptors.PastEmploymentPosition);

      const payload = {
        id: relyingPartyService._id,
        'push_delegate.push_url': 'https://wallet.com/push_gateway',
        'push_delegate.push_token': 'abc123',
        locale: 'en_US',
        format: 'json',
      };
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl(tenant, payload),
      });

      expect(response.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ serviceId: new ObjectId(relyingPartyService._id) });
      expect(dbExchange).toEqual(
        expectedDbExchange(tenant, relyingPartyService, undefined, {
          locale: payload.locale,
          messagingSettings: {
            authToken: payload['push_delegate.push_token'],
            webhookUrl: payload['push_delegate.push_url'],
          },
        }),
      );

      expect(response.json).toEqual({
        presentation_request: expectedPresentationRequest(
          tenant,
          relyingPartyService,
          dbExchange,
          payload,
        ),
      });

      const dbDepot = await mongoDb()
        .collection('depots')
        .findOne({ _id: new ObjectId(dbExchange.depotId) });
      expect(dbDepot).toEqual(expectedDbDepot(tenant, relyingPartyService));
    });

    it('should 200 for signed response', async () => {
      const relyingPartyService = await persistRelyingPartyService({
        tenant,
        description: 'Presentation Disclosure',
      });

      const payload = {
        id: relyingPartyService._id,
      };
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl(tenant, payload),
      });

      expect(response.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ serviceId: new ObjectId(relyingPartyService._id) });
      expect(dbExchange).toEqual(
        expectedDbExchange(tenant, relyingPartyService),
      );

      expect(response.json).toEqual({
        presentation_request: expect.any(String),
      });

      await expect(
        jwtVerify(
          response.json.presentation_request,
          relyingPartyKeyPair.publicKey,
        ),
      ).resolves.toEqual({
        header: {
          typ: 'JWT',
          alg: 'ES256K',
          kid: `${tenant.did}${relyingPartyKey.kidFragment}`,
        },
        payload: {
          ...expectedPresentationRequest(
            tenant,
            relyingPartyService,
            dbExchange,
            payload,
          ),
          iss: tenant.did,
          iat: expect.any(Number),
          nbf: expect.any(Number),
          exp: expect.any(Number),
        },
      });
    });
  });
});

const descriptors = {
  PastEmploymentPosition: {
    id: 'PastEmploymentPosition',
    name: 'Past Role',
    schema: [
      {
        uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
      },
    ],
    display: {
      title: {
        path: '$.employment',
      },
    },
  },
  'EmailV1.0': {
    id: 'EmailV1.0',
    name: 'Email',
    schema: [
      {
        uri: 'http://oracle.localhost.test/schemas/Email.json',
      },
    ],
    display: {
      title: {
        path: '$.email',
      },
    },
  },
  EducationDegree: {
    id: 'EducationDegree',
    name: 'Education Degree',
    schema: [
      {
        uri: 'http://oracle.localhost.test/schemas/Education Degree.json',
      },
    ],
    display: {
      title: {
        path: '$.programName',
      },
    },
  },
};

const inputDescriptor = (type, group) => {
  const descriptor = omit(['display'], descriptors[type]);
  if (group != null) {
    descriptor.group = group;
  }
  return descriptor;
};

const expectedPresentationRequest = (
  tenant,
  relyingPartyService,
  dbExchange,
) => ({
  exchange_id: expect.any(String),
  presentation_definition: {
    id: `${dbExchange._id}.${relyingPartyService._id}`,
    name: relyingPartyService.description,
    purpose: relyingPartyService.disclosureRequest?.purpose ?? '',
    format: {
      jwt_vp: { alg: ['secp256k1'] },
    },
    input_descriptors: map(
      ({ type }) => inputDescriptor(type, ['A']),
      relyingPartyService.disclosureRequest?.types,
    ),
    submission_requirements: [
      {
        from: 'A',
        min: 1,
        rule: 'pick',
      },
    ],
    ...relyingPartyService.presentationDefinition,
  },
  metadata: {
    client_name: tenant.name,
    logo_uri: tenant.logo,
    tos_uri: relyingPartyService.termsUrl,
    max_retention_period:
      relyingPartyService.disclosureRequest?.retentionPeriod ?? '',
    auth_token_uri: `${agentUrl}${vnUrl(tenant)}/oauth/token`,
    progress_uri: `${agentUrl}${vnUrl(tenant)}/get-exchange-progress`,
    submit_presentation_uri: `${agentUrl}${vnUrl(tenant)}/presentation`,
    feed: relyingPartyService.mode === 'feed',
  },
});

const expectedDbExchange = (tenant, relyingPartyService, events, overrides) => {
  const exchangeEvents = events ?? [
    ExchangeStates.NEW,
    ExchangeStates.PRESENTATION_REQUEST_REQUESTED,
  ];
  let expectation = {
    _id: expect.any(ObjectId),
    protocolMetadata: { protocol: ExchangeProtocols.VN_API },
    depotId: expect.any(ObjectId),
    events: exchangeEvents.map((state) => ({
      state,
      timestamp: expect.any(Date),
    })),
    serviceId: new ObjectId(relyingPartyService._id),
    type: ExchangeTypes.RELYING_PARTY,
    tenantId: new ObjectId(tenant._id),
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
  };

  for (const [relyingPartyKey, value] of entries(overrides)) {
    expectation = set(relyingPartyKey, value, expectation);
  }

  return expectation;
};

const expectedDbDepot = (tenant, relyingPartyService, overrides) => {
  let expectation = {
    _id: expect.any(ObjectId),
    serviceId: new ObjectId(relyingPartyService._id),
    tenantId: new ObjectId(tenant._id),
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
  };

  for (const [relyingPartyKey, value] of entries(overrides)) {
    expectation = set(relyingPartyKey, value, expectation);
  }

  return expectation;
};
