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

const { after, before, beforeEach } = require('node:test');
const { filter, flow, includes, map, toLower } = require('lodash/fp');
const {
  buildAuthMatchValues,
} = require('@verii/credentialing-hub-operator-api');
const nock = require('./nock');
const {
  AUTH_TOKEN,
  HUB_URL,
  OPEN_BADGE_SCHEMA_URL,
  REGISTRAR_URL,
  SERVICE_ID,
  TENANT_ID,
  buildService,
  loadJsonFixture,
} = require('./fixtures');

// Every request must be mocked, and each test starts with no mocks.
const useNock = () => {
  before(() => {
    nock.disableNetConnect();
  });
  beforeEach(() => {
    nock.cleanAll();
  });
  after(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
};

const mockGetService = (
  services = [buildService()],
  { serviceId = SERVICE_ID } = {},
) =>
  nock(HUB_URL)
    .matchHeader('authorization', `Bearer ${AUTH_TOKEN}`)
    .get('/operator/issuer-services/get')
    .query({ tenantId: TENANT_ID, serviceId })
    .reply(200, { services, requestId: 'request-1' });

// Records the body of each POST depots/get, and replies with the depots that
// replyDepots returns for its authValues. nock 15 calls a reply function with
// the Fetch request.
const mockFindDepots = (replyDepots = () => [], requests = []) =>
  nock(HUB_URL)
    .matchHeader('authorization', `Bearer ${AUTH_TOKEN}`)
    .post('/operator/depots/get', (body) => {
      requests.push(body);
      return (
        body.tenantId === TENANT_ID && toLower(body.serviceId) === SERVICE_ID
      );
    })
    .times(100)
    .reply(200, async (request) => {
      const { authValues } = await request.json();
      return { depots: replyDepots(authValues), requestId: 'request-2' };
    });

const authValuesKey = flow(buildAuthMatchValues, JSON.stringify);

// Replies with the depots whose auth values match one of the tuples, as the
// Hub matches them.
const depotsMatching = (depots) => (tuples) => {
  const keys = map(authValuesKey, tuples);
  return filter(
    ({ authValues }) => includes(authValuesKey(authValues), keys),
    depots,
  );
};

const openBadgeMetadata = {
  credentialType: 'OpenBadgeCredential',
  schemaUrl: OPEN_BADGE_SCHEMA_URL,
};

const mockRegistrar = ({ metadatas = [openBadgeMetadata] } = {}) => {
  nock(REGISTRAR_URL)
    .get('/api/v0.6/credential-types')
    .query(true)
    .reply(200, metadatas);
  return nock(REGISTRAR_URL)
    .get(new URL(OPEN_BADGE_SCHEMA_URL).pathname)
    .reply(200, loadJsonFixture('open-badge-credential.schema.json'));
};

// The Hub and the registrar for a batch with nothing in the Hub yet.
const mockServices = ({ services, depots, requests } = {}) => {
  mockGetService(services);
  mockFindDepots(depots, requests);
  mockRegistrar();
};

module.exports = {
  depotsMatching,
  mockFindDepots,
  mockGetService,
  mockRegistrar,
  mockServices,
  useNock,
};
