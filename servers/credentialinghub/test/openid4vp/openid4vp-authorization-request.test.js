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
const { ObjectId } = require('mongodb');
const { jwtVerify } = require('@verii/jwt');
const { map, omit } = require('lodash/fp');
const testPresentationDefinition = require('../helpers/presentation-definition.json');
const {
  ExchangeProtocols,
  ExchangeStates,
  ExchangeTypes,
} = require('../../src/entities/exchanges');
const { initDepotFactory } = require('../../src/entities/depots');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initRelyingPartyServiceFactory,
} = require('../../src/entities/relying-party-services');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');

describe('openid4vp > authorization request', () => {
  let fastify;

  let tenant;
  let relyingPartyKey;
  let relyingPartyKeyPair;

  let persistTenant;
  let persistKey;
  let persistDepot;
  let persistRelyingPartyService;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistRelyingPartyService } = initRelyingPartyServiceFactory(fastify));

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

  it('should create an authorization request JWT from a relying party service reference', async () => {
    const relyingPartyService = await persistRelyingPartyService({
      tenant,
      description: 'Presentation Disclosure',
      disclosureRequest: {
        types: [{ type: 'EmailV1.0' }],
        purpose: 'Identification',
        retentionPeriod: '3w',
      },
      presentationRequestsExpireIn: 120,
    });
    mockHttpClientJsonResponse('get', inputDescriptor('EmailV1.0'));

    const requestId = `s-${relyingPartyService._id}`;
    const walletNonce = 'qPmxiNFCR3QTm19POc8u';
    const response = await injectAuthorizationRequest({
      fastify,
      tenant,
      requestId,
      walletNonce,
    });

    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-type']).toContain(
      'application/oauth-authz-req+jwt',
    );

    const dbExchange = await mongoDb()
      .collection('exchanges')
      .findOne({ serviceId: new ObjectId(relyingPartyService._id) });
    const dbDepot = await mongoDb()
      .collection('depots')
      .findOne({ _id: dbExchange.depotId });
    expect(dbDepot).toEqual(expectedDbDepot(tenant, relyingPartyService));
    expect(dbExchange).toEqual(
      expectedDbExchange(
        tenant,
        relyingPartyService,
        dbDepot,
        dbExchange,
        walletNonce,
      ),
    );

    await expectVerifiedAuthorizationRequestJwt({
      jwt: response.body,
      requestId,
      tenant,
      relyingPartyKey,
      relyingPartyKeyPair,
      relyingPartyService,
      dbExchange,
      walletNonce,
    });

    expect(mockHttpClient.get.mock.calls[0].arguments).toEqual([
      'api/v0.6/credential-type-descriptors/EmailV1.0',
      {
        searchParams: new URLSearchParams('includeDisplay=false'),
      },
    ]);
  });

  it('should create an authorization request JWT from an existing depot reference', async () => {
    const relyingPartyService = await persistRelyingPartyService({
      tenant,
      description: 'Presentation Disclosure',
      presentationDefinition: testPresentationDefinition,
    });
    const depot = await persistDepot({
      tenant,
      service: relyingPartyService,
    });

    const requestId = `d-${depot._id}`;
    const walletNonce = 'qPmxiNFCR3QTm19POc8u';
    const response = await injectAuthorizationRequest({
      fastify,
      tenant,
      requestId,
      walletNonce,
    });

    expect(response.statusCode).toEqual(200);
    expect(await mongoDb().collection('depots').countDocuments({})).toEqual(1);

    const dbExchange = await mongoDb()
      .collection('exchanges')
      .findOne({ serviceId: new ObjectId(relyingPartyService._id) });
    expect(dbExchange.depotId).toEqual(new ObjectId(depot._id));

    await expectVerifiedAuthorizationRequestJwt({
      jwt: response.body,
      requestId,
      tenant,
      relyingPartyKey,
      relyingPartyKeyPair,
      relyingPartyService,
      dbExchange,
      walletNonce,
    });
    expect(mockHttpClient.get.mock.calls).toHaveLength(0);
  });

  it('should replace a custom presentation definition id with the exchange id', async () => {
    const relyingPartyService = await persistRelyingPartyService({
      tenant,
      description: 'Presentation Disclosure',
      presentationDefinition: {
        ...testPresentationDefinition,
        id: 'custom-presentation-definition-id',
      },
    });

    const requestId = `s-${relyingPartyService._id}`;
    const walletNonce = 'qPmxiNFCR3QTm19POc8u';
    const response = await injectAuthorizationRequest({
      fastify,
      tenant,
      requestId,
      walletNonce,
    });

    expect(response.statusCode).toEqual(200);
    const dbExchange = await mongoDb()
      .collection('exchanges')
      .findOne({ serviceId: new ObjectId(relyingPartyService._id) });
    expect(dbExchange.protocolMetadata.presentationDefinition.id).toEqual(
      `${dbExchange._id}.${relyingPartyService._id}`,
    );

    await expectVerifiedAuthorizationRequestJwt({
      jwt: response.body,
      requestId,
      tenant,
      relyingPartyKey,
      relyingPartyKeyPair,
      relyingPartyService,
      dbExchange,
      walletNonce,
    });
    expect(mockHttpClient.get.mock.calls).toHaveLength(0);
  });

  it('should accept form content type with parameters', async () => {
    const relyingPartyService = await persistRelyingPartyService({
      tenant,
      description: 'Presentation Disclosure',
      presentationDefinition: testPresentationDefinition,
    });

    const response = await injectAuthorizationRequest({
      fastify,
      tenant,
      requestId: `s-${relyingPartyService._id}`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        accept: 'application/oauth-authz-req+jwt',
      },
    });

    expect(response.statusCode).toEqual(200);
  });

  it('should 400 when accept header is missing', async () => {
    const relyingPartyService = await persistRelyingPartyService({ tenant });
    const response = await injectAuthorizationRequest({
      fastify,
      tenant,
      requestId: `s-${relyingPartyService._id}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: "headers must have required property 'accept'",
    });
  });

  it('should 400 when wallet_nonce is too short', async () => {
    const relyingPartyService = await persistRelyingPartyService({ tenant });
    const response = await injectAuthorizationRequest({
      fastify,
      tenant,
      requestId: `s-${relyingPartyService._id}`,
      walletNonce: 'short',
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description:
        'body/wallet_nonce must NOT have fewer than 11 characters',
    });
  });

  it('should 400 when request id prefix is unsupported', async () => {
    const response = await injectAuthorizationRequest({
      fastify,
      tenant,
      requestId: new ObjectId().toString(),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'openid4vp_request_id_invalid',
    });
    expect(await mongoDb().collection('depots').countDocuments({})).toEqual(0);
    expect(await mongoDb().collection('exchanges').countDocuments({})).toEqual(
      0,
    );
  });

  it('should 400 when wallet_metadata is not JSON', async () => {
    const relyingPartyService = await persistRelyingPartyService({ tenant });
    const response = await injectAuthorizationRequest({
      fastify,
      tenant,
      requestId: `s-${relyingPartyService._id}`,
      walletMetadata: '{/}',
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'wallet_metadata_invalid',
    });
    expect(await mongoDb().collection('depots').countDocuments({})).toEqual(0);
    expect(await mongoDb().collection('exchanges').countDocuments({})).toEqual(
      0,
    );
  });

  it('should 400 when relying party service is deactivated', async () => {
    const relyingPartyService = await persistRelyingPartyService({
      tenant,
      deactivationDate: new Date(),
    });

    const response = await injectAuthorizationRequest({
      fastify,
      tenant,
      requestId: `s-${relyingPartyService._id}`,
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'referenced_service_not_found',
    });
    expect(await mongoDb().collection('depots').countDocuments({})).toEqual(0);
    expect(await mongoDb().collection('exchanges').countDocuments({})).toEqual(
      0,
    );
  });

  it('should 404 with an OAuth-shaped response when authorization request tenant is not found', async () => {
    const response = await injectAuthorizationRequest({
      fastify,
      tenant: { _id: new ObjectId() },
      requestId: `s-${new ObjectId()}`,
    });

    expect(response.statusCode).toEqual(404);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'Tenant not found',
    });
  });

  it('should validate the implemented direct-post route with OAuth-shaped errors', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vp/direct-post`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({}).toString(),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: "body must have required property 'state'",
    });
  });

  it('should 404 with an OAuth-shaped response when direct-post tenant is not found', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: `/r/${new ObjectId()}/openid4vp/direct-post`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        state: new ObjectId().toString(),
        vp_token: 'vp-token',
        presentation_submission: '{}',
      }).toString(),
    });

    expect(response.statusCode).toEqual(404);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'Tenant not found',
    });
  });

  it('should not expose internal error details for 5xx errors', () => {
    const request = {
      log: {
        error: mock.fn(),
      },
    };
    const reply = {
      status: mock.fn(),
    };

    const response = fastify.openid4vpErrorHandler(
      new Error('sensitive internal detail'),
      request,
      reply,
    );

    expect(reply.status.mock.calls[0].arguments).toEqual([500]);
    expect(request.log.error.mock.calls[0].arguments[0]).toEqual(
      expect.any(Error),
    );
    expect(response).toEqual({
      error: 'server_error',
      error_description: 'Unexpected server error',
    });
  });
});

