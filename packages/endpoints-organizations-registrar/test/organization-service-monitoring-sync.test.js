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
const { castArray, includes, map, some } = require('lodash/fp');
const { nanoid } = require('nanoid');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { mapWithIndex, runSequentially } = require('@verii/common-functions');
const { ServiceTypes } = require('@verii/organizations-registry');

const nock = require('nock');
const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');
const buildFastify = require('./helpers/build-fastify');

const { AuthClientTypes } = require('../src/entities');

const baseUrl = '/api/v0.6/organizations';
const serviceAgentVersionMock = '0.9.0-build.abc12345';

const setServicePingNock = (
  serviceEndpoint,
  versionFlag = true,
  statusCode,
  delay = 10
) => {
  const uri = new URL(serviceEndpoint);
  const version = versionFlag ? `\nVersion: ${serviceAgentVersionMock}` : '';
  return nock(uri.origin, {
    reqheaders: {
      'accept-encoding': 'gzip, deflate, br',
    },
  })
    .get(uri.pathname)
    .delay(delay)
    .reply(
      statusCode != null ? statusCode : 200,
      `Welcome to Credential APIs\nHost: https://devagent.velocitycareerlabs.io ${version}`
    );
};

const setMonitorEventsNock = (delay = 10) => {
  return nock('https://betteruptime.com', {})
    .post('/api/v2/monitors')
    .reply(200, {
      data: {
        id: '12345678',
        type: 'monitor',
        attributes: {
          url: 'https://service.com',
          pronounceable_name:
            'Service homepage : #credentialagent-1, version-0.9.0-build.abc12345',
          monitor_type: 'status',
          monitor_group_id: null,
          last_checked_at: null,
          status: 'pending',
          policy_id: null,
          required_keyword: null,
          verify_ssl: true,
          check_frequency: 30,
          call: true,
          sms: true,
          email: true,
          push: true,
          team_wait: null,
          http_method: 'get',
          request_timeout: 30,
          recovery_period: 180,
          request_headers: [
            {
              id: '72638',
              name: 'X-Custom-Header',
              value: 'custom header value',
            },
          ],
          request_body: null,
          follow_redirects: true,
          remember_cookies: true,
          paused_at: null,
          created_at: '2021-10-06T20:32:11.630Z',
          updated_at: '2021-10-06T20:32:11.630Z',
          ssl_expiration: null,
          domain_expiration: null,
          regions: null,
          port: null,
          confirmation_period: 0,
        },
        relationships: {
          policy: {
            data: null,
          },
        },
      },
    })
    .post(/\/api\/v2\/status-pages\/\d{6}\/resources/)
    .delay(delay)
    .reply(200, {
      data: {
        id: '123456',
        type: 'monitor',
        attributes: {
          url: 'https://service.com',
          pronounceable_name: 'Service homepage',
          monitor_type: 'status',
          monitor_group_id: null,
          last_checked_at: null,
          status: 'pending',
          policy_id: null,
          required_keyword: null,
          verify_ssl: true,
          check_frequency: 30,
          call: true,
          sms: true,
          email: true,
          push: true,
          team_wait: null,
          http_method: 'get',
          request_timeout: 30,
          recovery_period: 180,
          request_headers: [
            {
              id: '72638',
              name: 'X-Custom-Header',
              value: 'custom header value',
            },
          ],
          request_body: null,
          follow_redirects: true,
          remember_cookies: true,
          paused_at: null,
          created_at: '2021-10-06T20:32:11.630Z',
          updated_at: '2021-10-06T20:32:11.630Z',
          ssl_expiration: null,
          domain_expiration: null,
          regions: null,
          port: null,
          confirmation_period: 0,
        },
        relationships: {
          policy: {
            data: null,
          },
        },
      },
    })
    .get(/\/api\/v2\/status-pages\/\d{6}\/sections/)
    .reply(200, {
      data: [
        {
          id: '12345',
          type: 'status_page_section',
          attributes: {
            name: 'Current status by service',
            position: 0,
          },
        },
        {
          id: '12345',
          type: 'status_page_section',
          attributes: {
            name: 'EU datacenter',
            position: 1,
          },
        },
      ],
      pagination: {
        first:
          'https://betteruptime.com/api/v2/status-pages/123456789/sections?page=1',
        last: 'https://betteruptime.com/api/v2/status-pages/123456789/sections?page=1',
        prev: null,
        next: null,
      },
    })
    .post(/\/api\/v2\/status-pages\/\d{6}\/sections/)
    .reply(200, {
      data: {
        id: '12345',
        type: 'status_page_section',
        attributes: {
          name: 'EU Datacenter',
          position: 0,
        },
      },
    })
    .delete(/\/api\/v2\/monitors\/\d{6}/)
    .reply(204, {});
};

const setGetMonitorsNock = (dids, serviceIds) => {
  const didArray = castArray(dids);
  const serviceIdArray = castArray(serviceIds);
  return nock('https://betteruptime.com', {})
    .get('/api/v2/monitors')
    .reply(200, {
      data: mapWithIndex(
        (did, i) => ({
          id: '234567',
          type: 'monitor',
          attributes: {
            url: 'https://devagent.velocitycareerlabs.io/',
            pronounceable_name: `TEST, Test Organization, ${did} : ${serviceIdArray[i]}, version-0.9.0-build.abc12345`,
            monitor_type: 'expected_status_code',
            monitor_group_id: null,
            last_checked_at: '2021-10-10T14:42:44.000Z',
            status: 'up',
            policy_id: null,
            required_keyword: null,
            verify_ssl: true,
            check_frequency: 30,
            call: false,
            sms: false,
            email: true,
            push: true,
            team_wait: 0,
            http_method: 'get',
            request_timeout: 30,
            recovery_period: 300,
            request_headers: [],
            request_body: '',
            follow_redirects: true,
            remember_cookies: true,
            paused_at: null,
            created_at: '2021-08-23T11:45:03.524Z',
            updated_at: '2021-08-23T11:45:03.524Z',
            ssl_expiration: null,
            domain_expiration: null,
            regions: ['us', 'eu', 'as', 'au'],
            port: null,
            confirmation_period: 0,
          },
          relationships: {
            policy: {
              data: null,
            },
          },
        }),
        didArray
      ),
    });
};

