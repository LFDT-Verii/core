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
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const {
  mockHttpClient,
  mockHttpClientJsonResponse,
  mockHttpClientError,
  mockHttpClientModule,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { nanoid } = require('nanoid');
const { addYears } = require('date-fns/fp');
const { forEach, omit, times } = require('lodash/fp');
const { ObjectId } = require('mongodb');
const { errorResponseMatcher, mongoify } = require('@verii/tests-helpers');
const {
  OBJECT_ID_FORMAT,
  ISO_DATETIME_FORMAT,
} = require('@verii/test-regexes');
const testPresentationDefinition = require('../helpers/presentation-definition.json');
const createTestFastify = require('../helpers/create-test-fastify');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  buildAuthRulesFingerprint,
  depotRepoPlugin,
  initDepotFactory,
} = require('../../src/entities/depots');
const {
  initIssuerServiceFactory,
  issuerServicesRepoPlugin,
} = require('../../src/entities/issuer-services');

const testUrl = '/operator/issuer-services';

// The rules' value indexes must be exactly 0 to n-1, which only the Hub's code
// checks
const INVALID_VALUE_INDEXES = [
  { name: 'a gap', valueIndexes: [0, 2] },
  { name: 'a duplicate', valueIndexes: [0, 0] },
  { name: 'an index out of range', valueIndexes: [1] },
];

// The request schema keeps each value index from 0 to 9
const OUT_OF_BOUNDS_VALUE_INDEXES = [
  {
    name: 'a negative index',
    valueIndexes: [-1, 0],
    message:
      'body/service/verifiablePresentationAuthRules/0/valueIndex must be >= 0',
  },
  {
    name: 'an index above 9',
    valueIndexes: [10],
    message:
      'body/service/verifiablePresentationAuthRules/0/valueIndex must be <= 9',
  },
];

// The request schema needs a type, and only a type, for each requested type
const INVALID_DISCLOSURE_TYPES = [
  {
    name: 'no type',
    types: [{}],
    message:
      "body/service/disclosureRequest/types/0 must have required property 'type'",
  },
  {
    name: 'an unknown property',
    types: [{ type: 'EmailV1.0', issuer: 'did:web:example.com' }],
    message:
      'body/service/disclosureRequest/types/0 must NOT have additional properties',
  },
];

// A service that fails both branches of the new-issuer-service anyOf: the
// preauth-only branch on the auth method at authMethodIndex, then the internal
// verifiable_presentation branch on vpBranchError
const anyOfErrorMessage = (vpBranchError, authMethodIndex = 0) => {
  const preauthBranchError = `body/service/authMethods/${authMethodIndex} must be equal to one of the allowed values`;
  return `${preauthBranchError}, ${vpBranchError}, body/service must match a schema in anyOf`;
};

// AJV checks a rule's anyOf, whose branches each require an object, before
// the rule's own type.
const NOT_AN_OBJECT_RULE_MESSAGE = [
  'body/service/verifiablePresentationAuthRules/0 must be object',
  'body/service/verifiablePresentationAuthRules/0 must be object',
  'body/service/verifiablePresentationAuthRules/0 must match a schema in anyOf',
].join(', ');

const emailAuthRule = (overrides) => ({
  path: [['credentialSubject', 'email']],
  rule: 'pick',
  valueIndex: 0,
  type: 'EmailV1.0',
  valueType: 'string',
  ...overrides,
});

const testDisclosureRequest = {
  types: [{ type: 'EmailV1.0' }],
  purpose: 'foo',
  retentionPeriod: 'P12D',
};

const emailAuthService = (verifiablePresentationAuthRules) => ({
  velocityNetworkServiceId: '#foo',
  termsUrl: 'http://www.example.com',
  disclosureRequest: testDisclosureRequest,
  authMethods: ['verifiable_presentation'],
  authMode: 'internal',
  verifiablePresentationAuthRules,
});

// Rule paths are lists of claims path pointers, which the request schema
// checks.
const INVALID_RULE_PATHS = [
  {
    name: 'a JSONPath string as a pointer',
    path: ['$.credentialSubject.email'],
  },
  { name: 'an empty pointer', path: [[]] },
  { name: 'a negative index', path: [['credentialSubject', 'emails', -1]] },
  { name: 'a fractional index', path: [['credentialSubject', 'emails', 1.5]] },
  {
    name: 'an object segment',
    path: [['credentialSubject', { key: 'email' }]],
  },
  { name: 'an empty string segment', path: [['credentialSubject', '']] },
  { name: 'no pointers', path: [] },
  {
    name: 'more than 10 pointers',
    path: times(() => ['credentialSubject', 'email'], 11),
  },
  {
    name: 'a pointer of more than 32 segments',
    path: [times(() => 'credentialSubject', 33)],
  },
];