const injectAuthorizationRequest = ({
  fastify,
  tenant,
  requestId,
  walletMetadata = JSON.stringify({ client_id: 'wallet-client' }),
  walletNonce = 'qPmxiNFCR3QTm19POc8u',
  headers = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/oauth-authz-req+jwt',
  },
}) =>
  fastify.inject({
    method: 'POST',
    url: `/r/${tenant._id}/openid4vp/authorization-request/${requestId}`,
    headers,
    body: new URLSearchParams({
      wallet_metadata: walletMetadata,
      wallet_nonce: walletNonce,
    }).toString(),
  });

const expectVerifiedAuthorizationRequestJwt = async ({
  jwt,
  requestId,
  tenant,
  relyingPartyKey,
  relyingPartyKeyPair,
  relyingPartyService,
  dbExchange,
  walletNonce,
}) => {
  await expect(jwtVerify(jwt, relyingPartyKeyPair.publicKey)).resolves.toEqual({
    header: {
      alg: 'ES256K',
      kid: `${tenant.did}${relyingPartyKey.kidFragment}`,
      typ: 'oauth-authz-req+jwt',
    },
    payload: {
      ...expectedAuthorizationRequestPayload(
        tenant,
        relyingPartyService,
        dbExchange,
        requestId,
        walletNonce,
      ),
      exp: expect.any(Number),
      iat: expect.any(Number),
    },
  });
  const {
    payload: { exp, iat },
  } = await jwtVerify(jwt, relyingPartyKeyPair.publicKey);
  expect(exp - iat).toEqual(relyingPartyService.presentationRequestsExpireIn);
  expect(
    dbExchange.protocolMetadata.presentationRequestExpiresAt.getTime() -
      dbExchange.createdAt.getTime(),
  ).toBeGreaterThanOrEqual(
    (relyingPartyService.presentationRequestsExpireIn - 1) * 1000,
  );
  expect(
    dbExchange.protocolMetadata.presentationRequestExpiresAt.getTime() -
      dbExchange.createdAt.getTime(),
  ).toBeLessThanOrEqual(
    (relyingPartyService.presentationRequestsExpireIn + 1) * 1000,
  );
};

