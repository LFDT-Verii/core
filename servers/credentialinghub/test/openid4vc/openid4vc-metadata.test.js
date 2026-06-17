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
  mockHttpClientModule,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { jwtVerify } = require('@verii/jwt');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');

const issuerUrl = (tenant) => `https://localhost.test/r/${tenant._id}`;

describe('.well-known openid4vc metadata test suite', () => {
  let fastify;

  let tenant;
  let issuerKeyPair;
  let issuerKey;

  let persistTenant;
  let persistKey;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    ({ tenant, issuerKeyPair, issuerKey } = await constructTenant(
      persistTenant,
      persistKey,
    ));
  });

  beforeEach(async () => {
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });

  describe('openid4vc credential metadata test suite', () => {
    it('should 200 with json credential metadata', async () => {
      const credentialTypeMetadatas = [
        {
          credentialType: 'fooType',
          schemaUrl: 'https://example.com/foo-schema.schema.json',
          issuerCategory: 'RegularIssuer',
        },
        {
          credentialType: 'barType',
          schemaUrl: 'https://example.com/foo-schema.schema.json',
          issuerCategory: 'NoIssuer',
        },
      ];
      const profile = {
        credentialSubject: {
          permittedVelocityServiceCategory: ['Inspector', 'Issuer', 'Foo'],
        },
      };
      mockHttpClientJsonResponse('get', credentialTypeMetadatas);
      mockHttpClientJsonResponse('get', profile);

      const response = await fastify.injectJson({
        method: 'GET',
        url: `.well-known/openid-credential-issuer/r/${tenant._id}`,
        headers: {
          origin: 'foo',
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual(expectedCredentialMetadata(tenant));
      expect(response.headers['access-control-allow-origin']).toEqual('foo');
    });

    it('should 200 with jwt credential metadata', async () => {
      const credentialTypeMetadatas = [
        {
          credentialType: 'fooType',
          schemaUrl: 'https://example.com/foo-schema.schema.json',
          issuerCategory: 'RegularIssuer',
        },
        {
          credentialType: 'barType',
          schemaUrl: 'https://example.com/foo-schema.schema.json',
          issuerCategory: 'NoIssuer',
        },
      ];
      const profile = {
        credentialSubject: {
          permittedVelocityServiceCategory: ['Inspector', 'Issuer', 'Foo'],
        },
      };
      mockHttpClientJsonResponse('get', credentialTypeMetadatas);
      mockHttpClientJsonResponse('get', profile);

      const response = await fastify.inject({
        method: 'GET',
        url: `.well-known/openid-credential-issuer/r/${tenant._id}`,
        headers: {
          origin: 'foo',
          Accept: 'application/jwt',
        },
      });

      expect(response.statusCode).toEqual(200);
      const { header, payload } = await jwtVerify(
        response.body,
        issuerKeyPair.publicKey,
      );
      expect(header).toEqual({
        typ: 'JWT',
        alg: 'ES256K',
        kid: `${tenant.did}${issuerKey.kidFragment}`,
      });
      expect(payload).toEqual({
        ...expectedCredentialMetadata(tenant),
        iss: tenant.did,
        sub: tenant.did,
        exp: expect.any(Number),
        iat: expect.any(Number),
      });
      expect(response.headers['access-control-allow-origin']).toEqual('foo');
    });
  });

  describe('openid4vc authorization server metadata test suite', () => {
    it('should 200 with authorization server metadata', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `.well-known/oauth-authorization-server/r/${tenant._id}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({ signed_metadata: expect.any(String) });
      const { header, payload } = await jwtVerify(
        response.json.signed_metadata,
        issuerKeyPair.publicKey,
      );
      expect(header).toEqual({
        typ: 'JWT',
        alg: 'ES256K',
        kid: `${tenant.did}${issuerKey.kidFragment}`,
      });
      expect(payload).toEqual({
        ...expectedAuthorizationServerMetadata(tenant),
        iss: tenant.did,
        sub: tenant.did,
        exp: expect.any(Number),
        iat: expect.any(Number),
      });
    });
  });
});

const expectedCredentialMetadata = (tenant) => ({
  credential_issuer: `${issuerUrl(tenant)}`,
  credential_endpoint: `${issuerUrl(tenant)}/credential`,
  nonce_endpoint: `${issuerUrl(tenant)}/nonce`,
  deferred_credential_endpoint: `${issuerUrl(tenant)}/deferred_credential`,
  notification_endpoint: `${issuerUrl(tenant)}/notification`,
  display: [
    {
      locale: 'en',
      logo: {
        uri: 'https://localhost.test/logo.png',
        alt_text: 'fooName',
      },
      name: 'fooName',
    },
  ],
  credential_configurations_supported: {
    'foundation.velocitynetwork.fooType': {
      credential_definition: {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://lib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json',
        ],
        type: ['VerifiableCredential', 'fooType'],
      },
      credential_signing_alg_values_supported: ['ES256K'],
      cryptographic_binding_methods_supported: ['did:jwk'],
      format: 'jwt_vc_json-ld',
      proof_types_supported: {
        jwt: {
          proof_signing_alg_values_supported: ['ES256', 'ES256K'],
        },
      },
    },
  },
  authorization_servers: [`https://localhost.test/r/${tenant._id}/oauth`],
});

const expectedAuthorizationServerMetadata = (tenant) => ({
  authorization_endpoint: `${issuerUrl(tenant)}/oauth/authorize`,
  code_challenge_methods_supported: ['S256'],
  dpop_signing_alg_values_supported: ['ES256'],
  issuer: issuerUrl(tenant),
  jwks_uri: `${issuerUrl(tenant)}/oauth/jwks.json`,
  'pre-authorized_grant_anonymous_access_supported': true,
  pushed_authorization_request_endpoint: `${issuerUrl(tenant)}/oauth/par`,
  require_pushed_authorization_requests: true,
  token_endpoint: `${issuerUrl(tenant)}/oauth/token`,
  token_endpoint_auth_methods_supported: ['attest_jwt_client_auth'],
});
