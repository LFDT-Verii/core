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
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');

const agentUrl = 'https://localhost.test';

const vnUrl = ({ did }) => `/vn-api/r/${did}`;

const testUrl = (tenant2, queryParams) => {
  const baseUrl = `${vnUrl(tenant2)}/get-credential-manifest`;
  const queryString = qs.stringify(queryParams, { indices: false });
  return `${baseUrl}?${queryString}`;
};

describe('vn-api > get credential manifests', () => {
  let fastify;

  let tenant;
  let issuerKey;
  let issuerKeyPair;

  let persistTenant;
  let persistKey;
  let persistIssuerService;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    ({ tenant, issuerKey, issuerKeyPair } = await constructTenant(
      persistTenant,
      persistKey,
    ));
  });

  beforeEach(async () => {
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    resetMockHttpClient();
  });

  after(async () => {
    await fastify.close();
  });

  it("should 400 when serviceId can't be found", async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: testUrl(tenant, {
        credential_types: 'PastEmploymentPosition',
        id: new ObjectId().toString(),
      }),
    });

    expect(response.statusCode).toEqual(400);
  });

  it('should 400, when invalid push_delegate provided', async () => {
    const issuerService = await persistIssuerService({
      tenant,
      description: 'Credential Issuance Disclosure',
      authMethods: ['preauth'],
    });

    const payload = {
      id: issuerService._id,
      credential_types: ['PastEmploymentPosition'],
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
      .findOne({ serviceId: new ObjectId(issuerService._id) });
    expect(dbExchange).toBeNull();
  });

  it('should 400 with referenced_service_not_found when service is deactivated', async () => {
    const issuerService = await persistIssuerService({
      tenant,
      description: 'Credential Issuance Disclosure',
      authMethods: ['preauth'],
      deactivationDate: new Date(),
    });

    const payload = { id: issuerService._id };
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
      .findOne({ serviceId: new ObjectId(issuerService._id) });
    expect(dbExchange).toBeNull();
  });

  describe('successful use cases', () => {
    it('should 200 for preauthcode auth, but wallet requests no output types', async () => {
      const issuerService = await persistIssuerService({
        tenant,
        description: 'Credential Issuance Disclosure',
        authMethods: ['preauth'],
      });

      const payload = {
        id: issuerService._id,
        format: 'json',
      };
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl(tenant, payload),
      });

      expect(response.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ serviceId: new ObjectId(issuerService._id) });
      expect(dbExchange).toEqual(
        expectedDbExchange(tenant, issuerService, payload),
      );

      expect(response.json).toEqual({
        issuing_request: expectedCredentialManifest(
          tenant,
          issuerService,
          dbExchange,
          payload,
        ),
      });
    });

    it('should 200 for preauthcode auth and wallet requests output types', async () => {
      const issuerService = await persistIssuerService({
        tenant,
        description: 'Credential Issuance Disclosure',
        authMethods: ['preauth'],
      });
      mockHttpClientJsonResponse('get', descriptors.PastEmploymentPosition);

      const payload = {
        id: issuerService._id,
        credential_types: ['PastEmploymentPosition'],
        format: 'json',
      };
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl(tenant, payload),
      });

      expect(response.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ serviceId: new ObjectId(issuerService._id) });
      expect(dbExchange).toEqual(
        expectedDbExchange(tenant, issuerService, payload),
      );

      expect(response.json).toEqual({
        issuing_request: expectedCredentialManifest(
          tenant,
          issuerService,
          dbExchange,
          payload,
        ),
      });

      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        'api/v0.6/credential-type-descriptors/PastEmploymentPosition',
        {
          searchParams: new URLSearchParams('includeDisplay=true'),
        },
      ]);
    });

    it('should 200 for disclosureRequest auth and wallet requests output types', async () => {
      const issuerService = await persistIssuerService({
        tenant,
        description: 'Credential Issuance Disclosure',
        disclosureRequest: {
          types: [{ type: 'EmailV1.0' }],
          purpose: 'Identification',
          retentionPeriod: '3w',
        },
      });
      mockHttpClientJsonResponse('get', inputDescriptor('EmailV1.0'));
      mockHttpClientJsonResponse('get', descriptors.PastEmploymentPosition);

      const payload = {
        id: issuerService._id,
        credential_types: ['PastEmploymentPosition'],
        format: 'json',
      };
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl(tenant, payload),
      });

      expect(response.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ serviceId: new ObjectId(issuerService._id) });
      expect(dbExchange).toEqual(
        expectedDbExchange(tenant, issuerService, payload),
      );

      expect(response.json).toEqual({
        issuing_request: expectedCredentialManifest(
          tenant,
          issuerService,
          dbExchange,
          payload,
        ),
      });

      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual(
        [
          'api/v0.6/credential-type-descriptors/EmailV1.0',
          {
            searchParams: new URLSearchParams('includeDisplay=false'),
          },
        ],
        [
          'api/v0.6/credential-type-descriptors/PastEmploymentPosition',
          {
            searchParams: new URLSearchParams('includeDisplay=true'),
          },
        ],
      );
    });

    it('should 200, for presentationDefinition auth and wallet requests output types', async () => {
      const issuerService = await persistIssuerService({
        tenant,
        description: 'Credential Issuance Disclosure',
        presentationDefinition: testPresentationDefinition,
      });

      mockHttpClientJsonResponse('get', descriptors.PastEmploymentPosition);
      mockHttpClientJsonResponse('get', descriptors.EducationDegree);

      const payload = {
        id: issuerService._id,
        credential_types: ['PastEmploymentPosition', 'EducationDegree'],
        format: 'json',
      };
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl(tenant, payload),
      });
      expect(response.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ serviceId: new ObjectId(issuerService._id) });
      expect(dbExchange).toEqual(
        expectedDbExchange(tenant, issuerService, payload),
      );

      expect(response.json).toEqual({
        issuing_request: expectedCredentialManifest(
          tenant,
          issuerService,
          dbExchange,
          payload,
        ),
      });

      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual(
        [
          'api/v0.6/credential-type-descriptors/PastEmploymentPosition',
          {
            searchParams: new URLSearchParams('includeDisplay=true'),
          },
        ],
        [
          'api/v0.6/credential-type-descriptors/EducationDegree',
          {
            searchParams: new URLSearchParams('includeDisplay=true'),
          },
        ],
      );
    });

    it('should 200 when types, pushDelegate and english locale provided', async () => {
      const issuerService = await persistIssuerService({
        tenant,
        description: 'Credential Issuance Disclosure',
        authMethods: ['preauth'],
      });
      mockHttpClientJsonResponse('get', descriptors.PastEmploymentPosition);

      const payload = {
        id: issuerService._id,
        credential_types: ['PastEmploymentPosition'],
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
        .findOne({ serviceId: new ObjectId(issuerService._id) });
      expect(dbExchange).toEqual(
        expectedDbExchange(tenant, issuerService, payload, undefined, {
          messagingSettings: {
            authToken: payload['push_delegate.push_token'],
            webhookUrl: payload['push_delegate.push_url'],
          },
        }),
      );

      expect(response.json).toEqual({
        issuing_request: expectedCredentialManifest(
          tenant,
          issuerService,
          dbExchange,
          payload,
        ),
      });

      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        'api/v0.6/credential-type-descriptors/PastEmploymentPosition',
        {
          searchParams: new URLSearchParams('includeDisplay=true&locale=en_US'),
        },
      ]);
    });

    it('should 200 for signed response with preauthcode auth and wallet requests output types', async () => {
      const issuerService = await persistIssuerService({
        tenant,
        description: 'Credential Issuance Disclosure',
        authMethods: ['preauth'],
      });
      mockHttpClientJsonResponse('get', descriptors.PastEmploymentPosition);

      const payload = {
        id: issuerService._id,
        credential_types: ['PastEmploymentPosition'],
      };
      const response = await fastify.injectJson({
        method: 'GET',
        url: testUrl(tenant, payload),
      });

      expect(response.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ serviceId: new ObjectId(issuerService._id) });
      expect(dbExchange).toEqual(
        expectedDbExchange(tenant, issuerService, payload),
      );

      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });

      await expect(
        jwtVerify(response.json.issuing_request, issuerKeyPair.publicKey),
      ).resolves.toEqual({
        header: {
          typ: 'JWT',
          alg: 'ES256K',
          kid: `${tenant.did}${issuerKey.kidFragment}`,
        },
        payload: {
          ...expectedCredentialManifest(
            tenant,
            issuerService,
            dbExchange,
            payload,
          ),
          iss: tenant.did,
          iat: expect.any(Number),
          nbf: expect.any(Number),
          exp: expect.any(Number),
        },
      });

      expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
        'api/v0.6/credential-type-descriptors/PastEmploymentPosition',
        {
          searchParams: new URLSearchParams('includeDisplay=true'),
        },
      ]);
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

