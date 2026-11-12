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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');
const nock = require('./helpers/nock');
const { initHubClient } = require('../src/clients/hub-client');
const {
  AUTH_TOKEN,
  HUB_URL,
  SERVICE_ID,
  TENANT_ID,
  buildDepot,
} = require('./helpers/fixtures');

const ids = { tenantId: TENANT_ID, serviceId: SERVICE_ID };

describe('initHubClient', () => {
  const hub = initHubClient({ endpoint: HUB_URL, authToken: AUTH_TOKEN });

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

  describe('findDepotsByAuthValues', () => {
    it('sends no request without tuples', async () => {
      expect(await hub.findDepotsByAuthValues(ids, [])).toEqual([]);
    });

    it('splits the tuples into requests of at most 1000, and returns each depot once', async () => {
      const sizes = [];
      const depot = buildDepot();
      nock(HUB_URL)
        .post('/operator/depots/get', (body) => {
          sizes.push(body.authValues.length);
          return true;
        })
        .times(3)
        .reply(200, { depots: [depot], requestId: 'r' });
      const tuples = Array.from({ length: 2001 }, (value, index) => [
        `holder-${index}@example.com`,
      ]);

      expect(await hub.findDepotsByAuthValues(ids, tuples)).toEqual([depot]);
      expect(sizes).toEqual([1000, 1000, 1]);
    });

    it('treats a reply without depots as no depots', async () => {
      nock(HUB_URL).post('/operator/depots/get').reply(200, {});

      expect(
        await hub.findDepotsByAuthValues(ids, [['a@example.com']]),
      ).toEqual([]);
    });
  });

  describe('getIssuerService', () => {
    it('returns only the requested service', async () => {
      nock(HUB_URL)
        .get('/operator/issuer-services/get')
        .query(true)
        .reply(200, { services: [{ id: 'another' }], requestId: 'r' });

      expect(await hub.getIssuerService(ids)).toBeUndefined();
    });
  });
});
