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
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const {
  buildAuthMatchValues,
} = require('@verii/credentialing-hub-operator-api');
const { filter, map, omit, sortBy, times } = require('lodash/fp');
const createTestFastify = require('../helpers/create-test-fastify');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const {
  initRelyingPartyServiceFactory,
} = require('../../src/entities/relying-party-services');
const { buildAuthRulesFingerprint } = require('../../src/entities/depots');

const testUrl = '/operator/depots/get';

describe('Find Depots Test Suite', () => {
  let fastify;
  let persistTenant;
  let persistIssuerService;
  let persistRelyingPartyService;
  let findRoute;
  const infoLogs = [];

  let tenant;
  let vpService;

  before(async () => {
    fastify = createTestFastify();
    fastify.addHook('onRoute', (route) => {
      if (route.method === 'POST' && route.url === testUrl) {
        findRoute = route;
      }
    });
    // Records each request's info logs
    fastify.setChildLoggerFactory((logger, bindings, opts) => {
      const child = logger.child(bindings, opts);
      const info = child.info.bind(child);
      child.info = (...args) => {
        infoLogs.push(args);
        return info(...args);
      };
      return child;
    });
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistRelyingPartyService } = initRelyingPartyServiceFactory(fastify));
  });

  const persistVpService = (overrides = {}) =>
    persistIssuerService({
      tenant,
      authMethods: ['verifiable_presentation'],
      authMode: 'internal',
      disclosureRequest: {
        types: [{ type: 'EmailV1.0' }, { type: 'EmploymentPastV1.1' }],
        purpose: 'Identification',
        retentionPeriod: 'P1D',
      },
      verifiablePresentationAuthRules: [
        {
          path: [['credentialSubject', 'email']],
          rule: 'pick',
          valueIndex: 0,
          type: 'EmailV1.0',
        },
        {
          path: [['credentialSubject', 'employeeId']],
          rule: 'equal',
          valueIndex: 1,
          type: 'EmploymentPastV1.1',
        },
      ],
      ...overrides,
    });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('relyingPartyServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    infoLogs.length = 0;
    tenant = await persistTenant();
    vpService = await persistVpService();
  });

  after(async () => {
    await fastify.close();
  });

  const createDepot = async (
    depot,
    { serviceId = vpService._id, tenantId = tenant._id } = {},
  ) => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/operator/depots/create',
      payload: { tenantId, serviceId, depot },
    });
    expect(response.statusCode).toEqual(200);
    return response.json.depot;
  };

  // Inserted without depots/create, which refuses a second depot with the
  // same auth values. Concurrent creates can still leave one. Returns the
  // depot as depots/get returns it.
  const insertDepot = async ({
    userReference,
    authValues,
    service = vpService,
    authRulesFingerprint = buildAuthRulesFingerprint(service),
    tenantId = tenant._id,
  }) => {
    const now = new Date();
    const { insertedId } = await mongoDb()
      .collection('depots')
      .insertOne({
        tenantId: new ObjectId(tenantId),
        serviceId: new ObjectId(service._id),
        userReference,
        authValues,
        authMatchValues: buildAuthMatchValues(authValues),
        authRulesFingerprint,
        deferredCredentials: false,
        createdAt: now,
        updatedAt: now,
      });
    return {
      id: `${insertedId}`,
      serviceId: `${service._id}`,
      userReference,
      authValues,
      deferredCredentials: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  };

  const findDepots = (body) =>
    fastify.injectJson({
      method: 'POST',
      url: testUrl,
      payload: { tenantId: tenant._id, ...body },
    });

  const findByAuthValues = (authValues, body = {}) =>
    findDepots({ serviceId: vpService._id, authValues, ...body });

  const getDepots = ({ tenantId = tenant._id, serviceId, depotId } = {}) => {
    const params = [
      ['tenantId', tenantId],
      ['serviceId', serviceId],
      ...map((id) => ['depotId', id], [].concat(depotId ?? [])),
    ];
    const query = new URLSearchParams(
      filter(([, value]) => value != null, params),
    );
    return fastify.injectJson({ method: 'GET', url: `${testUrl}?${query}` });
  };

  const expectDepots = (response, depots) => {
    expect(response.statusCode).toEqual(200);
    expect({
      ...response.json,
      depots: sortBy('id', response.json.depots),
    }).toEqual({
      depots: sortBy('id', depots),
      requestId: expect.any(String),
    });
  };

  const expectRequestValidationFailed = (response, message) => {
    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        errorCode: 'request_validation_failed',
        message,
      }),
    );
  };

  const expectInvalidAuthValues = (response, index) => {
    expect(response.statusCode).toEqual(400);
    expect(response.json).toEqual(
      errorResponseMatcher({
        statusCode: 400,
        errorCode: 'invalid_auth_values',
        message: `authValues[${index}] must hold one valid value per auth rule`,
      }),
    );
  };

  describe('authValues', () => {
    it('should return the depots whose auth values equal any of the tuples', async () => {
      const janeDepot = await createDepot({
        userReference: 'ABC123',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });
      await createDepot({
        userReference: 'DEF456',
        authValues: ['john.doe@example.com', 'EMP-2'],
      });

      const response = await findByAuthValues([
        ['nobody@example.com', 'EMP-1'],
        ['jane.doe@example.com', 'EMP-1'],
        ['jane.doe@example.com', 'EMP-2'],
      ]);

      expectDepots(response, [janeDepot]);
    });

    it('should return no depots when none has the auth values', async () => {
      await createDepot({
        userReference: 'ABC123',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });

      const response = await findByAuthValues([
        ['jane.doe@example.com', 'EMP-2'],
        ['EMP-1', 'jane.doe@example.com'],
      ]);

      expectDepots(response, []);
    });

    it('should match auth values that differ only in case or surrounding spaces', async () => {
      const depot = await createDepot({
        userReference: 'ABC123',
        authValues: ['Jane.Doe@Example.com', 'EMP-1'],
      });

      const response = await findByAuthValues([
        ['  JANE.DOE@EXAMPLE.COM\t', ' emp-1 '],
      ]);

      expectDepots(response, [depot]);
    });

    it('should match numbers and booleans by type and value', async () => {
      const service = await persistVpService({
        verifiablePresentationAuthRules: [
          {
            path: [['credentialSubject', 'employeeId']],
            rule: 'pick',
            valueIndex: 0,
            type: 'EmploymentPastV1.1',
          },
          {
            path: [['credentialSubject', 'active']],
            rule: 'pick',
            valueIndex: 1,
            type: 'EmploymentPastV1.1',
          },
        ],
      });
      const depot = await createDepot(
        { userReference: 'ABC123', authValues: [42, true] },
        { serviceId: service._id },
      );

      const typeMismatchResponse = await findByAuthValues(
        [
          ['42', true],
          [42, 'true'],
        ],
        { serviceId: service._id },
      );
      expectDepots(typeMismatchResponse, []);

      const response = await findByAuthValues([[42, true]], {
        serviceId: service._id,
      });
      expectDepots(response, [depot]);
    });

    it('should return a depot once when several tuples normalize to its auth values', async () => {
      const depot = await createDepot({
        userReference: 'ABC123',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });

      const response = await findByAuthValues([
        ['jane.doe@example.com', 'EMP-1'],
        ['nobody@example.com', 'EMP-1'],
        [' Jane.Doe@Example.com', 'emp-1'],
      ]);

      expectDepots(response, [depot]);
    });

    it('should return each depot when more than one depot has the auth values', async () => {
      const janeDepots = [
        await insertDepot({
          userReference: 'ABC123',
          authValues: ['jane.doe@example.com', 'EMP-1'],
        }),
        await insertDepot({
          userReference: 'XYZ789',
          authValues: ['Jane.Doe@example.com', 'emp-1'],
        }),
      ];
      const johnDepot = await createDepot({
        userReference: 'DEF456',
        authValues: ['john.doe@example.com', 'EMP-2'],
      });

      const response = await findByAuthValues([
        ['jane.doe@example.com', 'EMP-1'],
        ['john.doe@example.com', 'EMP-2'],
      ]);

      expectDepots(response, [...janeDepots, johnDepot]);
    });

    it('should match for a service with both auth methods', async () => {
      const dualService = await persistVpService({
        authMethods: ['preauth', 'verifiable_presentation'],
      });
      const depot = await createDepot(
        {
          userReference: 'ABC123',
          authValues: ['jane.doe@example.com', 'EMP-1'],
        },
        { serviceId: dualService._id },
      );

      const response = await findByAuthValues(
        [['jane.doe@example.com', 'EMP-1']],
        { serviceId: dualService._id },
      );

      expectDepots(response, [depot]);
    });

    it('should return every depot matching 1000 tuples, beyond a page of 200', async () => {
      const depots = await Promise.all(
        times(
          (i) =>
            insertDepot({
              userReference: `user-${i}`,
              authValues: [`user${i}@example.com`, `EMP-${i}`],
            }),
          250,
        ),
      );

      const response = await findByAuthValues(
        times((i) => [`User${i}@example.com`, `emp-${i}`], 1000),
      );

      expect(response.json.depots).toHaveLength(250);
      expectDepots(response, depots);
    });

    it('should return only the listed depots whose auth values match', async () => {
      const janeDepot = await createDepot({
        userReference: 'ABC123',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });
      const johnDepot = await createDepot({
        userReference: 'DEF456',
        authValues: ['john.doe@example.com', 'EMP-2'],
      });
      const jimDepot = await createDepot({
        userReference: 'GHI789',
        authValues: ['jim.doe@example.com', 'EMP-3'],
      });
      const authValues = [
        ['jane.doe@example.com', 'EMP-1'],
        ['john.doe@example.com', 'EMP-2'],
      ];

      expectDepots(
        await findByAuthValues(authValues, {
          depotId: [janeDepot.id, jimDepot.id],
        }),
        [janeDepot],
      );
      expectDepots(
        await findByAuthValues(authValues, {
          depotId: johnDepot.id.toUpperCase(),
        }),
        [johnDepot],
      );
      expectDepots(
        await findByAuthValues(authValues, { depotId: jimDepot.id }),
        [],
      );
      expectDepots(await findByAuthValues(authValues, { depotId: [] }), [
        janeDepot,
        johnDepot,
      ]);
    });
  });

  describe('authValues isolation', () => {
    it('should not return a depot of another service', async () => {
      const otherService = await persistVpService();
      await createDepot(
        {
          userReference: 'ABC123',
          authValues: ['jane.doe@example.com', 'EMP-1'],
        },
        { serviceId: otherService._id },
      );

      const response = await findByAuthValues([
        ['jane.doe@example.com', 'EMP-1'],
      ]);

      expectDepots(response, []);
    });

    it('should not return a depot of another tenant, nor find its service', async () => {
      const otherTenant = await persistTenant();
      const otherService = await persistVpService({ tenant: otherTenant });
      const otherDepot = await createDepot(
        {
          userReference: 'ABC123',
          authValues: ['jane.doe@example.com', 'EMP-1'],
        },
        { serviceId: otherService._id, tenantId: otherTenant._id },
      );
      await insertDepot({
        userReference: 'DEF456',
        authValues: ['jane.doe@example.com', 'EMP-1'],
        tenantId: otherTenant._id,
      });

      const response = await findByAuthValues([
        ['jane.doe@example.com', 'EMP-1'],
      ]);
      expectDepots(response, []);

      const otherServiceResponse = await findByAuthValues(
        [['jane.doe@example.com', 'EMP-1']],
        { serviceId: otherService._id },
      );
      expect(otherServiceResponse.statusCode).toEqual(404);
      expect(otherServiceResponse.json.errorCode).toEqual('service_not_found');

      const otherTenantResponse = await findByAuthValues(
        [['jane.doe@example.com', 'EMP-1']],
        { serviceId: otherService._id, tenantId: otherTenant._id },
      );
      expectDepots(otherTenantResponse, [otherDepot]);
    });

    it('should not return a depot created under a previous auth configuration', async () => {
      await createDepot({
        userReference: 'ABC123',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });
      await insertDepot({
        userReference: 'DEF456',
        authValues: ['jane.doe@example.com', 'EMP-1'],
        authRulesFingerprint: 'previous-configuration',
      });
      await mongoDb()
        .collection('issuerServices')
        .updateOne(
          { _id: new ObjectId(vpService._id) },
          { $set: { 'verifiablePresentationAuthRules.1.rule': 'pick' } },
        );

      const response = await findByAuthValues([
        ['jane.doe@example.com', 'EMP-1'],
      ]);

      expectDepots(response, []);
    });
  });

  describe('authValues service', () => {
    it('should 400 when authValues has no serviceId', async () => {
      const response = await findDepots({
        authValues: [['jane.doe@example.com', 'EMP-1']],
      });

      expectRequestValidationFailed(
        response,
        "body must NOT be valid, body must have required property 'serviceId', body must match a schema in anyOf",
      );
    });

    it('should 400 for a preauth service', async () => {
      const preauthService = await persistIssuerService({
        tenant,
        authMethods: ['preauth'],
      });

      const response = await findByAuthValues(
        [['jane.doe@example.com', 'EMP-1']],
        { serviceId: preauthService._id },
      );

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'auth_values_filter_not_supported',
          message:
            'Only internal verifiable_presentation issuer services filter depots by auth values',
        }),
      );
    });

    it('should 404 for an unknown service', async () => {
      const serviceId = new ObjectId().toString();

      const response = await findByAuthValues(
        [['jane.doe@example.com', 'EMP-1']],
        { serviceId },
      );

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 404,
          error: 'Not Found',
          errorCode: 'service_not_found',
          message: `Issuer service ${serviceId} not found`,
        }),
      );
    });

    it('should 404 for a relying party service', async () => {
      const relyingPartyService = await persistRelyingPartyService({ tenant });

      const response = await findByAuthValues(
        [['jane.doe@example.com', 'EMP-1']],
        { serviceId: relyingPartyService._id },
      );

      expect(response.statusCode).toEqual(404);
      expect(response.json.errorCode).toEqual('service_not_found');
    });

    it('should 400 for an unknown tenant', async () => {
      const response = await findByAuthValues(
        [['jane.doe@example.com', 'EMP-1']],
        { tenantId: new ObjectId().toString() },
      );

      expect(response.statusCode).toEqual(400);
      expect(response.json.errorCode).toEqual('tenant_not_found');
    });
  });

  describe('authValues validation', () => {
    it('should 400 when a tuple has fewer values than rules, naming its index', async () => {
      const response = await findByAuthValues([
        ['jane.doe@example.com', 'EMP-1'],
        ['jane.doe@example.com'],
      ]);

      expectInvalidAuthValues(response, 1);
    });

    it('should 400 when a tuple has more values than rules', async () => {
      const response = await findByAuthValues([
        ['jane.doe@example.com', 'EMP-1', 'extra'],
      ]);

      expectInvalidAuthValues(response, 0);
    });

    it('should 400 when an auth value is empty', async () => {
      const response = await findByAuthValues([
        ['jane.doe@example.com', 'EMP-1'],
        ['john.doe@example.com', 'EMP-2'],
        ['nobody@example.com', ''],
      ]);

      expectInvalidAuthValues(response, 2);
    });

    it('should 400 when an auth value is blank, without echoing the values', async () => {
      const response = await findByAuthValues([
        ['jane.doe@example.com', 'EMP-1'],
        ['   ', 'EMP-2'],
      ]);

      expectInvalidAuthValues(response, 1);
      expect(response.body).not.toContain('example.com');
      expect(response.body).not.toContain('EMP-');
    });

    it('should 400 when there are more than 1000 tuples', async () => {
      const response = await findByAuthValues(
        times((i) => [`user${i}@example.com`, `EMP-${i}`], 1001),
      );

      expectRequestValidationFailed(
        response,
        'body/authValues must NOT have more than 1000 items',
      );
    });

    it('should 400 when a tuple has more than 10 values', async () => {
      const response = await findByAuthValues([times((i) => `value-${i}`, 11)]);

      expectRequestValidationFailed(
        response,
        'body/authValues/0 must NOT have more than 10 items',
      );
    });

    it('should 400 when a tuple is empty', async () => {
      const response = await findByAuthValues([[]]);

      expectRequestValidationFailed(
        response,
        'body/authValues/0 must NOT have fewer than 1 items',
      );
    });

    it('should 400 when there are no tuples', async () => {
      const response = await findByAuthValues([]);

      expectRequestValidationFailed(
        response,
        'body/authValues must NOT have fewer than 1 items',
      );
    });

    it('should 400 when an auth value is not a string, number or boolean', async () => {
      const response = await findByAuthValues([
        ['jane.doe@example.com', { id: 'EMP-1' }],
      ]);

      expect(response.statusCode).toEqual(400);
      expect(response.json.errorCode).toEqual('request_validation_failed');
    });

    it('should 400 for an unknown property', async () => {
      const response = await findByAuthValues(
        [['jane.doe@example.com', 'EMP-1']],
        { userReference: 'ABC123' },
      );

      expectRequestValidationFailed(
        response,
        'body must NOT have additional properties',
      );
    });

    it('should 400 without a tenantId', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: testUrl,
        payload: { serviceId: vpService._id },
      });

      expectRequestValidationFailed(
        response,
        "body must have required property 'tenantId'",
      );
    });
  });

  describe('without authValues', () => {
    it('should return the same depots as GET depots/get for the same filters', async () => {
      const preauthService = await persistIssuerService({
        tenant,
        authMethods: ['preauth'],
      });
      const vpDepots = [
        await createDepot({
          userReference: 'ABC123',
          authValues: ['jane.doe@example.com', 'EMP-1'],
        }),
        await createDepot({
          userReference: 'DEF456',
          authValues: ['john.doe@example.com', 'EMP-2'],
        }),
      ];
      const preauthDepot = await createDepot(
        { userReference: 'GHI789' },
        { serviceId: preauthService._id },
      );
      const otherTenant = await persistTenant();
      const otherService = await persistVpService({ tenant: otherTenant });
      await createDepot(
        {
          userReference: 'JKL012',
          authValues: ['jane.doe@example.com', 'EMP-1'],
        },
        { serviceId: otherService._id, tenantId: otherTenant._id },
      );

      const expectations = [
        [{}, [...vpDepots, preauthDepot]],
        [{ serviceId: vpService._id }, vpDepots],
        [{ serviceId: preauthService._id }, [preauthDepot]],
        [{ depotId: preauthDepot.id }, [preauthDepot]],
        [
          { depotId: [vpDepots[0].id, preauthDepot.id] },
          [vpDepots[0], preauthDepot],
        ],
        [
          {
            serviceId: vpService._id,
            depotId: [vpDepots[1].id, preauthDepot.id],
          },
          [vpDepots[1]],
        ],
      ];
      const responses = await Promise.all(
        map(
          ([filters]) => Promise.all([findDepots(filters), getDepots(filters)]),
          expectations,
        ),
      );

      responses.forEach(([response, getResponse], i) => {
        expect(getResponse.statusCode).toEqual(200);
        expect(response.json.depots).toEqual(getResponse.json.depots);
        expectDepots(response, expectations[i][1]);
      });
    });

    it('should page like GET depots/get', async () => {
      await Promise.all(
        times(
          (i) =>
            insertDepot({
              userReference: `user-${i}`,
              authValues: [`user${i}@example.com`, `EMP-${i}`],
            }),
          250,
        ),
      );

      const response = await findDepots({ serviceId: vpService._id });
      const getResponse = await getDepots({ serviceId: vpService._id });

      expect(response.statusCode).toEqual(200);
      expect(response.json.depots).toHaveLength(200);
      expect(response.json.depots).toEqual(getResponse.json.depots);
    });
  });

  describe('logging', () => {
    it('should keep the request body out of the request logs', () => {
      expect(findRoute.config).toEqual(
        expect.objectContaining({ sensitiveLogging: true }),
      );
    });

    it('should log counts only, never the auth values', async () => {
      await createDepot({
        userReference: 'ABC123',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });
      infoLogs.length = 0;

      const response = await findByAuthValues([
        ['jane.doe@example.com', 'EMP-1'],
        [' Jane.Doe@example.com', 'emp-1'],
        ['nobody@example.com', 'EMP-1'],
      ]);

      expect(response.statusCode).toEqual(200);
      expect(
        filter(
          ([, message]) => message === 'find depots by auth values',
          infoLogs,
        ),
      ).toEqual([
        [
          { serviceId: vpService._id, tupleCount: 3, depotCount: 1 },
          'find depots by auth values',
        ],
      ]);
      const loggedText = JSON.stringify(
        map(
          ([entry, message]) => [omit(['req', 'res'], entry), message],
          infoLogs,
        ),
      ).toLowerCase();
      expect(loggedText).not.toContain('example.com');
      expect(loggedText).not.toContain('emp-1');
    });
  });
});