const VALID_RULE_PATH = [
  ['credentialSubject', 'emailAddress'],
  ['credentialSubject', 'emails', null],
  ['credentialSubject', 'emails', 0],
  ['credentialSubject', 'contact', 'email'],
];

const buildAuthRules = (valueIndexes) =>
  valueIndexes.map((valueIndex) => ({
    path: [['credentialSubject', `value${valueIndex}`]],
    rule: 'pick',
    valueIndex,
    type: 'EmailV1.0',
    valueType: 'string',
  }));

describe('Issuer services management Test suite', () => {
  let fastify;
  let persistTenant;
  let persistDepot;
  let tenant;
  let issuerServicesRepo;
  let persistIssuerService;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    tenant = await persistTenant();
    issuerServicesRepo = issuerServicesRepoPlugin(fastify)({
      tenant: { ...tenant, _id: new ObjectId(tenant._id) },
    });
    resetMockHttpClient();
  });

  after(async () => {
    await fastify.close();
  });

  describe('Issuer Service Creation Test Suite', () => {
    it('should 400 when tenantId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
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
    it('should 400 when service is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: { tenantId: 'foo' },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'service'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when tenantId is not recognized', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
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
    it('should 400 when service.velocityNetworkServiceId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            "body/service must have required property 'velocityNetworkServiceId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.velocityNetworkServiceId is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: [],
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service/velocityNetworkServiceId must be string',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.termsUrl is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: '#foo',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/service must have required property 'termsUrl'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.termsUrl is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'foo',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service/termsUrl must match format "uri"',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMethods is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/service must have required property 'authMethods'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMethods is empty', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: [],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service/authMethods must NOT have fewer than 1 items',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMethods contains invalid value', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['foo'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: anyOfErrorMessage(
            "body/service must have required property 'disclosureRequest'",
          ),
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMode is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/service must have required property 'authMode'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMode is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'foo',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: anyOfErrorMessage(
            'body/service/authMode must be equal to one of the allowed values',
          ),
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules is missing with authMode of "internal"', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: anyOfErrorMessage(
            "body/service must have required property 'verifiablePresentationAuthRules'",
          ),
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules is empty with authMode of "internal"', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: anyOfErrorMessage(
            'body/service/verifiablePresentationAuthRules must NOT have fewer than 1 items',
          ),
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when an internal vp service has no disclosureRequest', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['preauth', 'verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: anyOfErrorMessage(
            "body/service must have required property 'disclosureRequest'",
            1,
          ),
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when an internal vp service has a presentationDefinition', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            disclosureRequest: {
              types: [{ type: 'EmailV1.0' }],
              purpose: 'foo',
              retentionPeriod: 'P12D',
            },
            presentationDefinition: testPresentationDefinition,
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: anyOfErrorMessage('body/service must NOT be valid'),
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules[*] is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: ['foo'],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: NOT_AN_OBJECT_RULE_MESSAGE,
          errorCode: 'request_validation_failed',
        }),
      );
    });
    forEach(({ name, valueIndexes }) => {
      it(`should 400 when service.verifiablePresentationAuthRules value indexes have ${name}`, async () => {
        mockHttpClientJsonResponse('get', {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create`,
          payload: {
            tenantId: tenant._id,
            service: {
              velocityNetworkServiceId: '#foo',
              termsUrl: 'http://www.example.com',
              disclosureRequest: testDisclosureRequest,
              authMethods: ['verifiable_presentation'],
              authMode: 'internal',
              verifiablePresentationAuthRules: buildAuthRules(valueIndexes),
            },
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            message: 'service_verifiablePresentationAuthRules_invalid',
            errorCode: 'service_verifiablePresentationAuthRules_invalid',
          }),
        );
        await expect(
          mongoDb().collection('issuerServices').countDocuments({}),
        ).resolves.toEqual(0);
      });
    }, INVALID_VALUE_INDEXES);
    forEach(({ name, valueIndexes, message }) => {
      it(`should 400 when service.verifiablePresentationAuthRules value indexes have ${name}`, async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create`,
          payload: {
            tenantId: tenant._id,
            service: emailAuthService(buildAuthRules(valueIndexes)),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            message,
            errorCode: 'request_validation_failed',
          }),
        );
      });
    }, OUT_OF_BOUNDS_VALUE_INDEXES);
    forEach(({ name, types, message }) => {
      it(`should 400 when a service.disclosureRequest type has ${name}`, async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create`,
          payload: {
            tenantId: tenant._id,
            service: {
              ...emailAuthService([emailAuthRule()]),
              disclosureRequest: { ...testDisclosureRequest, types },
            },
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            message,
            errorCode: 'request_validation_failed',
          }),
        );
      });
    }, INVALID_DISCLOSURE_TYPES);
    it('should 200 when service.verifiablePresentationAuthRules value indexes are out of order', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const verifiablePresentationAuthRules = buildAuthRules([1, 2, 0]);
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            disclosureRequest: {
              types: [{ type: 'EmailV1.0' }],
              purpose: 'foo',
              retentionPeriod: 'P12D',
            },
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules,
          },
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json.service.verifiablePresentationAuthRules).toEqual(
        verifiablePresentationAuthRules,
      );
    });
    it('should 400 when a service.verifiablePresentationAuthRules rule reads a type that is not requested', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: emailAuthService([emailAuthRule({ type: 'PhoneV1.0' })]),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_verifiablePresentationAuthRules_invalid',
          errorCode: 'service_verifiablePresentationAuthRules_invalid',
        }),
      );
    });
    forEach(({ name, path }) => {
      it(`should 400 when a service.verifiablePresentationAuthRules path has ${name}`, async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create`,
          payload: {
            tenantId: tenant._id,
            service: emailAuthService([emailAuthRule({ path })]),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            message: expect.stringMatching(
              /^body\/service\/verifiablePresentationAuthRules\/0\/path/,
            ),
            errorCode: 'request_validation_failed',
          }),
        );
      });
    }, INVALID_RULE_PATHS);
    it('should 400 when a service.verifiablePresentationAuthRules rule has no type', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: emailAuthService([omit(['type'], emailAuthRule())]),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            "body/service/verifiablePresentationAuthRules/0 must have required property 'type'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules has more than 10 rules', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: emailAuthService(buildAuthRules(times((i) => i, 11))),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            'body/service/verifiablePresentationAuthRules must NOT have more than 10 items',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 200 when service.verifiablePresentationAuthRules has 10 rules', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const verifiablePresentationAuthRules = buildAuthRules(
        times((i) => i, 10),
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: emailAuthService(verifiablePresentationAuthRules),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json.service.verifiablePresentationAuthRules).toEqual(
        verifiablePresentationAuthRules,
      );
    });
    it('should 200 when service.verifiablePresentationAuthRules paths are claims path pointers with alternatives', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const verifiablePresentationAuthRules = [
        emailAuthRule({ path: VALID_RULE_PATH }),
      ];
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: emailAuthService(verifiablePresentationAuthRules),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json.service.verifiablePresentationAuthRules).toEqual(
        verifiablePresentationAuthRules,
      );
    });
    it('should 400 when additional property is present on service', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: 'foo',
          service: {
            foo: 'foo',
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service must NOT have additional properties',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when velocityNetworkServiceId does not resolve', async () => {
      mockHttpClientError('get', new Error('could not resolve did'));
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'did_document_not_found',
          errorCode: 'did_document_not_found',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    it('should 400 when velocityNetworkServiceId does not match a did doc service', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#bar',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            disclosureRequest: {
              types: [{ type: 'EmailV1.0' }],
              purpose: 'foo',
              retentionPeriod: 'P12D',
            },
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_not_matched',
          errorCode: 'service_not_matched',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    it('should 400 when velocityNetworkServiceId is duplicate', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      await persistIssuerService({
        tenant,
        velocityNetworkServiceId: '#foo',
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            disclosureRequest: {
              types: [{ type: 'EmailV1.0' }],
              purpose: 'foo',
              retentionPeriod: 'P12D',
            },
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_must_be_unique',
          errorCode: 'service_must_be_unique',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    describe('successful issuer service creation', () => {
      it('should 200 and create vp issuer service with disclosureRequest', async () => {
        mockHttpClientJsonResponse('get', {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
        const now = new Date();
        const payload = {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#foo',
            description: 'foo',
            termsUrl: 'http://www.example.com',
            disclosureRequest: {
              types: [{ type: 'foo' }],
              purpose: 'foo',
              retentionPeriod: 'P12D',
            },
            deactivationDate: addYears(1)(now).toISOString(),
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'foo',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
            credentialTypesAvailable: ['foo'],
            autoCleanPII: true,
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create`,
          payload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          service: {
            ...payload.service,
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          requestId: expect.any(String),
        });
        expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
          `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
        ]);
        const dbIssuerService = await issuerServicesRepo.findById(
          response.json.service.id,
        );
        expect(dbIssuerService).toEqual({
          ...mongoify(payload.service),
          _id: new ObjectId(response.json.service.id),
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          tenantId: new ObjectId(tenant._id),
        });
      });

      it('should 200 and create a preauth issuer service that has auth rules', async () => {
        mockHttpClientJsonResponse('get', {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
        const service = {
          ...omit(['disclosureRequest'], emailAuthService([emailAuthRule()])),
          authMethods: ['preauth'],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create`,
          payload: { tenantId: tenant._id, service },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.service).toEqual(expect.objectContaining(service));
      });

      it('should 200 and create preauth issuer service', async () => {
        mockHttpClientJsonResponse('get', {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
        const payload = {
          tenantId: tenant._id,
          service: {
            velocityNetworkServiceId: '#foo',
            description: 'foo',
            termsUrl: 'http://www.example.com',
            authMethods: ['preauth'],
            authMode: 'internal',
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create`,
          payload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          service: {
            ...payload.service,
            authTokensExpireIn: 604800,
            challengesExpireIn: 600,
            id: expect.stringMatching(OBJECT_ID_FORMAT),
            createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
            updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          requestId: expect.any(String),
        });
        expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
          `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
        ]);
        const dbIssuerService = await issuerServicesRepo.findById(
          response.json.service.id,
        );
        expect(dbIssuerService).toEqual({
          ...mongoify(payload.service),
          _id: new ObjectId(response.json.service.id),
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          tenantId: new ObjectId(tenant._id),
        });
      });
    });
  });

  describe('Issuer Service Retrieval Test Suite', () => {
    it('should 400 when tenant query param is missing', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get`,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "querystring must have required property 'tenantId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when tenant is not recognized', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=foo`,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'Tenant not found',
          errorCode: 'tenant_not_found',
        }),
      );
    });

    it('should 200 empty array when service is not recognized', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&serviceId=foo`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        services: [],
        requestId: expect.any(String),
      });
    });

    it('should 200 empty array when service is not of a tenant', async () => {
      const tenant2 = await persistTenant();
      const service = await persistIssuerService({ tenant: tenant2 });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&serviceId=${service._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        services: [],
        requestId: expect.any(String),
      });
    });

    it('should 200 with service of tenant', async () => {
      const service = await persistIssuerService({ tenant });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&serviceId=${service._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        services: [expectedIssuerService(service)],
        requestId: expect.any(String),
      });
    });
  });

  describe('Issuer Service Update Test Suite', () => {
    it('should 400 when tenantId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
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
    it('should 400 when serviceId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
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
    it('should 400 when service is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: { tenantId: 'foo', serviceId: 'foo' },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'service'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when tenantId is not recognized', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
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
    it('should 400 when service.velocityNetworkServiceId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            "body/service must have required property 'velocityNetworkServiceId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.velocityNetworkServiceId is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: [],
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service/velocityNetworkServiceId must be string',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.termsUrl is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: '#foo',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/service must have required property 'termsUrl'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.termsUrl is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'foo',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service/termsUrl must match format "uri"',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMethods is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/service must have required property 'authMethods'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMethods is empty', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: [],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service/authMethods must NOT have fewer than 1 items',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMethods contains invalid value', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['foo'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: anyOfErrorMessage(
            "body/service must have required property 'disclosureRequest'",
          ),
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMode is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body/service must have required property 'authMode'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.authMode is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'foo',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: anyOfErrorMessage(
            'body/service/authMode must be equal to one of the allowed values',
          ),
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules is missing with authMode of "internal"', async () => {
      const service = await persistIssuerService({
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: anyOfErrorMessage(
            "body/service must have required property 'verifiablePresentationAuthRules'",
          ),
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules is empty with authMode of "internal"', async () => {
      const service = await persistIssuerService({
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: anyOfErrorMessage(
            'body/service/verifiablePresentationAuthRules must NOT have fewer than 1 items',
          ),
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when an internal vp service has no disclosureRequest', async () => {
      const service = await persistIssuerService({
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: anyOfErrorMessage(
            "body/service must have required property 'disclosureRequest'",
          ),
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when an internal vp service has a presentationDefinition', async () => {
      const service = await persistIssuerService({
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            disclosureRequest: {
              types: [{ type: 'EmailV1.0' }],
              purpose: 'foo',
              retentionPeriod: 'P12D',
            },
            presentationDefinition: testPresentationDefinition,
            authTokensExpireIn: 100000,
            authMethods: ['preauth', 'verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: anyOfErrorMessage('body/service must NOT be valid', 1),
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules[*] is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: ['foo'],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: NOT_AN_OBJECT_RULE_MESSAGE,
          errorCode: 'request_validation_failed',
        }),
      );
    });
    forEach(({ name, valueIndexes }) => {
      it(`should 400 when service.verifiablePresentationAuthRules value indexes have ${name}`, async () => {
        mockHttpClientJsonResponse('get', {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
        const service = await persistIssuerService({
          tenant,
          velocityNetworkServiceId: '#foo',
          verifiablePresentationAuthRules: buildAuthRules([0]),
        });
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/update`,
          payload: {
            tenantId: tenant._id,
            serviceId: service._id,
            service: {
              velocityNetworkServiceId: '#foo',
              termsUrl: 'http://www.example.com',
              disclosureRequest: testDisclosureRequest,
              authMethods: ['verifiable_presentation'],
              authMode: 'internal',
              verifiablePresentationAuthRules: buildAuthRules(valueIndexes),
            },
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            message: 'service_verifiablePresentationAuthRules_invalid',
            errorCode: 'service_verifiablePresentationAuthRules_invalid',
          }),
        );
        const dbIssuerService = await issuerServicesRepo.findById(service._id);
        expect(dbIssuerService.verifiablePresentationAuthRules).toEqual(
          buildAuthRules([0]),
        );
      });
    }, INVALID_VALUE_INDEXES);
    forEach(({ name, valueIndexes, message }) => {
      it(`should 400 when service.verifiablePresentationAuthRules value indexes have ${name}`, async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/update`,
          payload: {
            tenantId: tenant._id,
            serviceId: new ObjectId().toString(),
            service: emailAuthService(buildAuthRules(valueIndexes)),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            message,
            errorCode: 'request_validation_failed',
          }),
        );
      });
    }, OUT_OF_BOUNDS_VALUE_INDEXES);
    forEach(({ name, types, message }) => {
      it(`should 400 when a service.disclosureRequest type has ${name}`, async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/update`,
          payload: {
            tenantId: tenant._id,
            serviceId: new ObjectId().toString(),
            service: {
              ...emailAuthService([emailAuthRule()]),
              disclosureRequest: { ...testDisclosureRequest, types },
            },
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            message,
            errorCode: 'request_validation_failed',
          }),
        );
      });
    }, INVALID_DISCLOSURE_TYPES);
    it('should 400 when a service.verifiablePresentationAuthRules rule reads a type that is not requested', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const service = await persistIssuerService({ tenant });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: emailAuthService([emailAuthRule({ type: 'PhoneV1.0' })]),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_verifiablePresentationAuthRules_invalid',
          errorCode: 'service_verifiablePresentationAuthRules_invalid',
        }),
      );
    });
    forEach(({ name, path }) => {
      it(`should 400 when a service.verifiablePresentationAuthRules path has ${name}`, async () => {
        const service = await persistIssuerService({ tenant });
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/update`,
          payload: {
            tenantId: tenant._id,
            serviceId: service._id,
            service: emailAuthService([emailAuthRule({ path })]),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            message: expect.stringMatching(
              /^body\/service\/verifiablePresentationAuthRules\/0\/path/,
            ),
            errorCode: 'request_validation_failed',
          }),
        );
      });
    }, INVALID_RULE_PATHS);
    it('should 400 when a service.verifiablePresentationAuthRules rule has no type', async () => {
      const service = await persistIssuerService({ tenant });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: emailAuthService([omit(['type'], emailAuthRule())]),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            "body/service/verifiablePresentationAuthRules/0 must have required property 'type'",
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when service.verifiablePresentationAuthRules has more than 10 rules', async () => {
      const service = await persistIssuerService({ tenant });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: emailAuthService(buildAuthRules(times((i) => i, 11))),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message:
            'body/service/verifiablePresentationAuthRules must NOT have more than 10 items',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 200 when service.verifiablePresentationAuthRules paths are claims path pointers with alternatives', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const service = await persistIssuerService({ tenant });
      const verifiablePresentationAuthRules = [
        emailAuthRule({ path: VALID_RULE_PATH }),
      ];
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: emailAuthService(verifiablePresentationAuthRules),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json.service.verifiablePresentationAuthRules).toEqual(
        verifiablePresentationAuthRules,
      );
    });
    it('should 400 when additional property is present on service', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
          service: {
            foo: 'foo',
            velocityNetworkServiceId: 'foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/service must NOT have additional properties',
          errorCode: 'request_validation_failed',
        }),
      );
    });
    it('should 400 when velocityNetworkServiceId does not resolve', async () => {
      mockHttpClientError('get', new Error('could not resolve did'));
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: 'foo',
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'did_document_not_found',
          errorCode: 'did_document_not_found',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    it('should 400 when velocityNetworkServiceId does not match a did doc service', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const service = await persistIssuerService({
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: {
            velocityNetworkServiceId: '#bar',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            disclosureRequest: {
              types: [{ type: 'EmailV1.0' }],
              purpose: 'foo',
              retentionPeriod: 'P12D',
            },
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_not_matched',
          errorCode: 'service_not_matched',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    it('should 400 when velocityNetworkServiceId is duplicate', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      const service = await persistIssuerService({
        tenant,
      });
      await persistIssuerService({
        tenant,
        velocityNetworkServiceId: '#foo',
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            disclosureRequest: {
              types: [{ type: 'EmailV1.0' }],
              purpose: 'foo',
              retentionPeriod: 'P12D',
            },
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_must_be_unique',
          errorCode: 'service_must_be_unique',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    it('should 400 when service is not found', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo' }],
      });
      await persistIssuerService({
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload: {
          tenantId: tenant._id,
          serviceId: new ObjectId(),
          service: {
            velocityNetworkServiceId: '#foo',
            termsUrl: 'http://www.example.com',
            authTokensExpireIn: 100000,
            disclosureRequest: testDisclosureRequest,
            authMethods: ['verifiable_presentation'],
            authMode: 'internal',
            verifiablePresentationAuthRules: [
              {
                path: [['foo']],
                rule: 'pick',
                valueIndex: 0,
                type: 'EmailV1.0',
                valueType: 'string',
              },
            ],
            challengesExpireIn: 10000,
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'service_not_found',
          errorCode: 'service_not_found',
        }),
      );
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
    });
    it('should 200 and update an issuer service', async () => {
      mockHttpClientJsonResponse('get', {
        id: 'did-doc-foo',
        service: [{ id: '#foo-updated' }],
      });
      const service = await persistIssuerService({
        tenant,
      });
      const payload = {
        tenantId: tenant._id,
        serviceId: service._id,
        service: {
          velocityNetworkServiceId: '#foo-updated',
          description: 'foo updated',
          termsUrl: 'http://www.example.com',
          authMethods: ['preauth'],
          authMode: 'internal',
        },
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/update`,
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        service: {
          ...expectedIssuerService(service),
          ...payload.service,
          id: service._id,
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
        requestId: expect.any(String),
      });
      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        `api/v0.6/resolve-did/${encodeURIComponent(tenant.did)}`,
      ]);
      const dbIssuerService = await issuerServicesRepo.findById(service._id);
      expect(dbIssuerService).toEqual(
        expectedDbIssuerService(response.json.service, tenant),
      );
    });

    describe('auth configuration changes', () => {
      const rules = [
        {
          path: [['credentialSubject', 'employeeId']],
          rule: 'pick',
          valueIndex: 0,
          type: 'EmployeeIdV1.0',
          valueType: 'string',
        },
        {
          path: [['credentialSubject', 'departmentId']],
          rule: 'equal',
          valueIndex: 1,
          type: 'EmployeeIdV1.0',
          valueType: 'string',
        },
      ];
      const swappedRules = [
        { ...rules[0], valueIndex: 1 },
        { ...rules[1], valueIndex: 0 },
      ];
      const disclosureRequest = {
        types: [{ type: 'EmployeeIdV1.0' }],
        purpose: 'Identification',
        retentionPeriod: 'P1D',
      };
      let service;
      let depotsRepo;

      const updateService = (overrides) => {
        mockHttpClientJsonResponse('get', {
          id: 'did-doc-foo',
          service: [{ id: '#foo' }],
        });
        return fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/update`,
          payload: {
            tenantId: tenant._id,
            serviceId: service._id,
            service: {
              velocityNetworkServiceId: '#foo',
              termsUrl: 'http://www.example.com',
              authMethods: ['verifiable_presentation'],
              authMode: 'internal',
              verifiablePresentationAuthRules: rules,
              disclosureRequest,
              ...overrides,
            },
          },
        });
      };

      const createDepot = (authValues) =>
        fastify.injectJson({
          method: 'POST',
          url: '/operator/depots/create',
          payload: {
            tenantId: tenant._id,
            serviceId: service._id,
            depot: { userReference: nanoid(), authValues },
          },
        });

      // What PR 2's authentication will query: the service's current auth
      // configuration and a candidate tuple.
      const findMatchingDepots = async (tuple) => {
        const currentService = await issuerServicesRepo.findById(service._id);
        return depotsRepo.findDepotsByAuthMatchTuples(
          service._id,
          buildAuthRulesFingerprint(currentService),
          [tuple],
        );
      };

      const captureInfoLogs = (t) => {
        const infoLogs = [];
        const { child } = fastify.log;
        t.mock.method(fastify.log, 'child', (...args) => {
          const childLogger = child.apply(fastify.log, args);
          const { info } = childLogger;
          childLogger.info = (...infoArgs) => {
            infoLogs.push(infoArgs);
            return info.apply(childLogger, infoArgs);
          };
          return childLogger;
        });
        return infoLogs;
      };

      const invalidationLogs = (infoLogs) =>
        infoLogs.filter(([, message]) =>
          `${message}`.startsWith('Issuer service auth configuration changed'),
        );

      beforeEach(async () => {
        service = await persistIssuerService({
          tenant,
          velocityNetworkServiceId: '#foo',
          termsUrl: 'http://www.example.com',
          verifiablePresentationAuthRules: rules,
          disclosureRequest,
        });
        depotsRepo = depotRepoPlugin(fastify)({
          tenant: { ...tenant, _id: new ObjectId(tenant._id) },
          config: fastify.config,
        });
      });

      it("should never match a depot created under the old rules after they're swapped", async () => {
        // Alice: employee 123, department 456. Created under the old rules,
        // just before the update, as in a race with the update.
        await persistDepot({
          tenant,
          service,
          userReference: 'alice',
          authMatchValues: ['123', '456'],
          authRulesFingerprint: buildAuthRulesFingerprint(service),
        });
        await expect(findMatchingDepots(['123', '456'])).resolves.toHaveLength(
          1,
        );

        const response = await updateService({
          verifiablePresentationAuthRules: swappedRules,
        });
        expect(response.statusCode).toEqual(200);

        // Bob: employee 456, department 123, so [123, 456] under the new rules.
        await expect(findMatchingDepots(['123', '456'])).resolves.toEqual([]);
        const bobResponse = await createDepot(['123', '456']);
        expect(bobResponse.statusCode).toEqual(200);
        await expect(findMatchingDepots(['123', '456'])).resolves.toEqual([
          expect.objectContaining({
            _id: new ObjectId(bobResponse.json.depot.id),
          }),
        ]);
      });

      it('should not match a depot created while the service was preauth only', async () => {
        const preauthResponse = await updateService({
          authMethods: ['preauth'],
        });
        expect(preauthResponse.statusCode).toEqual(200);
        const preauthDepotResponse = await createDepot([
          'emp-1',
          'jane.doe@example.com',
        ]);
        expect(preauthDepotResponse.statusCode).toEqual(200);

        const vpResponse = await updateService({});
        expect(vpResponse.statusCode).toEqual(200);

        await expect(
          findMatchingDepots(['emp-1', 'jane.doe@example.com']),
        ).resolves.toEqual([]);
        const response = await createDepot(['EMP-1', 'Jane.Doe@example.com']);
        expect(response.statusCode).toEqual(200);
        await expect(
          findMatchingDepots(['emp-1', 'jane.doe@example.com']),
        ).resolves.toEqual([
          expect.objectContaining({
            _id: new ObjectId(response.json.depot.id),
          }),
        ]);
        const duplicateResponse = await createDepot([
          'emp-1',
          'jane.doe@example.com',
        ]);
        expect(duplicateResponse.statusCode).toEqual(409);
      });

      it('should invalidate depots when a rule changes, and accept the same tuple again', async () => {
        const firstResponse = await createDepot(['EMP-1', 'SALES']);
        expect(firstResponse.statusCode).toEqual(200);

        const response = await updateService({
          verifiablePresentationAuthRules: [
            { ...rules[0], path: [['credentialSubject', 'staffId']] },
            rules[1],
          ],
        });
        expect(response.statusCode).toEqual(200);

        await expect(findMatchingDepots(['emp-1', 'sales'])).resolves.toEqual(
          [],
        );
        const secondResponse = await createDepot(['EMP-1', 'SALES']);
        expect(secondResponse.statusCode).toEqual(200);
      });

      it("should invalidate depots when a rule's valueType changes, and not when its valueFormat does", async () => {
        const firstResponse = await createDepot(['123', 'SALES']);
        expect(firstResponse.statusCode).toEqual(200);

        // valueFormat only checks the values of new depots
        const formatResponse = await updateService({
          verifiablePresentationAuthRules: [
            rules[0],
            { ...rules[1], valueFormat: 'email' },
          ],
        });
        expect(formatResponse.statusCode).toEqual(200);
        await expect(findMatchingDepots(['123', 'sales'])).resolves.toEqual([
          expect.objectContaining({
            _id: new ObjectId(firstResponse.json.depot.id),
          }),
        ]);

        const typeResponse = await updateService({
          verifiablePresentationAuthRules: [
            { ...rules[0], valueType: 'number' },
            rules[1],
          ],
        });
        expect(typeResponse.statusCode).toEqual(200);
        await expect(findMatchingDepots(['123', 'sales'])).resolves.toEqual([]);
        const stringResponse = await createDepot(['123', 'SALES']);
        expect(stringResponse.statusCode).toEqual(400);
        const numberResponse = await createDepot([123, 'SALES']);
        expect(numberResponse.statusCode).toEqual(200);
        await expect(findMatchingDepots([123, 'sales'])).resolves.toEqual([
          expect.objectContaining({
            _id: new ObjectId(numberResponse.json.depot.id),
          }),
        ]);
      });

      it('should invalidate depots when the requested types change', async () => {
        const firstResponse = await createDepot(['EMP-1', 'SALES']);
        expect(firstResponse.statusCode).toEqual(200);

        const response = await updateService({
          disclosureRequest: {
            ...disclosureRequest,
            types: [{ type: 'EmployeeIdV1.0' }, { type: 'DepartmentV1.0' }],
          },
        });
        expect(response.statusCode).toEqual(200);

        await expect(findMatchingDepots(['emp-1', 'sales'])).resolves.toEqual(
          [],
        );
      });

      it('should keep depots valid when other fields change or the rules are reordered', async () => {
        const firstResponse = await createDepot(['EMP-1', 'SALES']);
        expect(firstResponse.statusCode).toEqual(200);

        const response = await updateService({
          description: 'updated',
          termsUrl: 'http://www.example.com/terms',
          authTokensExpireIn: 200,
          verifiablePresentationAuthRules: [rules[1], rules[0]],
          disclosureRequest: { ...disclosureRequest, purpose: 'Updated' },
        });
        expect(response.statusCode).toEqual(200);

        await expect(findMatchingDepots(['emp-1', 'sales'])).resolves.toEqual([
          expect.objectContaining({
            _id: new ObjectId(firstResponse.json.depot.id),
          }),
        ]);
        const duplicateResponse = await createDepot(['emp-1', 'sales']);
        expect(duplicateResponse.statusCode).toEqual(409);
      });

      it('should log how many depots a change invalidates', async (t) => {
        await createDepot(['EMP-1', 'SALES']);
        await createDepot(['EMP-2', 'SALES']);
        const infoLogs = captureInfoLogs(t);

        const response = await updateService({
          verifiablePresentationAuthRules: swappedRules,
        });

        expect(response.statusCode).toEqual(200);
        expect(invalidationLogs(infoLogs)).toEqual([
          [
            { serviceId: service._id, invalidatedDepotCount: 2 },
            'Issuer service auth configuration changed. Depots created under the previous configuration no longer match',
          ],
        ]);
      });

      it('should not log an invalidation when the auth configuration is unchanged', async (t) => {
        await createDepot(['EMP-1', 'SALES']);
        const infoLogs = captureInfoLogs(t);

        const response = await updateService({ description: 'updated' });

        expect(response.statusCode).toEqual(200);
        expect(infoLogs).not.toHaveLength(0);
        expect(invalidationLogs(infoLogs)).toEqual([]);
      });
    });
  });

  describe('Issuer Service Deletion Test Suite', () => {
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
        payload: {
          tenantId: 'foo',
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: "body must have required property 'serviceId'",
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when serviceId is not a string', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: 'foo',
          serviceId: {},
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: 'body/serviceId must be string',
          errorCode: 'request_validation_failed',
        }),
      );
    });

    it('should 400 when tenant is not recognized', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: 'foo',
          serviceId: 'foo',
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

    it('should 400 when a related depot still exists', async () => {
      const tenant2 = await persistTenant();
      const service = await persistIssuerService({ tenant: tenant2 });
      const depot = await persistDepot({ tenant, service });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          message: `Depot(s) ${depot._id} must be deleted before deleting service ${service._id}`,
          errorCode: 'related_depot_undeleted',
        }),
      );
    });

    it('should 200 when a non-existent service is deleted', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: new ObjectId(),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
      });
    });

    it('should 200 when a service is not of a tenant, and not delete the service', async () => {
      const tenant2 = await persistTenant();
      const service = await persistIssuerService({ tenant: tenant2 });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
      });

      const dbIssuerService = await mongoDb()
        .collection('issuerServices')
        .findOne({ _id: new ObjectId(service._id) });
      expect(dbIssuerService).not.toBeNull();
    });

    it('should 200 with services of tenant, and delete the service', async () => {
      const service = await persistIssuerService({ tenant });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          serviceId: service._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
      });

      const dbIssuerServices = await mongoDb()
        .collection('issuerServices')
        .find()
        .toArray();
      expect(dbIssuerServices).toEqual([]);
    });
  });
});

const expectedIssuerService = (issuerService) => ({
  id: issuerService._id,
  ...omit(['tenantId', '_id'], issuerService),
});

const expectedDbIssuerService = (response, tenant) => ({
  ...mongoify(omit(['id'], response)),
  _id: new ObjectId(response.id),
  tenantId: new ObjectId(tenant._id),
});