const expectedCredentialManifest = (
  tenant,
  issuerService,
  dbExchange,
  payload,
  // eslint-disable-next-line complexity
) => ({
  exchange_id: expect.any(String),
  output_descriptors: map(
    (type) => descriptors[type],
    payload.credential_types,
  ),
  issuer: {
    id: tenant.did,
  },
  presentation_definition: {
    id: `${dbExchange._id}.${issuerService._id}`,
    format: {
      jwt_vp: { alg: ['secp256k1'] },
    },
    name: issuerService.description,
    purpose: issuerService.disclosureRequest?.purpose ?? '',
    input_descriptors: map(
      ({ type }) => inputDescriptor(type, ['A']),
      issuerService.disclosureRequest?.types,
    ),
    submission_requirements:
      issuerService.disclosureRequest?.types != null
        ? [
            {
              from: 'A',
              min: 1,
              rule: 'all',
            },
          ]
        : [],
    ...issuerService.presentationDefinition,
  },
  metadata: {
    client_name: tenant.name,
    logo_uri: tenant.logo,
    tos_uri: issuerService.termsUrl,
    max_retention_period:
      issuerService.disclosureRequest?.retentionPeriod ?? '',
    progress_uri: `${agentUrl}${vnUrl(tenant)}/get-exchange-progress`,
    submit_presentation_uri: `${agentUrl}${vnUrl(tenant)}/authenticate`,
    check_offers_uri: `${agentUrl}${vnUrl(tenant)}/credential-offers`,
    finalize_offers_uri: `${agentUrl}${vnUrl(tenant)}/issue-credentials`,
  },
});

const expectedDbExchange = (
  tenant,
  issuerService,
  payload,
  events,
  overrides,
) => {
  const exchangeEvents = events ?? [
    ExchangeStates.NEW,
    ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
  ];
  let expectation = {
    _id: expect.any(ObjectId),
    protocolMetadata: { protocol: ExchangeProtocols.VN_API },
    events: exchangeEvents.map((state) => ({
      state,
      timestamp: expect.any(Date),
    })),
    credentialTypes: payload.credential_types,
    serviceId: new ObjectId(issuerService._id),
    type: ExchangeTypes.ISSUER,
    tenantId: new ObjectId(tenant._id),
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
  };

  for (const [issuerKey, value] of entries(overrides)) {
    expectation = set(issuerKey, value, expectation);
  }

  return expectation;
};
