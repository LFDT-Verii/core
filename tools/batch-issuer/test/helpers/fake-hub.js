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

const nock = require('./nock');
const { depotsMatching } = require('./mock-services');
const {
  AUTH_TOKEN,
  HUB_URL,
  SERVICE_ID,
  TENANT_ID,
  buildService,
} = require('./fixtures');

const TIMESTAMP = '2026-11-13T00:00:00.000Z';
const MANY = 100000;

// An ObjectId-like id, such as de9000000000000000000001.
const objectId = (prefix, number) =>
  `${prefix}${String(number).padStart(24 - prefix.length, '0')}`;

const SHARED_LINK = `${HUB_URL}/app-redirect?service=${SERVICE_ID}`;
const depotLink = (depotId, refresh) =>
  `${HUB_URL}/app-redirect?depot=${depotId}&code=${refresh}`;

// The write requests a fake Hub received, without its reads.
const WRITE_PATHS = [
  'depots/create',
  'credentials/create-many',
  'depots/resolve-deferred-credentials',
  'issue-links/refresh',
];

/**
 * A fake Credentialing Hub: its service, depots and credentials, and the
 * requests it received. It keeps them across runs of the command line, so a
 * rerun sees what an earlier run created.
 * @param {{ service?: object, depots?: Array<object> }} [options]
 */
const initFakeHub = ({ service = buildService(), depots = [] } = {}) => ({
  service,
  depots: [...depots],
  credentials: [],
  requests: [],
  refreshes: 0,
});

const writeRequests = (hub) =>
  hub.requests.filter(({ path }) => WRITE_PATHS.includes(path));

const createDepot = (hub, { serviceId, depot }) => {
  const created = {
    id: objectId('de90', hub.depots.length + 1),
    serviceId,
    deferredCredentials: false,
    ...depot,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
  hub.depots.push(created);
  return { depot: created };
};

const createCredentials = (hub, { items }) => {
  const credentials = items.map(({ depotId, credential }, index) => ({
    id: objectId('c4ed', hub.credentials.length + index + 1),
    depotId,
    ...credential,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  }));
  hub.credentials.push(...credentials);
  return { credentials };
};

const resolveDeferred = (hub, { depotId }) => ({
  depot: hub.depots.find(({ id }) => id === depotId),
  notification: { status: 'skipped_no_waiting_exchange' },
});

// Each refresh of a depot's link gives it a new pre-authorized code.
const refreshIssueLinks = (hub, { depotId }) => {
  if (depotId == null) {
    return { redirectUrl: SHARED_LINK, vnProtocolLink: 'velocity-network://' };
  }
  hub.refreshes += 1;
  return {
    redirectUrl: depotLink(depotId, hub.refreshes),
    vnProtocolLink: 'velocity-network://',
  };
};

const HANDLERS = {
  'depots/get': (hub, { authValues }) => ({
    depots: depotsMatching(hub.depots)(authValues),
  }),
  'depots/create': createDepot,
  'credentials/create-many': createCredentials,
  'depots/resolve-deferred-credentials': resolveDeferred,
  'issue-links/refresh': refreshIssueLinks,
};

/**
 * Mocks the Hub's operator API with a fake Hub. A failure makes one request
 * to a path fail: with its reply, or as a dropped connection without one.
 * @param {object} hub the fake Hub
 * @param {Object<string, { at: number, reply?: Function }>} [failures] by path, such as 'depots/create'
 */
const mockHub = (hub, failures = {}) => {
  const calls = {};
  const handle = (path) => async (request) => {
    const body = await request.json();
    hub.requests.push({ path, body });
    calls[path] = (calls[path] ?? 0) + 1;
    const failure = failures[path];
    if (failure?.at !== calls[path]) {
      return [200, { ...HANDLERS[path](hub, body), requestId: 'request-1' }];
    }
    if (failure.reply == null) {
      throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    }
    return failure.reply(body);
  };
  const scope = nock(HUB_URL).matchHeader(
    'authorization',
    `Bearer ${AUTH_TOKEN}`,
  );
  scope
    .get('/operator/issuer-services/get')
    .query({ tenantId: TENANT_ID, serviceId: SERVICE_ID })
    .times(MANY)
    .reply(200, () => ({ services: [hub.service], requestId: 'request-1' }));
  Object.keys(HANDLERS).forEach((path) => {
    scope.post(`/operator/${path}`).times(MANY).reply(handle(path));
  });
};

module.exports = {
  SHARED_LINK,
  depotLink,
  initFakeHub,
  mockHub,
  objectId,
  writeRequests,
};
