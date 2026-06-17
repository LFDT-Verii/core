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

const { mockHttpClientModule } = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { jwtVerify } = require('@verii/jwt');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initDepotFactory } = require('../../src/entities/depots');
const { initCredentialFactory } = require('../../src/entities/credentials');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');

describe('OAuth test suite', () => {
  let fastify;

  let persistTenant;
  let persistIssuerService;
  let persistKey;
  let persistDepot;
  let persistCredential;

  let tenant;
  let issuerKeyPair;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistCredential } = initCredentialFactory(fastify));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('issuerKeys').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});

    ({ tenant, issuerKeyPair } = await constructTenant(
      persistTenant,
      persistKey,
    ));
  });

  beforeEach(async () => {
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });

  describe('OAuth token test suite', () => {
    describe('OAuth token endpoint error cases', () => {
      it('should 400 with missing grant_type', async () => {
        const response = await fastify.inject({
          method: 'POST',
          url: `/r/${tenant._id}/oauth/token`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: '',
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json()).toEqual({
          error: 'invalid_request',
          error_description: "body must have required property 'grant_type'",
        });
      });
      it('should 400 with missing pre-authorized_code', async () => {
        const response = await fastify.inject({
          method: 'POST',
          url: `/r/${tenant._id}/oauth/token`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=foo',
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json()).toEqual({
          error: 'invalid_request',
          error_description:
            "body must have required property 'pre-authorized_code'",
        });
      });
      it('should 400 with bad grant_type', async () => {
        const response = await fastify.inject({
          method: 'POST',
          url: `/r/${tenant._id}/oauth/token`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=foo&pre-authorized_code=foo',
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json()).toEqual({
          error: 'unsupported_grant_type',
          error_description: "The grant type 'foo' is not supported",
        });
      });

      it("should 400 with 'content-type' header that is not 'application/x-www-form-urlencoded'", async () => {
        const response = await fastify.inject({
          method: 'POST',
          url: `/r/${tenant._id}/oauth/token`,
          headers: { 'content-type': 'application/json' },
          body: {
            grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
            'pre-authorized_code': 'foo',
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json()).toEqual({
          error: 'invalid_request',
          error_description: 'headers/content-type must be equal to constant',
        });
      });
      it('should 400 with unparsable authorization_details', async () => {
        const authorizationDetailsQuery = 'authorization_details={/}';
        const response = await fastify.inject({
          method: 'POST',
          url: `/r/${tenant._id}/oauth/token`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code&pre-authorized_code=foo&${authorizationDetailsQuery}`,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json()).toEqual({
          error: 'invalid_request',
          error_description: 'body/authorization_details must be array',
        });
      });
      it('should 400 with bad authorization_details array', async () => {
        const authorizationDetails = {};
        const authorizationDetailsQuery = `authorization_details=${encodeURIComponent(
          JSON.stringify(authorizationDetails),
        )}`;
        const response = await fastify.inject({
          method: 'POST',
          url: `/r/${tenant._id}/oauth/token`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code&pre-authorized_code=foo&${authorizationDetailsQuery}`,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json()).toEqual({
          error: 'invalid_request',
          error_description: 'body/authorization_details must be array',
        });
      });
      it('should 400 with missing authorization_details.type', async () => {
        const authorizationDetails = [{}];
        const authorizationDetailsQuery = `authorization_details=${encodeURIComponent(
          JSON.stringify(authorizationDetails),
        )}`;
        const response = await fastify.inject({
          method: 'POST',
          url: `/r/${tenant._id}/oauth/token`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code&pre-authorized_code=foo&${authorizationDetailsQuery}`,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json()).toEqual({
          error: 'invalid_request',
          error_description:
            "body/authorization_details/0 must have required property 'type'",
        });
      });

      it('should 400 with missing authorization_details.credential_configuration_id', async () => {
        const authorizationDetails = [{ type: 'foo' }];
        const authorizationDetailsQuery = `authorization_details=${encodeURIComponent(
          JSON.stringify(authorizationDetails),
        )}`;
        const response = await fastify.inject({
          method: 'POST',
          url: `/r/${tenant._id}/oauth/token`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code&pre-authorized_code=foo&${authorizationDetailsQuery}`,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json()).toEqual({
          error: 'invalid_request',
          error_description:
            "body/authorization_details/0 must have required property 'credential_configuration_id'",
        });
      });
      it('should 400 with bad authorization_details.type', async () => {
        const authorizationDetails = [
          { type: 'foo', credential_configuration_id: 'foo' },
        ];
        const authorizationDetailsQuery = `authorization_details=${encodeURIComponent(
          JSON.stringify(authorizationDetails),
        )}`;
        const response = await fastify.inject({
          method: 'POST',
          url: `/r/${tenant._id}/oauth/token`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code&pre-authorized_code=foo&${authorizationDetailsQuery}`,
        });

        expect(response.statusCode).toEqual(400);

        expect(response.json()).toEqual({
          error: 'invalid_request',
          error_description:
            'body/authorization_details/0/type must be equal to constant',
        });
      });
      it('should 400 when pre-authorization_code is not matching', async () => {
        await persistDepot({ tenant, preauthCode: 'foo' });
        const response = await fastify.inject({
          method: 'POST',
          url: `/r/${tenant._id}/oauth/token`,
          body: 'grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code&pre-authorized_code=bar',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json()).toEqual({
          error: 'invalid_grant',
          error_description: "Invalid 'pre-authorized_code' provided",
        });
      });
      it('should 400 when tx_code is provided but not expected', async () => {
        const issuerService = await persistIssuerService({ tenant });
        await persistDepot({
          tenant,
          service: issuerService,
          preauthCode: 'foo',
        });
        const response = await fastify.inject({
          method: 'POST',
          url: `/r/${tenant._id}/oauth/token`,
          body: 'grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code&pre-authorized_code=foo&tx_code=foo',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json()).toEqual({
          error: 'invalid_request',
          error_description: "Request contains 'tx_code' that was not expected",
        });
      });
    });
    describe('OAuth token endpoint success cases', () => {
      it('should 200 without authorizationDetails in request', async () => {
        const issuerService = await persistIssuerService({ tenant });
        const depot = await persistDepot({
          tenant,
          service: issuerService,
          preauthCode: 'foo',
        });
        const credential = await persistCredential({ tenant, depot });
        const response = await fastify.inject({
          method: 'POST',
          url: `/r/${tenant._id}/oauth/token`,
          body: 'grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code&pre-authorized_code=foo',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json()).toEqual({
          access_token: expect.any(String),
          expires_in: issuerService.authTokensExpireIn,
          token_type: 'Bearer',
          authorization_details: [
            {
              credential_configuration_id:
                'foundation.velocitynetwork.Employment',
              credential_identifiers: [`${credential._id}`],
              type: 'openid_credential',
            },
          ],
        });
        const decodedJwt = await jwtVerify(
          response.json().access_token,
          issuerKeyPair.publicKey,
        );
        expect(decodedJwt).toEqual({
          header: {
            alg: 'ES256K',
            typ: 'JWT',
          },
          payload: {
            aud: `https://localhost.test/r/${tenant._id}`,
            exp: expect.any(Number),
            iat: expect.any(Number),
            iss: `https://localhost.test/r/${tenant._id}/oauth/authorize`,
            jti: expect.any(String),
            sub: `https://localhost.test/r/${tenant._id}`,
          },
        });
      });
    });
  });
});
