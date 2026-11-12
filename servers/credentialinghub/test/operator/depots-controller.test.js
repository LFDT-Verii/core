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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { errorResponseMatcher, mongoify } = require('@verii/tests-helpers');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const { nanoid } = require('nanoid');
const { constant, forEach, omit, repeat, times } = require('lodash/fp');
const createTestFastify = require('../helpers/create-test-fastify');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const {
  initRelyingPartyServiceFactory,
} = require('../../src/entities/relying-party-services');
const {
  buildAuthRulesFingerprint,
  depotRepoPlugin,
  initDepotFactory,
} = require('../../src/entities/depots');
const { initCredentialFactory } = require('../../src/entities/credentials');

const testUrl = '/operator/depots';

// The request schema limits the number of authValues and the userReference's
// length
const INVALID_DEPOTS = [
  {
    name: 'authValues is empty',
    depot: { userReference: 'ABC123', authValues: [] },
    message: 'body/depot/authValues must NOT have fewer than 1 items',
  },
  {
    name: 'there are more than 10 authValues',
    depot: { userReference: 'ABC123', authValues: times(constant('a'), 11) },
    message: 'body/depot/authValues must NOT have more than 10 items',
  },
  {
    name: 'userReference is empty',
    depot: { userReference: '' },
    message: 'body/depot/userReference must NOT have fewer than 1 characters',
  },
  {
    name: 'userReference is longer than 64 characters',
    depot: { userReference: repeat(65, 'u') },
    message: 'body/depot/userReference must NOT have more than 64 characters',
  },
];

