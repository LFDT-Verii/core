/**
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

const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const {
  mockHttpClientJsonResponse,
  mockHttpClientModule,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { jwtVerify } = require('@verii/jwt');
const { buildMongoConnection } = require('@verii/tests-helpers');
const { ObjectId } = require('mongodb');
const { initCredentialFactory } = require('../../src/entities/credentials');
const { initDepotFactory } = require('../../src/entities/depots');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const { constructTenant } = require('../helpers/construct-tenant');
const createTestFastify = require('../helpers/create-test-fastify');

const configurationId = 'foundation.velocitynetwork.Employment';
const v2ConfigurationId = 'foundation.velocitynetwork.Employment.vc+jwt';

describe('OpenID4VCI representation-independent protocol guardrails', () => {
  let fastify;
  let persistCredential;
  let persistDepot;
  let persistIssuerService;
  let persistKey;
  let persistTenant;
  let tenant;
  let tenantKeyPair;

  before(async () => {
    fastify = createTestFastify({
      mongoConnection: buildMongoConnection('test-cih-blmp-3-3-protocol'),
    });
    await fastify.ready();
    ({ persistCredential } = initCredentialFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));

    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('tenants').deleteMany({});
    ({ issuerKeyPair: tenantKeyPair, tenant } = await constructTenant(
      persistTenant,
      persistKey,
    ));
  });

  beforeEach(async () => {
    resetMockHttpClient();
    await Promise.all(
      ['credentials', 'depots', 'exchanges', 'issuerServices'].map(
        (collection) => mongoDb().collection(collection).deleteMany({}),
      ),
    );
  });

  after(async () => fastify.close());

  it('freezes the credential offer independently of credential representation', async () => {
    const { depot, issuerService } = await setupCredential();
    const credentialTypeMetadatas = [
      {
        credentialType: 'Employment',
        issuerCategory: 'RegularIssuer',
        schemaUrl: 'https://example.com/employment.schema.json',
      },
    ];
    const profile = {
      credentialSubject: {
        permittedVelocityServiceCategory: ['Inspector', 'Issuer'],
      },
    };
    mockHttpClientJsonResponse('get', credentialTypeMetadatas);
    mockHttpClientJsonResponse('get', profile);

    const response = await fastify.injectJson({
      method: 'POST',
      url: '/operator/issue-links/refresh',
      payload: {
        depotId: depot._id,
        serviceId: issuerService._id,
        tenantId: tenant._id,
      },
    });

    expect(response.statusCode).toEqual(200);
    const offerUri = new URL(response.json.openidCredentialOffer);
    expect(offerUri.protocol).toEqual('openid-credential-offer:');
    expect(JSON.parse(offerUri.searchParams.get('credential_offer'))).toEqual({
      credential_configuration_ids: [configurationId, v2ConfigurationId],
      credential_issuer: `https://localhost.test/r/${tenant._id}`,
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': response.json.preauthCode,
        },
      },
    });
  });

  it('freezes the pre-authorized access token response independently of credential representation', async () => {
    const { credential, depot } = await setupCredential({
      preauthCode: 'preauth-code',
    });
    const response = await fastify.inject({
      method: 'POST',
      url: `/r/${tenant._id}/oauth/token`,
      body: 'grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code&pre-authorized_code=preauth-code',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({
      access_token: expect.any(String),
      authorization_details: [
        {
          credential_configuration_id: configurationId,
          credential_identifiers: [`${credential._id}`],
          type: 'openid_credential',
        },
      ],
      expires_in: expect.any(Number),
      token_type: 'Bearer',
    });
    expect(
      await jwtVerify(response.json().access_token, tenantKeyPair.publicKey),
    ).toEqual({
      header: { alg: 'ES256K', typ: 'JWT' },
      payload: {
        aud: `https://localhost.test/r/${tenant._id}`,
        exp: expect.any(Number),
        iat: expect.any(Number),
        iss: `https://localhost.test/r/${tenant._id}/oauth/authorize`,
        jti: expect.any(String),
        sub: `https://localhost.test/r/${tenant._id}`,
        authorization_details: [
          {
            credential_configuration_id: configurationId,
            credential_identifiers: [`${credential._id}`],
            type: 'openid_credential',
          },
        ],
      },
    });
    expect(depot.preauthCodeHash).toEqual(expect.any(String));
  });

  it('freezes the nonce cache contract independently of credential representation', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/nonce`,
    });

    expect(response.statusCode).toEqual(200);
    expect(response.headers['cache-control']).toEqual('no-store');
    expect(response.json).toEqual({ c_nonce: expect.any(String) });
  });

  it('freezes credential endpoint authentication, request, and proof errors independently of representation', async () => {
    const noTokenResponse = await fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/credential`,
      payload: {},
    });
    expect(noTokenResponse.statusCode).toEqual(401);
    expect(noTokenResponse.json).toEqual({
      error: 'invalid_token',
      error_description: 'invalid_token',
    });

    const authToken = await buildAuthToken();
    const malformedResponse = await fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/credential`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { foo: 'bar' },
    });
    expect(malformedResponse.statusCode).toEqual(400);
    expect(malformedResponse.json).toEqual({
      error: 'invalid_credential_request',
      error_description: expect.any(String),
    });

    const proofResponse = await fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/credential`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        credential_identifier: new ObjectId().toString(),
        proofs: { jwt: [] },
      },
    });
    expect(proofResponse.statusCode).toEqual(400);
    expect(proofResponse.json).toEqual({
      error: 'invalid_proof',
      error_description: 'Invalid proof',
    });
  });

  it('freezes the notification and deferred-endpoint behavior independently of credential representation', async () => {
    const noTokenResponse = await fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/notification`,
      payload: {
        event: 'credential_accepted',
        notification_id: 'missing',
      },
    });
    expect(noTokenResponse.statusCode).toEqual(401);
    expect(noTokenResponse.json).toEqual({
      error: 'invalid_token',
      error_description: 'invalid_token',
    });

    const deferredResponse = await fastify.injectJson({
      method: 'POST',
      url: `/r/${tenant._id}/openid4vc/deferred_credential`,
    });
    expect(deferredResponse.statusCode).toEqual(404);
  });

  const buildAuthToken = async () => {
    const { jwtSign } = require('@verii/jwt');
    return jwtSign({}, tenantKeyPair.privateKey, {
      subject: `https://localhost.test/r/${tenant._id}`,
    });
  };

  const setupCredential = async ({ preauthCode } = {}) => {
    const issuerService = await persistIssuerService({
      authMethods: ['preauth'],
      tenant,
    });
    const depot = await persistDepot({
      preauthCode,
      service: issuerService,
      tenant,
    });
    const credential = await persistCredential({ depot, tenant });
    return { credential, depot, issuerService };
  };
});
