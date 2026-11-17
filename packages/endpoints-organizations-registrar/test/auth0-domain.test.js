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

const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const { testIAMSuperUser } = require('@verii/tests-helpers');
const nock = require('./helpers/nock');
const buildFastify = require('./helpers/build-fastify');

// Local dev points OAUTH0_DOMAIN at localauth0 with a URL, which auth0's ManagementClient rejects
const auth0Domain = 'http://auth0:3000';
const auth0Origin = 'https://auth0:3000';

describe('Auth0 domain given as a URL', () => {
  let fastify;
  let previousAuth0Domain;

  before(async () => {
    previousAuth0Domain = process.env.OAUTH0_DOMAIN;
    process.env.OAUTH0_DOMAIN = auth0Domain;
    fastify = buildFastify();
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
    process.env.OAUTH0_DOMAIN = previousAuth0Domain;
    nock.cleanAll();
  });

  it('should start the server and call the management api at the bare host', async () => {
    const userId = 'auth0|1';
    const tokenScope = nock(auth0Origin).post('/oauth/token').reply(200, {
      access_token: 'management-token',
      token_type: 'Bearer',
      expires_in: 86400,
    });
    const managementScope = nock(auth0Origin, {
      reqheaders: { authorization: 'Bearer management-token' },
    })
      .get(`/api/v2/users/${encodeURIComponent(userId)}`)
      .reply(200, {
        user_id: userId,
        email: 'foo@foo.test',
        given_name: 'foo',
        family_name: 'bar',
      })
      .get(`/api/v2/users/${encodeURIComponent(userId)}/roles`)
      .query({ page: 0, per_page: 10, include_totals: true })
      .reply(200, {
        start: 0,
        limit: 10,
        total: 1,
        roles: [{ id: fastify.config.auth0ClientAdminRoleId, name: 'admin' }],
      });

    const response = await fastify.injectJson({
      method: 'GET',
      url: `/api/v0.6/users/${userId}`,
      headers: {
        'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: userId,
      email: 'foo@foo.test',
      givenName: 'foo',
      familyName: 'bar',
      registrarRole: 'clientadmin',
    });
    expect(tokenScope.isDone()).toEqual(true);
    expect(managementScope.isDone()).toEqual(true);
  });
});