// An auth value is a number, a non-blank string or a boolean, so a string that
// fails fails every branch of the anyOf
const authValueErrorMessage = (index, stringError) => {
  const path = `body/depot/authValues/${index}`;
  return `${path} must be number, ${path} ${stringError}, ${path} must be boolean, ${path} must match a schema in anyOf`;
};
describe('Depots Test suite', () => {
  let fastify;
  let persistTenant;
  let persistIssuerService;
  let persistRelyingPartyService;
  let persistDepot;
  let persistCredential;

  let tenant;
  let issuerService;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistRelyingPartyService } = initRelyingPartyServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistCredential } = initCredentialFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('relyingPartyServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    tenant = await persistTenant();
    issuerService = await persistIssuerService({
      tenant,
      authMethods: ['preauth'],
    });
  });

  after(async () => {
    await fastify.close();
  });

  describe('Depot Creation Test Suite', () => {
    it('should 400 if depot.serviceId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: { tenantId: tenant._id },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body must have required property 'serviceId'",
        }),
      );
    });
    it('should 400 if referenced issuer service does not exist', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          serviceId: new ObjectId().toString(),
          depot: { userReference: 'ABC123' },
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          message: 'referenced_service_not_found',
          errorCode: 'referenced_service_not_found',
        }),
      );
    });
    it('should 400 if referenced issuer service is deactivated', async () => {
      const deactivatedIssuerService = await persistIssuerService({
        tenant,
        authMethods: ['preauth'],
        deactivationDate: new Date(),
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          serviceId: deactivatedIssuerService._id,
          depot: { userReference: 'ABC123' },
        },
      });

      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          message: 'referenced_service_not_found',
          errorCode: 'referenced_service_not_found',
        }),
      );
    });
    it('should 400 if referenced relying party service is deactivated', async () => {
      const relyingPartyService = await persistRelyingPartyService({
        tenant,
        deactivationDate: new Date(),
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          serviceId: relyingPartyService._id,
          depot: { userReference: 'RP-USER-123' },
        },
      });

      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          message: 'referenced_service_not_found',
          errorCode: 'referenced_service_not_found',
        }),
      );
    });
    it('should 400 if userReference is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depot: { authValues: [1] },
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body/depot must have required property 'userReference'",
        }),
      );
    });
    forEach(({ name, depot, message }) => {
      it(`should 400 if ${name}`, async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create`,
          payload: {
            tenantId: tenant._id,
            serviceId: issuerService._id,
            depot,
          },
        });
        expect(response.json).toEqual(
          errorResponseMatcher({
            statusCode: 400,
            errorCode: 'request_validation_failed',
            message,
          }),
        );
      });
    }, INVALID_DEPOTS);
    it('should 400 for a depot without authValues for a VP rulesEngine service', async () => {
      const vpService = await persistIssuerService({ tenant });
      const payload = {
        tenantId: tenant._id,
        serviceId: vpService._id,
        depot: { userReference: 'ABC123' },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'invalid_auth_values',
          message: 'invalid_auth_values',
          statusCode: 400,
        }),
      );
    });
    it('should 400 if depot contains messagingSettings', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depot: {
            userReference: 'ABC123',
            messagingSettings: {
              webhookUrl: 'https://wallet.example.com/push',
              authToken: 'push-token',
            },
          },
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: 'body/depot must NOT have additional properties',
        }),
      );
    });
    it('should 400 if expectedCredentialTypes is empty', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depot: { userReference: 'ABC123', expectedCredentialTypes: [] },
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message:
            'body/depot/expectedCredentialTypes must NOT have fewer than 1 items',
        }),
      );
    });
    it('should 400 if expectedCredentialTypes has duplicates', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depot: {
            userReference: 'ABC123',
            expectedCredentialTypes: ['EmailV1.0', 'EmailV1.0'],
          },
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message:
            'body/depot/expectedCredentialTypes must NOT have duplicate items (items ## 1 and 0 are identical)',
        }),
      );
    });
    it('should 400 for a relying party service depot with deferred credentials', async () => {
      const relyingPartyService = await persistRelyingPartyService({ tenant });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          serviceId: relyingPartyService._id,
          depot: { userReference: 'RP-USER-123', deferredCredentials: true },
        },
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'deferred_credentials_not_supported',
          message: 'deferred_credentials_not_supported',
        }),
      );
      await expect(
        mongoDb().collection('depots').countDocuments({}),
      ).resolves.toEqual(0);
    });
    it('should 200 for a depot with deferred credentials and expected credential types', async () => {
      const payload = {
        tenantId: tenant._id,
        serviceId: issuerService._id,
        depot: {
          userReference: 'ABC123',
          deferredCredentials: true,
          expectedCredentialTypes: ['EmailV1.0', 'PhoneV1.0'],
        },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        depot: {
          ...payload.depot,
          serviceId: payload.serviceId,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
        requestId: expect.any(String),
      });

      await expect(
        mongoDb().collection('depots').find({}).toArray(),
      ).resolves.toEqual([expectedDbDepot(response.json.depot, tenant)]);
    });
    it('should 200 for a correctly setup depot', async () => {
      const payload = {
        tenantId: tenant._id,
        serviceId: issuerService._id,
        depot: { userReference: 'ABC123' },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload,
      });
      expect(response.json).toEqual({
        depot: {
          ...payload.depot,
          deferredCredentials: false,
          serviceId: payload.serviceId,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
        requestId: expect.any(String),
      });

      await expect(
        mongoDb().collection('depots').find({}).toArray(),
      ).resolves.toEqual([expectedDbDepot(response.json.depot, tenant)]);
    });

    it('should 200 for a relying party service depot', async () => {
      const relyingPartyService = await persistRelyingPartyService({ tenant });
      const payload = {
        tenantId: tenant._id,
        serviceId: relyingPartyService._id,
        depot: { userReference: 'RP-USER-123' },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        depot: {
          ...payload.depot,
          deferredCredentials: false,
          serviceId: payload.serviceId,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
        requestId: expect.any(String),
      });
      await expect(
        mongoDb().collection('depots').find({}).toArray(),
      ).resolves.toEqual([expectedDbDepot(response.json.depot, tenant)]);
    });

    it('should 200 for a correctly setup depot with authValues', async () => {
      const payload = {
        tenantId: tenant._id,
        serviceId: issuerService._id,
        depot: {
          userReference: 'ABC123',
          authValues: [' Jane.Doe@Example.COM ', 1, true],
        },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload,
      });
      expect(response.json).toEqual({
        depot: {
          ...payload.depot,
          deferredCredentials: false,
          serviceId: payload.serviceId,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
        requestId: expect.any(String),
      });

      await expect(
        mongoDb().collection('depots').find({}).toArray(),
      ).resolves.toEqual([expectedDbDepot(response.json.depot, tenant)]);
    });

    it('should 200 for a depot with 10 authValues and a 64 character userReference', async () => {
      const depot = {
        userReference: repeat(64, 'u'),
        authValues: times(constant('a'), 10),
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: { tenantId: tenant._id, serviceId: issuerService._id, depot },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json.depot).toEqual(expect.objectContaining(depot));
    });

    it('should index depots by service, auth rules fingerprint and authMatchValues', async () => {
      const indexes = await mongoDb().collection('depots').indexes();
      expect(indexes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: {
              tenantId: 1,
              serviceId: 1,
              authRulesFingerprint: 1,
              authMatchValues: 1,
            },
          }),
        ]),
      );
      expect(
        indexes.find(
          ({ key }) => key.authRulesFingerprint === 1 && key.authMatchValues,
        ).collation,
      ).toBeUndefined();
    });
  });

  describe('Depot Creation for Verifiable Presentation Services Test Suite', () => {
    let vpService;

    const createDepot = (serviceId, depot) =>
      fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: { tenantId: tenant._id, serviceId, depot },
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
            valueType: 'string',
          },
          {
            path: [['credentialSubject', 'employeeId']],
            rule: 'equal',
            valueIndex: 1,
            type: 'EmploymentPastV1.1',
            valueType: 'string',
          },
        ],
        ...overrides,
      });

    const expectInvalidAuthValues = (
      response,
      message = 'invalid_auth_values',
    ) => {
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'invalid_auth_values',
          message,
        }),
      );
    };

    const invalidAuthValueMessage = (index) =>
      `authValues[${index}] must be a non-blank value of its auth rule's valueType and valueFormat`;

    beforeEach(async () => {
      vpService = await persistVpService();
    });

    it('should store normalized authMatchValues in order, and never return them', async () => {
      const authValues = ['  Jane.Doe@Example.COM\t', ' EMP-42 '];
      const response = await createDepot(vpService._id, {
        userReference: 'ABC123',
        authValues,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        depot: {
          userReference: 'ABC123',
          authValues,
          deferredCredentials: false,
          serviceId: vpService._id,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
        requestId: expect.any(String),
      });
      await expect(
        mongoDb().collection('depots').find({}).toArray(),
      ).resolves.toEqual([
        {
          ...expectedDbDepot(response.json.depot, tenant),
          authMatchValues: ['jane.doe@example.com', 'emp-42'],
          authRulesFingerprint: buildAuthRulesFingerprint(vpService),
        },
      ]);
      expect(buildAuthRulesFingerprint(vpService)).toEqual(expect.any(String));

      const getResponse = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&serviceId=${vpService._id}`,
      });
      expect(getResponse.statusCode).toEqual(200);
      expect(getResponse.json).toEqual({
        depots: [response.json.depot],
        requestId: expect.any(String),
      });
    });

    it('should 400 when there are fewer authValues than rules', async () => {
      const response = await createDepot(vpService._id, {
        userReference: 'ABC123',
        authValues: ['jane.doe@example.com'],
      });

      expectInvalidAuthValues(response);
    });

    it('should 400 when there are more authValues than rules', async () => {
      const response = await createDepot(vpService._id, {
        userReference: 'ABC123',
        authValues: ['jane.doe@example.com', 'EMP-1', 'extra'],
      });

      expectInvalidAuthValues(response);
    });

    it('should 400 when an auth value is empty', async () => {
      const response = await createDepot(vpService._id, {
        userReference: 'ABC123',
        authValues: ['jane.doe@example.com', ''],
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'request_validation_failed',
          message: authValueErrorMessage(
            1,
            'must NOT have fewer than 1 characters',
          ),
        }),
      );
    });

    it('should 400 when an auth value is blank', async () => {
      const response = await createDepot(vpService._id, {
        userReference: 'ABC123',
        authValues: [' \t\n', 'EMP-1'],
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          errorCode: 'request_validation_failed',
          message: authValueErrorMessage(0, 'must match pattern "\\S"'),
        }),
      );
      await expect(
        mongoDb().collection('depots').countDocuments({}),
      ).resolves.toEqual(0);
    });

    describe('auth value types and formats', () => {
      // Listed out of valueIndex order: each value is checked against the
      // rule at its valueIndex.
      const typedRules = [
        {
          path: [['credentialSubject', 'phone']],
          rule: 'pick',
          valueIndex: 3,
          type: 'PhoneV1.0',
          valueType: 'string',
          valueFormat: 'e164',
        },
        {
          path: [['credentialSubject', 'email']],
          rule: 'pick',
          valueIndex: 0,
          type: 'EmailV1.0',
          valueType: 'string',
          valueFormat: 'email',
        },
        {
          path: [['credentialSubject', 'employeeId']],
          rule: 'equal',
          valueIndex: 1,
          type: 'EmploymentPastV1.1',
          valueType: 'number',
        },
        {
          path: [['credentialSubject', 'current']],
          rule: 'equal',
          valueIndex: 2,
          type: 'EmploymentPastV1.1',
          valueType: 'boolean',
        },
        {
          path: [['credentialSubject', 'department']],
          rule: 'equal',
          valueIndex: 4,
          type: 'EmploymentPastV1.1',
          valueType: 'string',
        },
      ];
      const validAuthValues = [
        ' Jane.Doe@Example.com ',
        12345,
        true,
        '+15556192191',
        'Sales',
      ];
      const withValue = (index, value) =>
        validAuthValues.map((validValue, i) =>
          i === index ? value : validValue,
        );
      let typedService;

      beforeEach(async () => {
        typedService = await persistVpService({
          disclosureRequest: {
            types: [
              { type: 'EmailV1.0' },
              { type: 'EmploymentPastV1.1' },
              { type: 'PhoneV1.0' },
            ],
            purpose: 'Identification',
            retentionPeriod: 'P1D',
          },
          verifiablePresentationAuthRules: typedRules,
        });
      });

      it("should 200 for values of each rule's valueType and valueFormat", async () => {
        const response = await createDepot(typedService._id, {
          userReference: 'ABC123',
          authValues: validAuthValues,
        });

        expect(response.statusCode).toEqual(200);
        await expect(
          mongoDb().collection('depots').findOne({}),
        ).resolves.toEqual(
          expect.objectContaining({
            authValues: validAuthValues,
            authMatchValues: [
              'jane.doe@example.com',
              12345,
              true,
              '+15556192191',
              'sales',
            ],
            authRulesFingerprint: buildAuthRulesFingerprint(typedService),
          }),
        );
      });

      it('should 200 for other values of each type and format', async () => {
        const response = await createDepot(typedService._id, {
          userReference: 'ABC123',
          authValues: [
            'adam+hub@mail.example.co.uk',
            0,
            false,
            '+442071838750',
            '12345',
          ],
        });

        expect(response.statusCode).toEqual(200);
      });

      const invalidValues = [
        { name: 'a number for an email rule', index: 0, value: 12345 },
        { name: 'a value that is not an email', index: 0, value: 'jane.doe' },
        {
          name: 'an email with a space',
          index: 0,
          value: 'jane doe@example.com',
        },
        { name: 'a string for a number rule', index: 1, value: '12345' },
        { name: 'a boolean for a number rule', index: 1, value: true },
        { name: 'a string for a boolean rule', index: 2, value: 'true' },
        { name: 'a number for a boolean rule', index: 2, value: 1 },
        { name: 'a number for an e164 rule', index: 3, value: 15556192191 },
        { name: 'a phone number without a +', index: 3, value: '15556192191' },
        {
          name: 'a phone number with spaces',
          index: 3,
          value: '+1 555 619 2191',
        },
        {
          name: 'a phone number of more than 15 digits',
          index: 3,
          value: '+1234567890123456',
        },
        { name: 'a number for a string rule', index: 4, value: 12345 },
        { name: 'a boolean for a string rule', index: 4, value: false },
      ];
      forEach(({ name, index, value }) => {
        it(`should 400 for ${name}, naming its index`, async () => {
          const response = await createDepot(typedService._id, {
            userReference: 'ABC123',
            authValues: withValue(index, value),
          });

          expectInvalidAuthValues(response, invalidAuthValueMessage(index));
          await expect(
            mongoDb().collection('depots').countDocuments({}),
          ).resolves.toEqual(0);
        });
      }, invalidValues);

      it('should name the first invalid value', async () => {
        const response = await createDepot(typedService._id, {
          userReference: 'ABC123',
          authValues: [
            'jane.doe@example.com',
            '12345',
            'true',
            '+15556192191',
            'Sales',
          ],
        });

        expectInvalidAuthValues(response, invalidAuthValueMessage(1));
      });

      it('should 400 without naming an index when there is a value too few', async () => {
        const response = await createDepot(typedService._id, {
          userReference: 'ABC123',
          authValues: validAuthValues.slice(0, 4),
        });

        expectInvalidAuthValues(response);
      });
    });

    it('should 409 when the same auth values are used by a depot of the service', async () => {
      const firstResponse = await createDepot(vpService._id, {
        userReference: 'ABC123',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });
      expect(firstResponse.statusCode).toEqual(200);

      const response = await createDepot(vpService._id, {
        userReference: 'DEF456',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });

      expect(response.statusCode).toEqual(409);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 409,
          error: 'Conflict',
          errorCode: 'auth_values_already_used',
          message: 'auth_values_already_used',
          depotId: firstResponse.json.depot.id,
        }),
      );
      await expect(
        mongoDb().collection('depots').countDocuments({}),
      ).resolves.toEqual(1);
    });

    it('should 409 when the auth values differ only in case or surrounding spaces', async () => {
      const firstResponse = await createDepot(vpService._id, {
        userReference: 'ABC123',
        authValues: ['Jane.Doe@Example.com', 'EMP-1'],
      });
      expect(firstResponse.statusCode).toEqual(200);

      const response = await createDepot(vpService._id, {
        userReference: 'DEF456',
        authValues: [' JANE.DOE@EXAMPLE.COM  ', 'emp-1'],
      });

      expect(response.statusCode).toEqual(409);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 409,
          errorCode: 'auth_values_already_used',
          depotId: firstResponse.json.depot.id,
        }),
      );
    });

    it('should 200 when only some of the auth values are used by a depot of the service', async () => {
      const firstResponse = await createDepot(vpService._id, {
        userReference: 'ABC123',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });
      expect(firstResponse.statusCode).toEqual(200);

      const response = await createDepot(vpService._id, {
        userReference: 'DEF456',
        authValues: ['jane.doe@example.com', 'EMP-2'],
      });

      expect(response.statusCode).toEqual(200);
    });

    it('should 200 when the auth values are used by a depot in other positions', async () => {
      const firstResponse = await createDepot(vpService._id, {
        userReference: 'ABC123',
        authValues: ['emp-1', 'jane.doe@example.com'],
      });
      expect(firstResponse.statusCode).toEqual(200);

      const response = await createDepot(vpService._id, {
        userReference: 'DEF456',
        authValues: ['jane.doe@example.com', 'emp-1'],
      });

      expect(response.statusCode).toEqual(200);
    });

    it('should 200 when a depot of the service has the auth values and an extra one', async () => {
      await persistDepot({
        tenant,
        service: vpService,
        userReference: nanoid(),
        authMatchValues: ['jane.doe@example.com', 'emp-1', 'extra'],
        authRulesFingerprint: buildAuthRulesFingerprint(vpService),
      });

      const response = await createDepot(vpService._id, {
        userReference: 'DEF456',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });

      expect(response.statusCode).toEqual(200);
    });

    it('should 200 when a depot has the same auth values under another auth configuration', async () => {
      await persistDepot({
        tenant,
        service: vpService,
        userReference: nanoid(),
        authMatchValues: ['jane.doe@example.com', 'emp-1'],
        authRulesFingerprint: 'previous-configuration',
      });

      const response = await createDepot(vpService._id, {
        userReference: 'DEF456',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });

      expect(response.statusCode).toEqual(200);
    });

    it('should 200 when the auth values are used by a depot of another service', async () => {
      const otherVpService = await persistVpService();
      const firstResponse = await createDepot(otherVpService._id, {
        userReference: 'ABC123',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });
      expect(firstResponse.statusCode).toEqual(200);

      const response = await createDepot(vpService._id, {
        userReference: 'DEF456',
        authValues: ['jane.doe@example.com', 'EMP-1'],
      });

      expect(response.statusCode).toEqual(200);
      await expect(
        mongoDb().collection('depots').countDocuments({}),
      ).resolves.toEqual(2);
    });

    it('should 200 without authMatchValues when the auth values are reused for a preauth service', async () => {
      const authValues = ['jane.doe@example.com', 'EMP-1'];
      const firstResponse = await createDepot(issuerService._id, {
        userReference: 'ABC123',
        authValues,
      });
      expect(firstResponse.statusCode).toEqual(200);

      const response = await createDepot(issuerService._id, {
        userReference: 'DEF456',
        authValues,
      });

      expect(response.statusCode).toEqual(200);
      const dbDepots = await mongoDb().collection('depots').find({}).toArray();
      expect(dbDepots).toEqual([
        expectedDbDepot(firstResponse.json.depot, tenant),
        expectedDbDepot(response.json.depot, tenant),
      ]);
    });

    it('should 200 without authMatchValues when the auth values are reused for a relying party service', async () => {
      const relyingPartyService = await persistRelyingPartyService({ tenant });
      const authValues = ['jane.doe@example.com', 'EMP-1'];
      const firstResponse = await createDepot(relyingPartyService._id, {
        userReference: 'ABC123',
        authValues,
      });
      expect(firstResponse.statusCode).toEqual(200);

      const response = await createDepot(relyingPartyService._id, {
        userReference: 'DEF456',
        authValues,
      });

      expect(response.statusCode).toEqual(200);
      const dbDepots = await mongoDb().collection('depots').find({}).toArray();
      expect(dbDepots).toEqual([
        expectedDbDepot(firstResponse.json.depot, tenant),
        expectedDbDepot(response.json.depot, tenant),
      ]);
    });

    describe('services with both auth methods', () => {
      let dualService;

      beforeEach(async () => {
        dualService = await persistVpService({
          authMethods: ['preauth', 'verifiable_presentation'],
        });
      });

      it('should store authMatchValues and 409 when the auth values are reused', async () => {
        const firstResponse = await createDepot(dualService._id, {
          userReference: 'ABC123',
          authValues: ['Jane.Doe@Example.com', 'EMP-1'],
        });
        expect(firstResponse.statusCode).toEqual(200);
        await expect(
          mongoDb().collection('depots').find({}).toArray(),
        ).resolves.toEqual([
          {
            ...expectedDbDepot(firstResponse.json.depot, tenant),
            authMatchValues: ['jane.doe@example.com', 'emp-1'],
            authRulesFingerprint: buildAuthRulesFingerprint(dualService),
          },
        ]);

        const response = await createDepot(dualService._id, {
          userReference: 'DEF456',
          authValues: ['jane.doe@example.com', 'emp-1'],
        });

        expect(response.statusCode).toEqual(409);
        expect(response.json).toEqual(
          errorResponseMatcher({
            statusCode: 409,
            errorCode: 'auth_values_already_used',
            depotId: firstResponse.json.depot.id,
          }),
        );
      });

      it('should 400 when there are fewer authValues than rules', async () => {
        const response = await createDepot(dualService._id, {
          userReference: 'ABC123',
          authValues: ['jane.doe@example.com'],
        });

        expectInvalidAuthValues(response);
      });
    });
  });

  describe('Find Depots by Auth Match Tuples Test Suite', () => {
    let vpService;
    let depotsRepo;

    beforeEach(async () => {
      vpService = await persistIssuerService({ tenant });
      depotsRepo = depotRepoPlugin(fastify)({
        tenant: { ...tenant, _id: new ObjectId(tenant._id) },
        config: fastify.config,
      });
    });

    const persistDepotWith = (
      authMatchValues,
      { service = vpService, authRulesFingerprint } = {},
    ) =>
      persistDepot({
        tenant,
        service,
        userReference: nanoid(),
        authMatchValues,
        authRulesFingerprint:
          authRulesFingerprint ?? buildAuthRulesFingerprint(service),
      });

    const findDepots = (tuples) =>
      depotsRepo.findDepotsByAuthMatchTuples(
        vpService._id,
        buildAuthRulesFingerprint(vpService),
        tuples,
      );

    it('should only find depots of the auth configuration whose authMatchValues equal a tuple, in order', async () => {
      const exactDepot = await persistDepotWith([
        'jane.doe@example.com',
        'emp-1',
      ]);
      await persistDepotWith(['emp-1', 'jane.doe@example.com']);
      await persistDepotWith(['jane.doe@example.com', 'emp-1', 'extra']);
      await persistDepotWith(['jane.doe@example.com']);
      await persistDepotWith(['jane.doe@example.com', 'emp-1'], {
        service: await persistIssuerService({ tenant }),
      });
      await persistDepotWith(['jane.doe@example.com', 'emp-1'], {
        authRulesFingerprint: 'previous-configuration',
      });
      const otherTenant = await persistTenant();
      await persistDepot({
        tenant: otherTenant,
        service: vpService,
        userReference: nanoid(),
        authMatchValues: ['jane.doe@example.com', 'emp-1'],
        authRulesFingerprint: buildAuthRulesFingerprint(vpService),
      });

      const depots = await findDepots([['jane.doe@example.com', 'emp-1']]);

      expect(depots).toEqual([
        expect.objectContaining({ _id: new ObjectId(exactDepot._id) }),
      ]);
    });

    it('should find the depots matching any of the tuples', async () => {
      const janeDepot = await persistDepotWith([
        'jane.doe@example.com',
        'emp-1',
      ]);
      const johnDepot = await persistDepotWith([
        'john.doe@example.com',
        'emp-2',
      ]);
      await persistDepotWith(['jane.doe@example.com', 'emp-2']);

      const depots = await findDepots([
        ['jane.doe@example.com', 'emp-1'],
        ['john.doe@example.com', 'emp-2'],
        ['nobody@example.com', 'emp-1'],
      ]);

      expect(depots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ _id: new ObjectId(janeDepot._id) }),
          expect.objectContaining({ _id: new ObjectId(johnDepot._id) }),
        ]),
      );
      expect(depots).toHaveLength(2);
    });
  });

  describe('Find Depots Test Suite', () => {
    let tenant2;
    let depots;

    beforeEach(async () => {
      tenant2 = await persistTenant();

      depots = [
        await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
        }),
        await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
        }),
        await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
        }),
      ];
    });

    it('should return none if no depots match the tenant', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant2._id}`,
      });
      expect(response.json).toEqual({
        depots: [],
        requestId: expect.any(String),
      });
    });

    describe('Find Depots by serviceId', () => {
      it('should return none if no depots match the serviceId', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${
            tenant._id
          }&serviceId=${new ObjectId()}`,
        });
        expect(response.json).toEqual({
          depots: [],
          requestId: expect.any(String),
        });
      });
      it('should return 3 depots matching the serviceId', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${tenant._id}&serviceId=${issuerService._id}`,
        });
        expect(response.json).toEqual({
          depots: expect.arrayContaining(depots.map(expectedDepot)),
          requestId: expect.any(String),
        });
      });
    });

    describe('Find Depots by depotId', () => {
      it('should return none if no depots match the depotId', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${
            tenant._id
          }&depotId=${new ObjectId()}`,
        });
        expect(response.json).toEqual({
          depots: [],
          requestId: expect.any(String),
        });
      });
      it('should return the deferred credentials fields', async () => {
        const deferredDepot = await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
          deferredCredentials: true,
          expectedCredentialTypes: ['EmailV1.0'],
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${tenant._id}&depotId=${deferredDepot._id}&depotId=${depots[1]._id}`,
        });
        expect(response.json).toEqual({
          depots: expect.arrayContaining([
            {
              ...expectedDepot(deferredDepot),
              deferredCredentials: true,
              expectedCredentialTypes: ['EmailV1.0'],
            },
            expectedDepot(depots[1]),
          ]),
          requestId: expect.any(String),
        });
        expect(response.json.depots).toHaveLength(2);
      });
      it('should return 2 if 2 depots match the depotIds', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${tenant._id}&depotId=${depots[0]._id}&depotId=${depots[2]._id}`,
        });
        expect(response.json).toEqual({
          depots: [depots[2], depots[0]].map(expectedDepot),
          requestId: expect.any(String),
        });
      });
      it('should return the depot of a depotId in upper case', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${tenant._id}&depotId=${depots[1]._id.toUpperCase()}`,
        });
        expect(response.json).toEqual({
          depots: [expectedDepot(depots[1])],
          requestId: expect.any(String),
        });
      });
    });

    describe('Find Depots by malformed ids', () => {
      const expectMalformedId = (response, message) => {
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            statusCode: 400,
            errorCode: 'request_validation_failed',
            message,
          }),
        );
      };

      it('should 400 for a malformed serviceId', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${tenant._id}&serviceId=not-an-object-id`,
        });
        expectMalformedId(
          response,
          'querystring/serviceId must match pattern "^[0-9a-fA-F]{24}$"',
        );
      });
      it('should 400 for a malformed depotId', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${tenant._id}&depotId=not-an-object-id`,
        });
        expectMalformedId(
          response,
          [
            'querystring/depotId must match pattern "^[0-9a-fA-F]{24}$"',
            'querystring/depotId must be array',
            'querystring/depotId must match a schema in anyOf',
          ].join(', '),
        );
      });
      it('should 400 for a malformed id among the depotIds', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${testUrl}/get?tenantId=${tenant._id}&depotId=${depots[0]._id}&depotId=not-an-object-id`,
        });
        expectMalformedId(
          response,
          [
            'querystring/depotId must be string',
            'querystring/depotId/1 must match pattern "^[0-9a-fA-F]{24}$"',
            'querystring/depotId must match a schema in anyOf',
          ].join(', '),
        );
      });
    });
  });

  describe('Depot Deletion Test Suite', () => {
    let depots;

    beforeEach(async () => {
      depots = [
        await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
        }),
        await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
        }),
        await persistDepot({
          tenant,
          service: issuerService,
          userReference: nanoid(),
        }),
      ];
    });

    it('should 400 when tenantId is missing from body', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {},
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'tenantId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when serviceId is missing from body', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: { tenantId: 'foo' },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'serviceId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when depotId is missing from body', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: { tenantId: 'foo', serviceId: 'foo' },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'depotId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when depotId is not a string', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: { tenantId: 'foo', serviceId: 'foo', depotId: {} },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/depotId must be string',
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when tenant is not recognized', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: new ObjectId(),
          serviceId: new ObjectId(),
          depotId: 'foo',
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'Tenant not found',
          errorCode: 'tenant_not_found',
        }),
      );
    });

    it('should 400 when related credentials still exists', async () => {
      const credential1 = await persistCredential({ tenant, depot: depots[0] });
      const credential2 = await persistCredential({ tenant, depot: depots[0] });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depotId: depots[0]._id,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: `Credentials(s) ${credential2._id},${credential1._id} must be deleted before deleting depot ${depots[0]._id}`,
          errorCode: 'related_credential_undeleted',
        }),
      );
    });

    it('should 200 when non-existent depot is deleted', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depotId: new ObjectId(),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
      });
    });

    it("should 200 when depot's service is not of tenant, and not delete the depot", async () => {
      const tenant2 = await persistTenant();
      const service2 = await persistIssuerService({ tenant: tenant2 });
      const depot = await persistDepot({
        tenant,
        userReference: nanoid(),
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: service2._id,
          depotId: depot._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
      });

      const dbDepot = await mongoDb()
        .collection('depots')
        .findOne({ _id: new ObjectId(depot._id) });
      expect(dbDepot).not.toBeNull();
    });

    it('should 200 and delete depots', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: issuerService._id,
          depotId: depots[0]._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
      });

      const dbDepots = await mongoDb()
        .collection('depots')
        .find({ _id: new ObjectId(depots[0]._id) })
        .toArray();
      expect(dbDepots).toEqual([]);
    });
  });
});

const expectedDepot = (depot) => ({
  deferredCredentials: false,
  ...omit(['_id', 'tenantId'], depot),
  id: depot._id,
});

const expectedDbDepot = (response, tenant) => ({
  ...mongoify(omit(['id'], response)),
  _id: new ObjectId(response.id),
  tenantId: new ObjectId(tenant._id),
});