const getUrlFailNock = (host, url) => () => nock(host).get(url).reply(500, '');

const setGetSectionsFailNock = getUrlFailNock(
  'https://betteruptime.com',
  /api\/v2\/status-pages\/\d{6}\/sections/
);

const nockExecuted = (pendingMockString) => (nockScope) => {
  const pendingMocks = nockScope.pendingMocks();
  return !some((element) => includes(pendingMockString, element), pendingMocks);
};

const getServiceVersionNockExecuted = (uri) => nockExecuted(`GET ${uri}`);

const postMonitorNockExecuted = nockExecuted(
  'POST https://betteruptime.com:443/api/v2/monitors'
);

describe('Monitoring Test Suite', () => {
  let fastify;
  let persistOrganization;

  const clearDb = async () => {
    await mongoDb().collection('organizations').deleteMany({});
    await mongoDb().collection('organizationKeys').deleteMany({});
    await mongoDb().collection('groups').deleteMany({});
  };

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistOrganization } = initOrganizationFactory(fastify));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  describe('Monitoring Tests', () => {
    let orgs;
    let dids;
    const serviceIds = ['#acme', '#beta'];
    const serviceEndpoints = [
      'https://agent.samplevendor.com/acme',
      'https://agent.samplevendor.com/beta',
    ];

    beforeAll(async () => {
      await clearDb();
      const authClients = [
        {
          type: 'auth0',
          clientType: AuthClientTypes.REGISTRAR,
          clientId: nanoid(),
          clientGrantIds: [nanoid()],
        },
        {
          type: 'auth0',
          clientType: AuthClientTypes.CAO_NODE_CLIENT,
          clientId: nanoid(),
          clientGrantIds: [nanoid(), nanoid()],
          serviceId: serviceIds[1],
        },
      ];

      orgs = await runSequentially([
        () =>
          persistOrganization({
            service: [
              {
                id: serviceIds[0],
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: serviceEndpoints[0],
              },
            ],
          }),
        () =>
          persistOrganization({
            service: [
              {
                id: serviceIds[1],
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: serviceEndpoints[1],
              },
            ],
            authClients,
          }),
      ]);

      dids = map('didDoc.id', orgs);
    });

    describe('syncing unmonitored orgs', () => {
      it('should add all services if nothing synced', async () => {
        setServicePingNock(serviceEndpoints[0]);
        setServicePingNock(serviceEndpoints[1], false);
        setGetMonitorsNock([], []);
        const monitorEventNocks = [
          setMonitorEventsNock(),
          setMonitorEventsNock(),
        ];
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/monitoring/sync`,
          payload: {},
        });

        expect(response.statusCode).toEqual(204);
        for (const monitorEventNock of monitorEventNocks) {
          expect(postMonitorNockExecuted(monitorEventNock)).toEqual(true);
        }
      });
      it('should add only unsynced services', async () => {
        setServicePingNock(serviceEndpoints[1]);
        setGetMonitorsNock(dids[0], serviceIds[0]);
        const monitorEventNock = setMonitorEventsNock();
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/monitoring/sync`,
          payload: {},
        });

        expect(postMonitorNockExecuted(monitorEventNock)).toEqual(true);
        expect(response.statusCode).toEqual(204);
      });
      it('repeat sync doesnt sync anything', async () => {
        setGetMonitorsNock(dids, serviceIds);
        const monitorEventNock = setMonitorEventsNock();
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/monitoring/sync`,
          payload: {},
        });

        expect(response.statusCode).toEqual(204);
        expect(postMonitorNockExecuted(monitorEventNock)).toEqual(false);
      });
      it('failed get service version should still create a service monitor', async () => {
        const serviceVersion0Nock = setServicePingNock(
          serviceEndpoints[0],
          undefined,
          500
        );
        const serviceVersion1Nock = setServicePingNock(serviceEndpoints[1]);
        setGetMonitorsNock([], []);
        const monitorEventNocks = [
          setMonitorEventsNock(),
          setMonitorEventsNock(),
        ];
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/monitoring/sync`,
          payload: {},
        });

        expect(response.statusCode).toEqual(204);
        expect(
          getServiceVersionNockExecuted(serviceEndpoints[0])(
            serviceVersion0Nock
          )
        ).toEqual(true);
        expect(
          getServiceVersionNockExecuted(serviceEndpoints[1])(
            serviceVersion1Nock
          )
        ).toEqual(true);
        for (const monitorEventNock of monitorEventNocks) {
          expect(postMonitorNockExecuted(monitorEventNock)).toEqual(true);
        }
      });
      it('failed sync should error hard', async () => {
        setGetMonitorsNock([], []);
        setServicePingNock(serviceEndpoints[0]);
        setServicePingNock(serviceEndpoints[1]);
        setGetSectionsFailNock();
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/monitoring/sync`,
          payload: {},
        });

        expect(response.statusCode).toEqual(502);
      });
    });
  });
});