const expectedAuthorizationRequestPayload = (
  tenant,
  relyingPartyService,
  dbExchange,
  requestId,
  walletNonce,
) => ({
  aud: 'https://self-issued.me/v2',
  client_id: `decentralized_identifier:${tenant.did}`,
  client_metadata: {
    client_name: tenant.name,
    logo_uri: tenant.logo,
    vp_formats_supported: {
      jwt_vc_json: {
        alg_values: ['ES256', 'ES256K'],
      },
    },
  },
  iss: `decentralized_identifier:${tenant.did}`,
  jti: requestId,
  nonce: dbExchange.protocolMetadata.nonce,
  presentation_definition: expectedPresentationDefinition(
    relyingPartyService,
    dbExchange,
  ),
  response_mode: 'direct_post',
  response_type: 'vp_token',
  response_uri: `${tenant.hostUrl}/r/${tenant._id}/openid4vp/direct-post`,
  state: dbExchange._id.toString(),
  wallet_nonce: walletNonce,
});

const expectedPresentationDefinition = (relyingPartyService, dbExchange) => {
  const presentationDefinition = relyingPartyService.presentationDefinition
    ? omit(['id'], relyingPartyService.presentationDefinition)
    : {};

  return {
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
    ...presentationDefinition,
  };
};

const expectedDbExchange = (
  tenant,
  relyingPartyService,
  depot,
  dbExchange,
  walletNonce,
) => ({
  _id: expect.any(ObjectId),
  protocolMetadata: {
    protocol: ExchangeProtocols.OPENID4VP,
    nonce: expect.any(String),
    walletNonce,
    presentationDefinition: expectedPresentationDefinition(
      relyingPartyService,
      dbExchange,
    ),
    presentationRequestExpiresAt: expect.any(Date),
  },
  depotId: new ObjectId(depot._id),
  events: [
    { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
    {
      state: ExchangeStates.PRESENTATION_REQUEST_REQUESTED,
      timestamp: expect.any(Date),
    },
  ],
  serviceId: new ObjectId(relyingPartyService._id),
  type: ExchangeTypes.RELYING_PARTY,
  tenantId: new ObjectId(tenant._id),
  createdAt: expect.any(Date),
  updatedAt: expect.any(Date),
});

const expectedDbDepot = (tenant, relyingPartyService) => ({
  _id: expect.any(ObjectId),
  serviceId: new ObjectId(relyingPartyService._id),
  tenantId: new ObjectId(tenant._id),
  createdAt: expect.any(Date),
  updatedAt: expect.any(Date),
});

const descriptors = {
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
};

const inputDescriptor = (type, group) => {
  const descriptor = omit(['display'], descriptors[type]);
  if (group != null) {
    descriptor.group = group;
  }
  return descriptor;
};
