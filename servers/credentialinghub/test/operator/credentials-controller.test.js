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
  mockHttpClientModule,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { mongoify, errorResponseMatcher } = require('@verii/tests-helpers');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const { map, omit } = require('lodash/fp');
const { hashOffer } = require('@verii/verii-issuing');
const { nanoid } = require('nanoid');
const { applyOverrides } = require('@verii/common-functions');
const createTestFastify = require('../helpers/create-test-fastify');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initDepotFactory } = require('../../src/entities/depots');
const { initCredentialFactory } = require('../../src/entities/credentials');
const {
  sampleEducationDegreeGraduation,
} = require('../helpers/sample-education-degree-graduation');

const testUrl = '/operator/credentials';
describe('Credentials Test suite', () => {
  let fastify;
  let persistTenant;
  let persistIssuerService;
  let persistDepot;
  let persistCredential;

  let tenant;
  let issuerService;
  let depot;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();

    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistCredential } = initCredentialFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    tenant = await persistTenant();
    issuerService = await persistIssuerService({ tenant });
    depot = await persistDepot({ tenant, service: issuerService });
    fastify.overrides.reqConfig = (config) => config;
    resetMockHttpClient();
  });

  after(async () => {
    await fastify.close();
  });

  describe('Create credential Test Suite', () => {
    it('should 400 if tenantId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {},
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body must have required property 'tenantId'",
        }),
      );
    });
    it('should 400 if depotId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: { tenantId: tenant._id },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body must have required property 'depotId'",
        }),
      );
    });
    it('should 400 if credential is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: { tenantId: tenant._id, depotId: 'foo' },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body must have required property 'credential'",
        }),
      );
    });
    it('should 400 if credential is malformed', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          depotId: 'foo',
          credential: {},
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message:
            "body/credential must have required property 'credentialReference'",
        }),
      );
    });
    it('should 502 if credential type loading fails', async () => {
      const credentialItem = {
        depotId: depot._id,
        credential: {
          credentialReference: 'cred1',
          content: { type: ['fooType'], credentialSubject: {} },
          tags: ['tag1'],
        },
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          ...credentialItem,
        },
      });
      expect(response.statusCode).toEqual(502);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Gateway',
          errorCode: 'credential_types_metadata_upstream_error',
          message: 'credential_types_metadata_upstream_error',
          statusCode: 502,
        }),
      );
      const dbCredentials = await mongoDb()
        .collection('credentials')
        .find({})
        .toArray();
      expect(dbCredentials).toEqual([]);
    });
    it('should 502 if schema loading fails', async () => {
      mockHttpClientJsonResponse('get', [credentialTypeMetadatas[0]]);
      const credentialItem = {
        depotId: depot._id,
        credential: {
          credentialReference: 'cred1',
          content: { type: ['fooType'], credentialSubject: {} },
          tags: ['tag1'],
        },
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          ...credentialItem,
        },
      });
      expect(response.statusCode).toEqual(502);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Gateway',
          errorCode: 'schema_upstream_error',
          message: 'schema_upstream_error',
          statusCode: 502,
        }),
      );
      const dbCredentials = await mongoDb()
        .collection('credentials')
        .find({})
        .toArray();
      expect(dbCredentials).toEqual([]);
    });
    it('should 200 and create credential', async () => {
      mockHttpClientJsonResponse('get', [credentialTypeMetadatas[0]]);
      mockHttpClientJsonResponse('get', schemas[0]);
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        tlsRejectUnauthorized: false,
      });
      const credentialItem = {
        depotId: depot._id,
        credential: {
          credentialReference: 'cred1',
          content: { type: ['fooType'], credentialSubject: { foo: 'bar' } },
          tags: ['tag1'],
        },
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          ...credentialItem,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        credential: expectedCredential(credentialItem.credential, depot),
        requestId: expect.any(String),
      });

      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        'api/v0.6/credential-types',
        {
          searchParams: new URLSearchParams([['credentialType', 'fooType']]),
        },
      ]);
      expect(mockHttpClient.get.mock.calls[1].arguments).toEqual([
        'https://example.com/foo-schema.schema.json',
      ]);
      expect(
        mockHttpClientModule.initHttpClient.mock.calls[0].arguments[0],
      ).toMatchObject({
        tlsRejectUnauthorized: false,
      });
      const dbCredentials = await mongoDb()
        .collection('credentials')
        .find({})
        .toArray();
      expect(dbCredentials).toEqual([
        expectedDbCredential(
          response.json.credential,
          credentialTypeMetadatas[0],
          tenant,
        ),
      ]);
    });
    it('should 400 if depot is not found', async () => {
      mockHttpClientJsonResponse('get', [credentialTypeMetadatas[0]]);
      mockHttpClientJsonResponse('get', schemas[0]);
      const credentialItem = {
        depotId: new ObjectId(),
        credential: {
          credentialReference: 'cred1',
          content: { type: ['fooType'], credentialSubject: {} },
          tags: ['tag1'],
        },
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create`,
        payload: {
          tenantId: tenant._id,
          ...credentialItem,
        },
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'referenced_depot_not_found',
          message: 'referenced_depot_not_found',
          error: 'Bad Request',
        }),
      );
      const dbCredentials = await mongoDb()
        .collection('credentials')
        .find({})
        .toArray();
      expect(dbCredentials).toEqual([]);
    });
  });

  describe('Create many credentials Test Suite', () => {
    it('should 400 if tenantId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create-many`,
        payload: {},
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body must have required property 'tenantId'",
        }),
      );
    });
    it('should 400 if items is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create-many`,
        payload: { tenantId: tenant._id },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body must have required property 'items'",
        }),
      );
    });
    it('should 400 if items is empty', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create-many`,
        payload: { tenantId: tenant._id, items: [] },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: 'body/items must NOT have fewer than 1 items',
        }),
      );
    });
    it('should 400 if items[*].depotId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create-many`,
        payload: { tenantId: tenant._id, items: [{}] },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body/items/0 must have required property 'depotId'",
        }),
      );
    });
    it('should 400 if items[*].credential is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create-many`,
        payload: { tenantId: tenant._id, items: [{ depotId: 'foo' }] },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body/items/0 must have required property 'credential'",
        }),
      );
    });
    it('should 400 if items[*].credential is malformed', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create-many`,
        payload: {
          tenantId: tenant._id,
          items: [{ depotId: 'foo', credential: {} }],
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message:
            "body/items/0/credential must have required property 'credentialReference'",
        }),
      );
    });
    it('should 400 if credential type is not found', async () => {
      mockHttpClientJsonResponse('get', []);
      const credentialItems = [
        {
          depotId: depot._id,
          credential: {
            credentialReference: 'cred1',
            content: { type: ['fooType'], credentialSubject: {} },
            tags: ['tag1'],
          },
        },
        {
          depotId: depot._id,
          credential: {
            credentialReference: 'cred2',
            content: { type: ['fooType'], credentialSubject: {} },
            tags: ['tag2'],
          },
        },
      ];
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create-many`,
        payload: {
          tenantId: tenant._id,
          items: credentialItems,
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'credential_type_not_found',
          message: 'credential_type_not_found',
        }),
      );
    });
    it('should 400 if credential subject fails schema validation', async () => {
      mockHttpClientJsonResponse('get', [credentialTypeMetadatas[0]]);
      mockHttpClientJsonResponse('get', schemas[0]);
      const credentialItems = [
        {
          depotId: depot._id,
          credential: {
            credentialReference: 'cred1',
            content: { type: ['fooType'], credentialSubject: {} },
            tags: ['tag1'],
          },
        },
        {
          depotId: depot._id,
          credential: {
            credentialReference: 'cred2',
            content: { type: ['fooType'], credentialSubject: {} },
            tags: ['tag2'],
          },
        },
      ];
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create-many`,
        payload: {
          tenantId: tenant._id,
          items: credentialItems,
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message:
            "credential.content.credentialSubject must have required property 'foo'",
        }),
      );
    });
    it('should 400 if depot is not found', async () => {
      mockHttpClientJsonResponse('get', [credentialTypeMetadatas[0]]);
      mockHttpClientJsonResponse('get', schemas[0]);

      const credentialItems = [
        {
          depotId: new ObjectId(),
          credential: {
            credentialReference: 'cred1',
            content: { type: ['fooType'], credentialSubject: { foo: 'foo' } },
            tags: ['tag1'],
          },
        },
        {
          depotId: depot._id,
          credential: {
            credentialReference: 'cred2',
            content: { type: ['fooType'], credentialSubject: { foo: 'foo' } },
            tags: ['tag2'],
          },
        },
      ];
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create-many`,
        payload: {
          tenantId: tenant._id,
          items: credentialItems,
        },
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'referenced_depot_not_found',
          message: 'referenced_depot_not_found',
          error: 'Bad Request',
        }),
      );
      const dbCredentials = await mongoDb()
        .collection('credentials')
        .find({})
        .toArray();
      expect(dbCredentials).toEqual([]);
    });
    it('should 400 if credentialSubject validation fails', async () => {
      mockHttpClientJsonResponse('get', [credentialTypeMetadatas[0]]);
      mockHttpClientJsonResponse('get', schemas[0]);
      const credentialItems = [
        {
          depotId: depot._id,
          credential: {
            credentialReference: 'cred1',
            content: { type: ['fooType'], credentialSubject: {} },
            tags: ['tag1'],
          },
        },
        {
          depotId: depot._id,
          credential: {
            credentialReference: 'cred2',
            content: { type: ['fooType'], credentialSubject: {} },
            tags: ['tag2'],
          },
        },
      ];
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/create-many`,
        payload: {
          tenantId: tenant._id,
          items: credentialItems,
        },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message:
            "credential.content.credentialSubject must have required property 'foo'",
        }),
      );
    });

    describe('successful use cases', () => {
      it('should 200 and create an layer 1.1 credential', async () => {
        mockHttpClientJsonResponse('get', [credentialTypeMetadatas[1]]);
        mockHttpClientJsonResponse('get', schemas[1]);
        const credentialItems = [
          {
            depotId: depot._id,
            credential: {
              credentialReference: 'cred1',
              content: {
                type: ['EducationDegreeGraduationV1.1'],
                credentialSubject: sampleEducationDegreeGraduation({
                  profile: {
                    name: 'ACME Corp',
                    location: { countryCode: 'US', regionCode: 'CA' },
                  },
                  didDoc: { id: tenant.did },
                }),
              },
              tags: ['tag1'],
            },
          },
        ];
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create-many`,
          payload: {
            tenantId: tenant._id,
            items: credentialItems,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          credentials: [
            expectedCredential(credentialItems[0].credential, depot, {
              'content.credentialSubject.alignment[0].type': 'AlignmentObject',
              'content.credentialSubject.institution.type': 'Organization',
              'content.credentialSubject.institution.place.type': 'Place',
              'content.credentialSubject.school.type': 'Organization',
              'content.credentialSubject.school.place.type': 'Place',
              'content.credentialSubject.recipient.type': 'PersonName',
              'content.credentialSubject.type': 'EducationDegree',
            }),
          ],
          requestId: expect.any(String),
        });
        const dbCredentials = await mongoDb()
          .collection('credentials')
          .find({})
          .toArray();
        expect(dbCredentials).toEqual([
          expectedDbCredential(
            response.json.credentials[0],
            credentialTypeMetadatas[1],
            tenant,
          ),
        ]);
      });

      it('should 200 and create many credentials', async () => {
        mockHttpClientJsonResponse('get', [credentialTypeMetadatas[0]]);
        mockHttpClientJsonResponse('get', schemas[0]);
        const credentialItems = [
          {
            depotId: depot._id,
            credential: {
              credentialReference: 'cred1',
              content: {
                type: ['fooType'],
                credentialSubject: { foo: 'foo' },
              },
              tags: ['tag1'],
            },
          },
          {
            depotId: depot._id,
            credential: {
              credentialReference: 'cred2',
              content: {
                type: ['fooType'],
                credentialSubject: { foo: 'foo' },
              },
              tags: ['tag2'],
            },
          },
        ];
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create-many`,
          payload: {
            tenantId: tenant._id,
            items: credentialItems,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          credentials: [
            expectedCredential(credentialItems[0].credential, depot),
            expectedCredential(credentialItems[1].credential, depot),
          ],
          requestId: expect.any(String),
        });
        const dbCredentials = await mongoDb()
          .collection('credentials')
          .find({})
          .toArray();
        expect(dbCredentials).toEqual([
          expectedDbCredential(
            response.json.credentials[0],
            credentialTypeMetadatas[0],
            tenant,
          ),
          expectedDbCredential(
            response.json.credentials[1],
            credentialTypeMetadatas[0],
            tenant,
          ),
        ]);
      });

      it('should 200 and create many credentials with issuer overrides', async () => {
        mockHttpClientJsonResponse('get', [credentialTypeMetadatas[0]]);
        mockHttpClientJsonResponse('get', schemas[0]);
        const credentialItems = [
          {
            depotId: depot._id,
            credential: {
              credentialReference: 'cred1',
              content: {
                type: ['fooType'],
                credentialSubject: { foo: 'foo' },
                issuer: {
                  type: 'Brand',
                  name: 'ACME',
                  image: 'http://example.com/acme.jpg',
                  id: tenant.did,
                },
              },
              tags: ['tag1'],
            },
          },
          {
            depotId: depot._id,
            credential: {
              credentialReference: 'cred2',
              content: {
                type: ['fooType'],
                credentialSubject: { foo: 'foo' },
                issuer: {
                  type: ['Issuer'],
                  id: 'http://example.com',
                },
              },
              tags: ['tag2'],
            },
          },
        ];
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create-many`,
          payload: {
            tenantId: tenant._id,
            items: credentialItems,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          credentials: [
            expectedCredential(credentialItems[0].credential, depot),
            expectedCredential(credentialItems[1].credential, depot),
          ],
          requestId: expect.any(String),
        });
        const dbCredentials = await mongoDb()
          .collection('credentials')
          .find({})
          .toArray();
        expect(dbCredentials).toEqual([
          expectedDbCredential(
            response.json.credentials[0],
            credentialTypeMetadatas[0],
            tenant,
          ),
          expectedDbCredential(
            response.json.credentials[1],
            credentialTypeMetadatas[0],
            tenant,
          ),
        ]);
      });
      it('should 200 and create credentials with relatedResources with DID references', async () => {
        mockHttpClientJsonResponse('get', [credentialTypeMetadatas[0]]);
        mockHttpClientJsonResponse('get', schemas[0]);
        const relatedCredentials = [
          await persistCredential({
            did: 'did:velocity:v2:1',
            digestSRI: nanoid(),
            content: { type: ['barType'] },
            tenant,
          }),
          await persistCredential({
            did: 'did:velocity:v2:2',
            digestSRI: nanoid(),
            content: { type: ['fooType'] },
            tenant,
          }),
        ];
        const credentialItems = [
          {
            depotId: depot._id,
            credential: {
              credentialReference: 'cred1',
              content: {
                type: ['fooType'],
                credentialSubject: { foo: 'foo' },
                replaces: [{ id: relatedCredentials[0].did }],
                relatedResource: [{ id: 'did:velocity:v2:3' }],
              },
              tags: ['tag1'],
            },
          },
          {
            depotId: depot._id,
            credential: {
              credentialReference: 'cred2',
              content: {
                type: ['fooType'],
                credentialSubject: { foo: 'foo' },
                relatedResource: [
                  { id: relatedCredentials[0].did },
                  { id: relatedCredentials[1].did },
                ],
              },
              tags: ['tag2'],
            },
          },
        ];
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${testUrl}/create-many`,
          payload: {
            tenantId: tenant._id,
            items: credentialItems,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          credentials: [
            expectedCredential(credentialItems[0].credential, depot, {
              'content.replaces': [
                {
                  id: relatedCredentials[0].did,
                  digestSRI: relatedCredentials[0].digestSRI,
                  hint: relatedCredentials[0].content.type,
                },
              ],
            }),
            expectedCredential(credentialItems[1].credential, depot, {
              'content.relatedResource': [
                {
                  id: relatedCredentials[0].did,
                  digestSRI: relatedCredentials[0].digestSRI,
                  hint: relatedCredentials[0].content.type,
                },
                {
                  id: relatedCredentials[1].did,
                  digestSRI: relatedCredentials[1].digestSRI,
                  hint: relatedCredentials[1].content.type,
                },
              ],
            }),
          ],
          requestId: expect.any(String),
        });
        const dbCredentials = await mongoDb()
          .collection('credentials')
          .find({})
          .toArray();
        expect(dbCredentials).toEqual([
          ...map(mongoify, relatedCredentials),
          expectedDbCredential(
            response.json.credentials[0],
            credentialTypeMetadatas[0],
            tenant,
            {
              'content.replaces': [
                {
                  id: relatedCredentials[0].did,
                  digestSRI: relatedCredentials[0].digestSRI,
                  hint: relatedCredentials[0].content.type,
                },
              ],
            },
          ),
          expectedDbCredential(
            response.json.credentials[1],
            credentialTypeMetadatas[0],
            tenant,
            {
              'content.relatedResource': [
                {
                  id: relatedCredentials[0].did,
                  digestSRI: relatedCredentials[0].digestSRI,
                  hint: relatedCredentials[0].content.type,
                },
                {
                  id: relatedCredentials[1].did,
                  digestSRI: relatedCredentials[1].digestSRI,
                  hint: relatedCredentials[1].content.type,
                },
              ],
            },
          ),
        ]);
      });
    });
  });

  describe('Credential Retrieval Test Suite', () => {
    it('should 400 if tenantId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get`,
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "querystring must have required property 'tenantId'",
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

    it('should 200 and return all credentials with no filters', async () => {
      const credential1 = await persistCredential({ tenant, depot });
      const credential2 = await persistCredential({ tenant, depot });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
        credentials: [
          expectedResponseCredential(credential1, depot),
          expectedResponseCredential(credential2, depot),
        ],
      });
    });

    it('should 200 with credential matched by credentialId', async () => {
      const credential1 = await persistCredential({ tenant, depot });
      await persistCredential({ tenant, depot });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${tenant._id}&credentialId=${credential1._id}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
        credentials: [expectedResponseCredential(credential1, depot)],
      });
    });

    it('should 200 with no credentials when credentialId not matched', async () => {
      await persistCredential({ tenant, depot });
      await persistCredential({ tenant, depot });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${testUrl}/get?tenantId=${
          tenant._id
        }&credentialId=${new ObjectId()}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        requestId: expect.any(String),
        credentials: [],
      });
    });
  });

  describe('Credential Deletion Test Suite', () => {
    let tenant2;

    beforeEach(async () => {
      tenant2 = await persistTenant();
    });

    it('should 400 if tenantId is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {},
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body must have required property 'tenantId'",
        }),
      );
    });
    it('should 400 if credentialIds is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: { tenantId: tenant._id },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: "body must have required property 'credentialIds'",
        }),
      );
    });
    it('should 400 if credentialIds is empty', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: { tenantId: tenant._id, credentialIds: [] },
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 400,
          errorCode: 'request_validation_failed',
          message: 'body/credentialIds must NOT have fewer than 1 items',
        }),
      );
    });
    it('should 200 and delete credentials', async () => {
      const credential1 = await persistCredential({ tenant });
      const credential2 = await persistCredential({ tenant });
      const credentialToRemain = await persistCredential({ tenant });
      const credentialOtherTenant = await persistCredential({
        tenant: tenant2,
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${testUrl}/delete`,
        payload: {
          tenantId: tenant._id,
          credentialIds: [credential1._id, credential2._id, 'not-an-id'],
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({ requestId: expect.any(String) });

      const dbCredentials = await mongoDb()
        .collection('credentials')
        .find({})
        .toArray();
      expect(dbCredentials).toEqual([
        mongoify(credentialToRemain),
        mongoify(credentialOtherTenant),
      ]);
    });
  });
});

const expectedResponseCredential = (credential, depot, overrides) =>
  expectedCredential(
    omit(['_id', 'tenantId', 'typeMetadata'], credential),
    depot,
    overrides,
  );

const expectedCredential = (credential, depot, overrides) =>
  applyOverrides(
    {
      ...credential,
      id: expect.stringMatching(OBJECT_ID_FORMAT),
      depotId: depot._id,
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    },
    {
      ...overrides,
      contentHash: (expectation) => hashOffer(expectation.content),
    },
  );

const expectedDbCredential = (
  jsonCredentialResponse,
  typeMetadata,
  tenant,
  overrides,
) =>
  applyOverrides(
    {
      ...mongoify(omit(['id'], jsonCredentialResponse)),
      typeMetadata,
      contentHash: hashOffer(jsonCredentialResponse.content),
      _id: new ObjectId(jsonCredentialResponse.id),
      tenantId: new ObjectId(tenant._id),
    },
    overrides,
  );

const credentialTypeMetadatas = [
  {
    credentialType: 'fooType',
    schemaUrl: 'https://example.com/foo-schema.schema.json',
  },
  {
    credentialType: 'EducationDegreeGraduationV1.1',
    schemaUrl:
      'https://example.com/education-degree-graduation-v1.1.schema.json',
  },
  {
    credentialType: 'OpenBadgeCredential',
    schemaUrl: 'https://example.com/open-badge-credential.schema.json',
  },
];

const schemas = [
  {
    $id: 'foo',
    properties: { foo: { type: 'string', minLength: 3 } },
    required: ['foo'],
  },
  { ...require('../helpers/education-degree-graduation-v1.1.schema.json') },
  { ...require('../helpers/open-badge-credential.schema.json') },
];
