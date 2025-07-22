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

const mockCreateFineractClient = jest.fn();
const mockCreateStakesAccount = jest.fn();
const mockSendError = jest.fn().mockImplementation(() => {
  console.log('sendError test');
});
const mockInitSendError = jest.fn().mockReturnValue({
  sendError: mockSendError,
  startProfiling: () => {
    console.log('fake start sentry profiling');
  },
  finishProfiling: () => {
    console.log('fake finish sentry profiling');
  },
});
const mockUpdateAddressScopes = jest.fn().mockResolvedValue(undefined);

const mockInitPermission = jest.fn().mockResolvedValue({
  updateAddressScopes: mockUpdateAddressScopes,
});
const {
  castArray,
  first,
  includes,
  last,
  map,
  omit,
  some,
  times,
  pick,
  flow,
} = require('lodash/fp');
const { nanoid } = require('nanoid');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const {
  KeyPurposes,
  generateKeyPair,
  KeyAlgorithms,
} = require('@verii/crypto');
const {
  toRelativeServiceId,
  extractVerificationMethod,
} = require('@verii/did-doc');
const { mapWithIndex, wait } = require('@verii/common-functions');
const {
  AUTH0_USER_ID_FORMAT,
  ISO_DATETIME_FORMAT,
} = require('@verii/test-regexes');
const {
  mongoify,
  testRegistrarSuperUser,
  testWriteOrganizationsUser,
  errorResponseMatcher,
} = require('@verii/tests-helpers');
const {
  ServiceTypes,
  ServiceCategories,
  OrganizationRegistryErrorMessages,
} = require('@verii/organizations-registry');
const { ObjectId } = require('mongodb');

const console = require('console');

const nock = require('nock');
const { subDays } = require('date-fns/fp');

const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');
const initOrganizationKeysFactory = require('../src/entities/organization-keys/factories/organization-keys-factory');
const initGroupsFactory = require('../src/entities/groups/factories/groups-factory');
const initInvitationsFactory = require('../src/entities/invitations/factories/invitations-factory');
const initRegistrarConsentFactory = require('../src/entities/registrar-consents/factories/registrar-consents-factory');
const {
  sendServicesActivatedEmailMatcher,
  sendServicesActivatedEmailToCAOsMatcher,
  expectedServiceActivationRequiredEmail,
  expectedInvitationAcceptanceEmail,
} = require('./helpers/email-matchers');
const buildFastify = require('./helpers/build-fastify');
const organizationsRepoPlugin = require('../src/entities/organizations/repos/repo');

const {
  AuthClientTypes,
  didDocServiceFields,
  normalizeProfileName,
  buildPublicService,
  getServiceConsentType,
  ConsentTypes,
  OrganizationServiceErrorMessages,
} = require('../src/entities');

const baseUrl = '/api/v0.6/organizations';

const mockAuth0ClientDelete = jest.fn().mockImplementation(async ({ id }) => {
  console.log(`deleting auth0 client ${id}`);
});
const mockAuth0ClientGrantDelete = jest
  .fn()
  .mockImplementation(async ({ id }) => {
    console.log(`deleting auth0 client grant ${id}`);
  });
const mockAuth0ClientCreate = jest.fn().mockImplementation(async (obj) => {
  const id = nanoid();
  console.log(`create auth0 client ${id}`);
  return { data: { client_id: id, client_secret: nanoid(), ...obj } };
});
const mockAuth0ClientGrantCreate = jest.fn().mockImplementation(async (obj) => {
  const id = nanoid();
  console.log(`create auth0 clientGrant ${id}`);
  return { data: { id: nanoid(), ...obj } };
});
const mockAuth0UserUpdate = jest
  .fn()
  .mockImplementation(async ({ id }, obj) => {
    console.log(`update auth0 user ${id}`);
    return { data: { id, ...obj } };
  });
const mockAuth0GetUsers = jest.fn().mockResolvedValue({
  data: times((id) => ({ email: `${id}@localhost.test` }), 2),
});

const mockAuth0GetUser = jest
  .fn()
  .mockImplementation(() =>
    Promise.resolve({ data: { email: 'admin@localhost.test' } })
  );

jest.mock('auth0', () => ({
  ManagementClient: jest.fn().mockImplementation(() => ({
    clients: {
      create: mockAuth0ClientCreate,
      delete: mockAuth0ClientDelete,
    },
    clientGrants: {
      create: mockAuth0ClientGrantCreate,
      delete: mockAuth0ClientGrantDelete,
    },
    users: {
      get: mockAuth0GetUser,
      update: mockAuth0UserUpdate,
    },
    getUsers: mockAuth0GetUsers,
  })),
}));

jest.mock('@verii/contract-permissions', () => {
  const originalModule = jest.requireActual(
    '@verii/contract-permissions'
  );
  return {
    ...originalModule,
    initPermissions: mockInitPermission,
  };
});

const mockSendEmail = jest.fn((payload) => payload);

jest.mock('@aws-sdk/client-ses', () => ({
  SendEmailCommand: jest.fn((args) => args),
  SESClient: jest.fn().mockImplementation(() => ({
    send: mockSendEmail,
  })),
}));

jest.mock('@verii/fineract-client', () => {
  const originalModule = jest.requireActual(
    '@verii/fineract-client'
  );
  return {
    ...originalModule,
    createFineractClient: mockCreateFineractClient,
    createStakesAccount: mockCreateStakesAccount,
  };
});

jest.mock('@verii/error-aggregation', () => {
  const originalModule = jest.requireActual(
    '@verii/error-aggregation'
  );
  return {
    ...originalModule,
    initSendError: mockInitSendError,
  };
});

jest.mock('nanoid/non-secure', () => {
  const originalModule = jest.requireActual('nanoid/non-secure');
  return {
    ...originalModule,
    nanoid: jest.fn().mockReturnValue('1'),
  };
});

const serviceAgentVersionMock = '0.9.0-build.abc12345';

const setServicePingNock = (
  url,
  versionFlag = true,
  statusCode,
  delay = 10
) => {
  const uri = last(url.split('/'));
  const host = url.replace(`/${uri}`, '');
  const version = versionFlag ? `\nVersion: ${serviceAgentVersionMock}` : '';
  return nock(host, {
    reqheaders: {
      'accept-encoding': 'gzip, deflate, br',
    },
  })
    .get(`/${uri}`)
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

const getUrlFailNock = (host, url) => () => nock(host, {}).get(url).reply(500);

const setGetSectionsFailNock = getUrlFailNock(
  'https://betteruptime.com',
  /\/api\/v2\/status-pages\/\d{6}\/sections/
);

const setGetMonitorsFailNock = getUrlFailNock(
  'https://betteruptime.com',
  '/api/v2/monitors'
);

const nockExecuted = (pendingMockString) => (nockScope) => {
  const pendingMocks = nockScope.pendingMocks();
  return !some((element) => includes(pendingMockString, element), pendingMocks);
};

const getServiceVersionNockExecuted = (uri) => nockExecuted(`GET ${uri}`);

const getSectionsNockExecuted = nockExecuted(
  'POST https://betteruptime.com:443/api/v2/status-pages\\/\\d{6}\\/sections/'
);
const postMonitorNockExecuted = nockExecuted(
  'POST https://betteruptime.com:443/api/v2/monitors'
);
const monitorDeletionNockExecuted = nockExecuted(
  'DELETE https://betteruptime.com:443//\\/api\\/v2\\/monitors\\/\\d{6}'
);

const getConsentsFromDb = ({ _id }) =>
  mongoDb()
    .collection('registrarConsents')
    .find({ organizationId: _id })
    .toArray();

describe('Organization Services Test Suite', () => {
  let fastify;
  let organizationsRepo;
  let persistOrganization;
  let persistRegistrarConsent;
  let newOrganization;
  let persistGroup;
  let persistInvitation;
  let persistOrganizationKey;
  let invitationCollection;

  const getOrganizationFromDb = (did) =>
    mongoDb().collection('organizations').findOne({
      'didDoc.id': did,
    });

  const clearDb = async () => {
    await mongoDb().collection('organizations').deleteMany({});
    await mongoDb().collection('organizationKeys').deleteMany({});
    await mongoDb().collection('groups').deleteMany({});
    await mongoDb().collection('invitations').deleteMany({});
    await mongoDb().collection('registrarConsents').deleteMany({});
  };

  beforeEach(async () => {
    await clearDb();
  });

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistOrganization, newOrganization } =
      initOrganizationFactory(fastify));

    ({ persistGroup } = initGroupsFactory(fastify));
    ({ persistInvitation } = initInvitationsFactory(fastify));
    ({ persistOrganizationKey } = initOrganizationKeysFactory(fastify));
    ({ persistRegistrarConsent } = initRegistrarConsentFactory(fastify));

    invitationCollection = mongoDb().collection('invitations');

    organizationsRepo = organizationsRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });

    await mongoDb()
      .collection('credentialSchemas')
      .insertMany([
        { credentialType: 'EducationDegree' },
        { credentialType: 'PastEmploymentPosition' },
      ]);
  }, 10000);

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCreateStakesAccount.mockResolvedValue('foo');
    nock.cleanAll();
  }, 10000);

  afterAll(async () => {
    await mongoDb().collection('credentialSchemas').deleteMany({});
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  describe('Organization Service Modifications', () => {
    let orgProfile;

    beforeAll(async () => {
      const org = await newOrganization();
      orgProfile = omit(['id', 'createdAt', 'updatedAt'], org.profile);
    });

    describe('Organization Service Activation', () => {
      it('should activate inactive services', async () => {
        const service = [
          {
            id: '#credentialagent-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];
        const organization = await persistOrganization({
          service,
          activatedServiceIds: [],
        });
        await persistGroup({
          organization,
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: ['DLT_TRANSACTIONS'],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/activate-services`,
          payload: { serviceIds: map('id', service) },
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(200);

        expect(response.json).toEqual({
          profile: {
            ...orgProfile,
            id: did,
            website: organization.profile.website,
            verifiableCredentialJwt: expect.any(String),
            permittedVelocityServiceCategory: [ServiceCategories.NodeOperator],
          },
          activatedServiceIds: ['#credentialagent-1'],
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg.activatedServiceIds).toEqual(map('id', service));

        expect(mockSendEmail.mock.calls).toEqual([
          [sendServicesActivatedEmailMatcher()],
        ]);

        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
        expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
          address: organization.ids.ethereumAccount,
          scopesToRemove: [
            'transactions:write',
            'credential:identityissue',
            'credential:contactissue',
            'credential:revoke',
            'credential:inspect',
            'credential:issue',
          ],
          scopesToAdd: [],
        });
      });
      it('should activate inactive services and send emails to CAO only with correct serviceEndpoints', async () => {
        const caoOrganization = await persistOrganization({
          service: [
            {
              id: '#caoid',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://www.cao.com',
            },
          ],
        });

        await persistGroup({
          organization: caoOrganization,
          clientAdminIds: [nanoid()],
        });

        const service = [
          {
            id: '#credentialagent-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: `${caoOrganization.didDoc.id}#caoid`,
          },
          {
            id: '#credentialagent-2',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];
        const organization = await persistOrganization({
          service,
          activatedServiceIds: [],
        });
        await persistGroup({
          organization,
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: ['DLT_TRANSACTIONS'],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/activate-services`,
          payload: { serviceIds: map('id', service) },
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(200);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg.activatedServiceIds).toEqual(map('id', service));

        expect(mockSendEmail).toBeCalledTimes(2);
        expect(mockSendEmail.mock.calls).toEqual(
          expect.arrayContaining([
            [sendServicesActivatedEmailMatcher()],
            [
              sendServicesActivatedEmailToCAOsMatcher(
                caoOrganization,
                service[0]
              ),
            ],
          ])
        );
      });
      it('should activate inactive services and not fail on email reject', async () => {
        const caoOrganization = await persistOrganization({
          service: [
            {
              id: '#caoid',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://www.cao.com',
            },
          ],
        });

        await persistGroup({
          organization: caoOrganization,
          clientAdminIds: [nanoid()],
        });

        const service = [
          {
            id: '#credentialagent-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: `${caoOrganization.didDoc.id}#caoid`,
          },
          {
            id: '#credentialagent-2',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];
        const organization = await persistOrganization({
          service,
          activatedServiceIds: [],
        });
        await persistGroup({
          organization,
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: ['DLT_TRANSACTIONS'],
        });
        const did = organization.didDoc.id;

        mockSendEmail.mockRejectedValueOnce({ message: 'JustTest' });
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/activate-services`,
          payload: { serviceIds: map('id', service) },
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(200);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg.activatedServiceIds).toEqual(map('id', service));

        expect(mockSendError).toBeCalledTimes(1);
        expect(mockSendEmail.mock.calls).toEqual(
          expect.arrayContaining([
            [sendServicesActivatedEmailMatcher()],
            [
              sendServicesActivatedEmailToCAOsMatcher(
                caoOrganization,
                service[0]
              ),
            ],
          ])
        );
      });

      it('should 404 if the org doesnt exist', async () => {
        const service = [
          {
            id: '#credentialagent-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];

        await persistOrganization({
          service,
          activatedServiceIds: [],
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/did:test:doesnt-exist/activate-services`,
          payload: { serviceIds: ['#credentialagent-1'] },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('should 400 if trying to activate non-existent services', async () => {
        const service = [
          {
            id: '#credentialagent-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];

        const organization = await persistOrganization({
          service,
          activatedServiceIds: [],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/activate-services`,
          payload: { serviceIds: ['#fail-123'] },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'Organization service not found',
            statusCode: 400,
          })
        );

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg.activatedServiceIds).toEqual([]);
        expect(mockSendEmail.mock.calls).toEqual([]);
      });

      it('should 200, but no email, if trying to activate already existent services', async () => {
        const service = [
          {
            id: '#credentialagent-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];

        const organization = await persistOrganization({
          service,
        });
        await persistGroup({
          organization,
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: ['DLT_TRANSACTIONS'],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/activate-services`,
          payload: { serviceIds: map('id', service) },
        });
        expect(response.json).toEqual({});

        expect(response.statusCode).toEqual(200);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg.activatedServiceIds).toEqual(map('id', service));
        expect(mockSendEmail.mock.calls).toEqual([]);
      });

      it('should 200, and create client grants when activating operator services', async () => {
        const services = [
          {
            id: '#test-service-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
          {
            id: '#credentialagent-2',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];

        const organization = await persistOrganization({
          service: services,
          activatedServiceIds: [],
          authClients: [
            ...map((s) => {
              return buildTestAuthClient(s.id);
            }, services),
            buildTestAuthClient('unrelated-id'),
          ],
        });
        await persistGroup({
          organization,
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: ['DLT_TRANSACTIONS'],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/activate-services`,
          payload: { serviceIds: map('id', services) },
        });
        expect(response.json).toEqual({
          profile: {
            ...orgProfile,
            id: did,
            website: organization.profile.website,
            verifiableCredentialJwt: expect.any(String),
            permittedVelocityServiceCategory: [
              ServiceCategories.NodeOperator,
              ServiceCategories.CredentialAgentOperator,
            ],
          },
          activatedServiceIds: map('id', services),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        expect(response.statusCode).toEqual(200);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          _id: expect.any(ObjectId),
          profile: {
            ...orgProfile,
            website: organization.profile.website,
            permittedVelocityServiceCategory: [
              ServiceCategories.NodeOperator,
              ServiceCategories.CredentialAgentOperator,
            ],
          },
          authClients: [
            ...map(
              (service) => ({
                ...buildTestAuthClient(service.id),
                clientGrantIds: [expect.any(String)],
              }),
              services
            ),
            buildTestAuthClient('unrelated-id'),
          ],
          services: expectedServices(services),
          activatedServiceIds: map('id', services),
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          didDoc: expect.any(Object),
          verifiableCredentialJwt: expect.any(String),
          ids: expect.any(Object),
          normalizedProfileName: normalizeProfileName(orgProfile.name),
          didNotCustodied: false,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
        });

        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(2);
        expect(mockAuth0ClientGrantCreate).toHaveBeenNthCalledWith(1, {
          client_id: first(dbOrg.authClients).clientId,
          audience: fastify.config.blockchainApiAudience,
          scope: ['*:*'],
        });
        expect(mockAuth0ClientGrantCreate).toHaveBeenNthCalledWith(2, {
          client_id: dbOrg.authClients[1].clientId,
          audience: fastify.config.blockchainApiAudience,
          scope: ['eth:*'],
        });
      });

      it('should 200, and create client grants when activating operator services only if service has no grants', async () => {
        const services = [
          {
            id: '#credentialagent-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
          {
            id: '#credentialagent-2',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];

        const organization = await persistOrganization({
          service: services,
          activatedServiceIds: [],
          authClients: [
            buildTestAuthClient(services[0].id),
            {
              ...buildTestAuthClient(services[1].id),
              clientGrantIds: ['grant_1'],
            },
          ],
        });
        await persistGroup({
          organization,
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: ['DLT_TRANSACTIONS'],
        });

        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/activate-services`,
          payload: { serviceIds: map('id', services) },
        });
        expect(response.json).toEqual({
          profile: {
            ...orgProfile,
            id: did,
            website: organization.profile.website,
            verifiableCredentialJwt: expect.any(String),
            permittedVelocityServiceCategory: [ServiceCategories.NodeOperator],
          },
          activatedServiceIds: map('id', services),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        expect(response.statusCode).toEqual(200);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          _id: expect.any(ObjectId),
          profile: {
            ...orgProfile,
            website: organization.profile.website,
            permittedVelocityServiceCategory: [ServiceCategories.NodeOperator],
          },
          authClients: [
            ...map(
              (service) => ({
                ...buildTestAuthClient(service.id),
                clientGrantIds: [expect.any(String)],
              }),
              services
            ),
          ],
          services: expectedServices(services),
          activatedServiceIds: map('id', services),
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          didDoc: expect.any(Object),
          verifiableCredentialJwt: expect.any(String),
          ids: expect.any(Object),
          normalizedProfileName: normalizeProfileName(orgProfile.name),
          didNotCustodied: false,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
        });

        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(1);
        expect(mockAuth0ClientGrantCreate).toHaveBeenCalledWith({
          client_id: first(dbOrg.authClients).clientId,
          audience: fastify.config.blockchainApiAudience,
          scope: ['*:*'],
        });
      });

      it('should activate service when public key has sig property', async () => {
        const service = [
          {
            id: '#credentialagent-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];
        const organization = await persistOrganization({
          service,
          activatedServiceIds: [],
        });
        await persistGroup({
          organization,
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: {
            ...dltKey.publicKeyJwk,
            use: 'sig',
          },
          purposes: ['DLT_TRANSACTIONS'],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/activate-services`,
          payload: { serviceIds: map('id', service) },
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(200);

        expect(response.json).toEqual({
          profile: {
            ...orgProfile,
            id: did,
            website: organization.profile.website,
            verifiableCredentialJwt: expect.any(String),
            permittedVelocityServiceCategory: [ServiceCategories.NodeOperator],
          },
          activatedServiceIds: ['#credentialagent-1'],
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg.activatedServiceIds).toEqual(map('id', service));

        expect(mockSendEmail.mock.calls).toEqual([
          [sendServicesActivatedEmailMatcher()],
        ]);

        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
        expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
          address: organization.ids.ethereumAccount,
          scopesToRemove: [
            'transactions:write',
            'credential:identityissue',
            'credential:contactissue',
            'credential:revoke',
            'credential:inspect',
            'credential:issue',
          ],
          scopesToAdd: [],
        });
      });
    });

    describe('Organization Service Addition', () => {
      const setupOrganizationWithGroup = async () => {
        const organization = await persistOrganization({
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: ['DLT_TRANSACTIONS'],
        });
        await persistGroup({ organization });
        return organization;
      };

      beforeEach(async () => {
        nock.cleanAll();
      });

      it('Should return 400 when request is malformed', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload: {},
        });

        expect(response.statusCode).toEqual(400);
      });

      it('Should 400 when adding service with bad url protocol in serviceEndpoint ', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;
        const payload = {
          id: `${did}#credentialagent-1`,
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'http://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: { 'x-auto-activate': '1' },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'service_endpoint_invalid',
            message: 'serviceEndpoint is invalid format',
            statusCode: 400,
          })
        );
      });

      it('Should return 404 when organization not found', async () => {
        const organization = await newOrganization();
        const did = organization.didDoc.id;
        const service = {
          id: `${did}#service-1`,
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://foo.samplevendor.com',
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload: {
            ...service,
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should 400 if unknown credential type is on organization service', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;

        const payload = {
          id: `${did}#credentialagent-1`,
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['Boogoo'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
        });

        expect(response.statusCode).toEqual(400);
      });

      it('Should 400 if service ID is duplicate', async () => {
        const existingService = {
          id: '#credentialagent-1',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const organization = await persistOrganization({
          service: [existingService],
        });
        const did = organization.didDoc.id;
        const payload = {
          id: '#credentialagent-1',
          type: ServiceTypes.CareerIssuerType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
        });

        expect(response.json).toEqual(
          errorResponseMatcher({
            statusCode: 400,
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message:
              OrganizationRegistryErrorMessages.SERVICE_ID_ALREADY_EXISTS,
          })
        );
      });

      describe('Add Wallet Provider service Test Suite', () => {
        it('Should 400 when HolderAppProviderType is missing logoUrl property', async () => {
          const organization = await persistOrganization({
            service: [],
          });
          await persistGroup({ organization });
          const did = organization.didDoc.id;

          const payload = {
            id: `${did}#credentialagent-2`,
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            playStoreUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '0' },
          });
          expect(response.statusCode).toEqual(400);
          expect(response.json).toEqual(
            errorResponseMatcher({
              error: 'Bad Request',
              errorCode: 'missing_error_code',
              message:
                'VlcHolderAppProvider_v1 service type requires "logoUrl"',
              statusCode: 400,
            })
          );
        });

        it('Should 400 when HolderAppProviderType is missing playStoreUrl property', async () => {
          const organization = await persistOrganization({
            service: [],
          });
          await persistGroup({ organization });
          const did = organization.didDoc.id;

          const payload = {
            id: `${did}#credentialagent-2`,
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            logoUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '0' },
          });
          expect(response.statusCode).toEqual(400);
          expect(response.json).toEqual(
            errorResponseMatcher({
              error: 'Bad Request',
              errorCode: 'missing_error_code',
              message:
                'VlcHolderAppProvider_v1 service type requires "playStoreUrl"',
              statusCode: 400,
            })
          );
        });

        it('Should 400 when HolderAppProviderType is missing appleAppStoreUrl property', async () => {
          const organization = await persistOrganization({
            service: [],
          });
          await persistGroup({ organization });
          const did = organization.didDoc.id;

          const payload = {
            id: `${did}#credentialagent-2`,
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            playStoreUrl: 'http://example.com/play-store',
            logoUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '0' },
          });
          expect(response.statusCode).toEqual(400);
          expect(response.json).toEqual(
            errorResponseMatcher({
              error: 'Bad Request',
              errorCode: 'missing_error_code',
              message:
                'VlcHolderAppProvider_v1 service type requires "appleAppStoreUrl"',
              statusCode: 400,
            })
          );
        });

        it('Should 400 when HolderAppProviderType is missing appleAppId property', async () => {
          const organization = await persistOrganization({
            service: [],
          });
          await persistGroup({ organization });
          const did = organization.didDoc.id;

          const payload = {
            id: `${did}#credentialagent-2`,
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            logoUrl: 'http://example.com/play-store',
            playStoreUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            googlePlayId: 'com.example.app',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '0' },
          });
          expect(response.statusCode).toEqual(400);
          expect(response.json).toEqual(
            errorResponseMatcher({
              error: 'Bad Request',
              errorCode: 'missing_error_code',
              message:
                'VlcHolderAppProvider_v1 service type requires "appleAppId"',
              statusCode: 400,
            })
          );
        });

        it('Should 400 when HolderAppProviderType is missing googlePlayId property', async () => {
          const organization = await persistOrganization({
            service: [],
          });
          await persistGroup({ organization });
          const did = organization.didDoc.id;

          const payload = {
            id: `${did}#credentialagent-2`,
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            logoUrl: 'http://example.com/play-store',
            playStoreUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '0' },
          });
          expect(response.statusCode).toEqual(400);
          expect(response.json).toEqual(
            errorResponseMatcher({
              error: 'Bad Request',
              errorCode: 'missing_error_code',
              message:
                'VlcHolderAppProvider_v1 service type requires "googlePlayId"',
              statusCode: 400,
            })
          );
        });

        it('Should 400 when WebWalletProviderType is missing name property', async () => {
          const organization = await persistOrganization({
            service: [],
          });
          await persistGroup({ organization });
          const did = organization.didDoc.id;

          const payload = {
            id: `${did}#credentialagent-2`,
            type: ServiceTypes.WebWalletProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            logoUrl: 'http://example.com/play-store',
            playStoreUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '0' },
          });
          expect(response.statusCode).toEqual(400);
          expect(response.json).toEqual(
            errorResponseMatcher({
              error: 'Bad Request',
              errorCode: 'missing_error_code',
              message: 'VlcWebWalletProvider_v1 service type requires "name"',
              statusCode: 400,
            })
          );
        });

        it('Should 400 when HolderAppProviderType service is missing supportedExchangeProtocols property', async () => {
          const organization = await setupOrganizationWithGroup();
          const did = organization.didDoc.id;
          const payload = {
            id: `${did}#holder-1`,
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            logoUrl: 'http://example.com/1.png',
            playStoreUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
            name: 'fooAppWallet',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '0' },
          });

          expect(response.statusCode).toEqual(400);
          expect(response.json).toEqual(
            errorResponseMatcher({
              error: 'Bad Request',
              errorCode: 'missing_error_code',
              message:
                'VlcHolderAppProvider_v1 service type requires "supportedExchangeProtocols"',
              statusCode: 400,
            })
          );
        });

        it('Should add organization HolderAppProviderType service', async () => {
          const organization = await setupOrganizationWithGroup();
          const did = organization.didDoc.id;
          const payload = {
            id: `${did}#holder-1`,
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            logoUrl: 'http://example.com/1.png',
            playStoreUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
            name: 'fooAppWallet',
            supportedExchangeProtocols: ['OPENID4VC'],
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '0' },
          });

          expect(response.statusCode).toEqual(201);
          const expectedService = {
            ...payload,
            id: toRelativeServiceId(payload.id),
          };
          expect(response.json).toEqual({
            service: expectedService,
          });

          const dbOrg = await getOrganizationFromDb(did);
          expect(dbOrg).toMatchObject({
            ...mongoify(organization),
            didDoc: {
              ...organization.didDoc,
              service: map(pick(didDocServiceFields), [
                ...organization.didDoc.service,
                expectedService,
              ]),
            },
            profile: organization.profile,
            activatedServiceIds: [],
            signedProfileVcJwt: {
              credentialId: expect.any(String),
              signedCredential: expect.any(String),
            },
            authClients: [],
            services: [
              {
                appleAppId: 'com.example.app',
                appleAppStoreUrl: 'http://example.com/apple-app-store',
                googlePlayId: 'com.example.app',
                id: '#holder-1',
                logoUrl: 'http://example.com/1.png',
                playStoreUrl: 'http://example.com/play-store',
                name: 'fooAppWallet',
                serviceEndpoint: 'https://agent.samplevendor.com/acme',
                type: 'VlcHolderAppProvider_v1',
                supportedExchangeProtocols: ['OPENID4VC'],
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
              },
            ],
            verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          });
        });
      });

      it('Should return 201 when service already has credential type', async () => {
        const organization = await persistOrganization({
          service: [
            {
              id: '#credentialagent-1',
              type: ServiceTypes.CareerIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
              credentialTypes: ['EducationDegree'],
            },
          ],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: ['DLT_TRANSACTIONS'],
        });
        await persistGroup({ organization });

        const did = organization.didDoc.id;

        const payload = {
          id: `${did}#credentialagent-2`,
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          service: expectedService,
        });
        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toMatchObject({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              expectedService,
            ]),
          },
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [ServiceCategories.Issuer],
          },
          services: expectedServices([
            ...organization.services,
            expectedService,
          ]),
          activatedServiceIds: [
            '#credentialagent-1',
            toRelativeServiceId(payload.id),
          ],
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          authClients: [],
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
        });
        // consent entity checks
        expect(await getConsentsFromDb(dbOrg)).toEqual(
          expectedConsents(
            organization,
            [expectedService],
            testRegistrarSuperUser
          )
        );
      });

      it('Should add organization service - type Issuer and no invitation', async () => {
        const organization = await setupOrganizationWithGroup();
        const did = organization.didDoc.id;
        const payload = {
          id: `${did}#credentialagent-1`,
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toMatchObject({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              expectedService,
            ]),
          },
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [ServiceCategories.Issuer],
          },
          services: [expectedService],
          activatedServiceIds: [toRelativeServiceId(payload.id)],
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          authClients: [],
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
        });

        // consent entity checks
        expect(await getConsentsFromDb(dbOrg)).toEqual(
          expectedConsents(
            organization,
            [expectedService],
            testWriteOrganizationsUser
          )
        );

        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(0);
        expect(mockSendEmail.mock.calls).toEqual([
          [sendServicesActivatedEmailMatcher()],
        ]);

        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
        expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
          address: organization.ids.ethereumAccount,
          scopesToRemove: [
            'credential:identityissue',
            'credential:contactissue',
            'credential:inspect',
          ],
          scopesToAdd: [
            'transactions:write',
            'credential:revoke',
            'credential:issue',
          ],
        });
      });

      describe('Service type on-chain permissions tests', () => {
        it('adding organization service with IdentityIssuer type should not give permissions', async () => {
          const organization = await setupOrganizationWithGroup();
          const did = organization.didDoc.id;
          const payload = {
            id: `${did}#credentialagent-1`,
            type: ServiceTypes.IdentityIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '1' },
          });

          expect(response.statusCode).toEqual(201);
          const expectedService = {
            ...payload,
            id: toRelativeServiceId(payload.id),
          };
          expect(response.json).toEqual({
            service: expectedService,
          });

          expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
          expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
            address: organization.ids.ethereumAccount,
            scopesToRemove: [
              'transactions:write',
              'credential:identityissue',
              'credential:contactissue',
              'credential:revoke',
              'credential:inspect',
              'credential:issue',
            ],
            scopesToAdd: [],
          });
        });

        it('adding organization service with IdDocumentIssuer type should give correct permissions', async () => {
          const organization = await setupOrganizationWithGroup();
          const did = organization.didDoc.id;
          const payload = {
            id: `${did}#credentialagent-1`,
            type: ServiceTypes.IdDocumentIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '1' },
          });

          expect(response.statusCode).toEqual(201);

          expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
          expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
            address: organization.ids.ethereumAccount,
            scopesToRemove: [
              'credential:contactissue',
              'credential:inspect',
              'credential:issue',
            ],
            scopesToAdd: [
              'transactions:write',
              'credential:revoke',
              'credential:identityissue',
            ],
          });
        });

        it('adding organization service with NotaryIdDocumentIssuer type should give correct permissions', async () => {
          const organization = await setupOrganizationWithGroup();
          const did = organization.didDoc.id;
          const payload = {
            id: `${did}#credentialagent-1`,
            type: ServiceTypes.NotaryIdDocumentIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '1' },
          });

          expect(response.statusCode).toEqual(201);

          expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
          expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
            address: organization.ids.ethereumAccount,
            scopesToRemove: [
              'credential:contactissue',
              'credential:inspect',
              'credential:issue',
            ],
            scopesToAdd: [
              'transactions:write',
              'credential:revoke',
              'credential:identityissue',
            ],
          });
        });

        it('adding organization service with ContactIssuer type should give correct permissions', async () => {
          const organization = await setupOrganizationWithGroup();
          const did = organization.didDoc.id;
          const payload = {
            id: `${did}#credentialagent-1`,
            type: ServiceTypes.ContactIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '1' },
          });

          expect(response.statusCode).toEqual(201);

          expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
          expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
            address: organization.ids.ethereumAccount,
            scopesToRemove: [
              'credential:identityissue',
              'credential:inspect',
              'credential:issue',
            ],
            scopesToAdd: [
              'transactions:write',
              'credential:revoke',
              'credential:contactissue',
            ],
          });
        });

        it('adding organization service with NotaryContactIssuer type should give correct permissions', async () => {
          const organization = await setupOrganizationWithGroup();
          const did = organization.didDoc.id;
          const payload = {
            id: `${did}#credentialagent-1`,
            type: ServiceTypes.NotaryContactIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '1' },
          });

          expect(response.statusCode).toEqual(201);

          expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
          expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
            address: organization.ids.ethereumAccount,
            scopesToRemove: [
              'credential:identityissue',
              'credential:inspect',
              'credential:issue',
            ],
            scopesToAdd: [
              'transactions:write',
              'credential:revoke',
              'credential:contactissue',
            ],
          });
        });

        it('adding organization service with NotaryContactIssuer and then IdentityIssuer type should give correct permissions', async () => {
          const organization = await setupOrganizationWithGroup();
          const did = organization.didDoc.id;
          const payload = {
            id: `${did}#credentialagent-1`,
            type: ServiceTypes.NotaryContactIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '1' },
          });

          expect(response.statusCode).toEqual(201);

          const payload2 = {
            id: `${did}#identityisuer-1`,
            type: ServiceTypes.IdentityIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          };

          const response2 = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload: payload2,
            headers: { 'x-auto-activate': '1' },
          });

          expect(response2.statusCode).toEqual(201);

          expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(2);
          expect(mockUpdateAddressScopes).toHaveBeenNthCalledWith(1, {
            address: organization.ids.ethereumAccount,
            scopesToRemove: [
              'credential:identityissue',
              'credential:inspect',
              'credential:issue',
            ],
            scopesToAdd: [
              'transactions:write',
              'credential:revoke',
              'credential:contactissue',
            ],
          });
          expect(mockUpdateAddressScopes).toHaveBeenNthCalledWith(2, {
            address: organization.ids.ethereumAccount,
            scopesToRemove: [
              'credential:identityissue',
              'credential:inspect',
              'credential:issue',
            ],
            scopesToAdd: [
              'transactions:write',
              'credential:revoke',
              'credential:contactissue',
            ],
          });
        });

        it('adding organization service with NotaryContactIssuer and then NotaryIdDocumentIssuer type should give correct permissions', async () => {
          const organization = await setupOrganizationWithGroup();
          const did = organization.didDoc.id;
          const payload = {
            id: `${did}#credentialagent-1`,
            type: ServiceTypes.NotaryContactIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: { 'x-auto-activate': '1' },
          });

          expect(response.statusCode).toEqual(201);

          const payload2 = {
            id: `${did}#notary-id-document-issuer-1`,
            type: ServiceTypes.NotaryIdDocumentIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          };

          const response2 = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload: payload2,
            headers: { 'x-auto-activate': '1' },
          });

          expect(response2.statusCode).toEqual(201);

          expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(2);
          expect(mockUpdateAddressScopes).toHaveBeenNthCalledWith(1, {
            address: organization.ids.ethereumAccount,
            scopesToRemove: [
              'credential:identityissue',
              'credential:inspect',
              'credential:issue',
            ],
            scopesToAdd: [
              'transactions:write',
              'credential:revoke',
              'credential:contactissue',
            ],
          });
          expect(mockUpdateAddressScopes).toHaveBeenNthCalledWith(2, {
            address: organization.ids.ethereumAccount,
            scopesToRemove: ['credential:inspect', 'credential:issue'],
            scopesToAdd: [
              'transactions:write',
              'credential:revoke',
              'credential:contactissue',
              'credential:identityissue',
            ],
          });
        });
      });

      it('Adding a second service IdDocumentIssuerType should be allowed', async () => {
        const credentialType1 = 'DriversLicenseV1.0';
        const service = {
          id: '#test-service-1',
          type: ServiceTypes.IdDocumentIssuerType,
          serviceEndpoint: 'https://idverifagent.samplevendor.com/acme',
          credentialTypes: [credentialType1],
        };
        const organization = await persistOrganization({
          service: [service],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        await persistRegistrarConsent({
          organizationId: new ObjectId(organization._id),
          serviceId: organization.services[0].id,
          type: ConsentTypes.IssuerInspector,
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        const did = organization.didDoc.id;
        const payload = {
          id: '#test-service-2',
          type: ServiceTypes.IdDocumentIssuerType,
          credentialTypes: ['PhoneV1.0'],
          serviceEndpoint: 'https://verifagent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
        });

        expect(response.statusCode).toEqual(201);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toMatchObject({
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              payload,
            ]),
          },
          services: [
            {
              ...service,
              createdAt: new Date(organization.services[0].createdAt),
              updatedAt: new Date(organization.services[0].updatedAt),
            },
            {
              ...payload,
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            },
          ],
        });
        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(0);

        // consent entity checks
        expect(await getConsentsFromDb(dbOrg)).toEqual(
          expectedConsents(organization, dbOrg.services, testRegistrarSuperUser)
        );
      });

      it('Adding a second service CareerIssuerType should be allowed', async () => {
        const credentialType1 = 'DriversLicenseV1.0';
        const service = {
          id: '#test-service-1',
          type: ServiceTypes.CareerIssuerType,
          serviceEndpoint: 'https://idverifagent.samplevendor.com/acme',
          credentialTypes: [credentialType1],
        };
        const organization = await persistOrganization({
          service: [service],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        const did = organization.didDoc.id;
        const payload = {
          id: '#test-service-2',
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['PastEmploymentPosition'],
          serviceEndpoint: 'https://verifagent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
        });

        expect(response.statusCode).toEqual(201);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toMatchObject({
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              payload,
            ]),
          },
          services: [
            {
              ...service,
              createdAt: new Date(organization.services[0].createdAt),
              updatedAt: new Date(organization.services[0].updatedAt),
            },
            {
              ...payload,
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            },
          ],
        });
        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(0);
      });

      it('Adding a second service InspectionType should be allowed', async () => {
        const credentialType1 = 'DriversLicenseV1.0';
        const service = {
          id: '#test-service-1',
          type: ServiceTypes.InspectionType,
          serviceEndpoint: 'https://idverifagent.samplevendor.com/acme',
          credentialTypes: [credentialType1],
        };
        const organization = await persistOrganization({
          service: [service],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        const did = organization.didDoc.id;
        const payload = {
          id: '#test-service-2',
          type: ServiceTypes.InspectionType,
          credentialTypes: ['PhoneV1.0'],
          serviceEndpoint: 'https://verifagent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
        });

        expect(response.statusCode).toEqual(201);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toMatchObject({
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              payload,
            ]),
          },
          services: [
            {
              ...service,
              createdAt: new Date(organization.services[0].createdAt),
              updatedAt: new Date(organization.services[0].updatedAt),
            },
            {
              ...payload,
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            },
          ],
        });

        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(0);
      });

      it('Adding a second service NotaryIssuerType should be allowed', async () => {
        const credentialType1 = 'DriversLicenseV1.0';
        const service = {
          id: '#test-service-1',
          type: ServiceTypes.NotaryIssuerType,
          serviceEndpoint: 'https://idverifagent.samplevendor.com/acme',
          credentialTypes: [credentialType1],
        };
        const organization = await persistOrganization({
          service: [service],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        const did = organization.didDoc.id;
        const payload = {
          id: '#test-service-2',
          type: ServiceTypes.NotaryIssuerType,
          credentialTypes: ['PhoneV1.0'],
          serviceEndpoint: 'https://verifagent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
        });

        expect(response.statusCode).toEqual(201);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toMatchObject({
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              payload,
            ]),
          },
          services: [
            {
              ...service,
              createdAt: new Date(organization.services[0].createdAt),
              updatedAt: new Date(organization.services[0].updatedAt),
            },
            {
              ...payload,
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            },
          ],
        });
        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(0);
      });

      it("Adding a second service type should result in updated 'permittedVelocityServiceCategory'", async () => {
        const organization = await persistOrganization({
          service: [
            {
              id: '#credential-agent-operator-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        const did = organization.didDoc.id;
        const payload = {
          id: `${did}#credentialagent-1`,
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: { 'x-auto-activate': '1' },
        });

        expect(response.statusCode).toEqual(201);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toMatchObject({
          profile: {
            permittedVelocityServiceCategory: expect.arrayContaining([
              'CredentialAgentOperator',
              'Issuer',
            ]),
          },
        });
      });

      it('Adding a second service type should not remove credentialTypes from first service', async () => {
        const credentialType1 = 'DriversLicenseV1.0';
        const service = {
          id: '#test-service-1',
          type: ServiceTypes.IdDocumentIssuerType,
          serviceEndpoint: 'https://idverifagent.samplevendor.com/acme',
          credentialTypes: [credentialType1],
        };
        const organization = await persistOrganization({
          service: [service],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        const did = organization.didDoc.id;
        const payload = {
          id: '#test-service-2',
          type: ServiceTypes.InspectionType,
          credentialTypes: ['PhoneV1.0'],
          serviceEndpoint: 'https://verifagent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
        });

        expect(response.statusCode).toEqual(201);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toMatchObject({
          didDoc: {
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              payload,
            ]),
          },
          services: [
            {
              ...service,
              createdAt: new Date(organization.services[0].createdAt),
              updatedAt: new Date(organization.services[0].updatedAt),
            },
            {
              ...payload,
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            },
          ],
        });
      });

      it('Should add organization service - type CredentialAgentOperator', async () => {
        const organization = await setupOrganizationWithGroup();
        const did = organization.didDoc.id;
        const payload = {
          id: '#credentialagent-1',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        setServicePingNock(payload.serviceEndpoint);
        const monitorNockScope = setMonitorEventsNock();

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);

        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
          authClient: {
            clientId: expect.any(String),
            clientType: 'agent',
            serviceId: payload.id,
            clientSecret: expect.any(String),
            type: 'auth0',
          },
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [payload]),
          },
          services: expectedServices([payload]),
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [
              ServiceCategories.CredentialAgentOperator,
            ],
          },
          activatedServiceIds: [toRelativeServiceId(payload.id)],
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: [
            {
              ...omit(['clientSecret'], response.json.authClient),
              clientGrantIds: [expect.any(String)],
            },
          ],
        });

        expect(mockAuth0ClientGrantCreate).toHaveBeenCalledTimes(1);
        expect(mockAuth0ClientGrantCreate).toHaveBeenCalledWith({
          client_id: response.json.authClient.clientId,
          audience: 'https://velocitynetwork.node',
          scope: ['eth:*'],
        });

        expect(mockAuth0ClientCreate.mock.calls).toEqual([
          [
            {
              app_type: 'non_interactive',
              client_metadata: {
                did,
                service_id: '#credentialagent-1',
              },
              custom_login_page_on: false,
              description:
                'Credential Agent for "Test Organization" permitted to issue and verify credentials',
              grant_types: ['client_credentials'],
              is_first_party: true,
              is_token_endpoint_ip_header_trusted: true,
              jwt_configuration: {
                alg: 'RS256',
                lifetime_in_seconds: 36000,
                secret_encoded: true,
              },
              logo_uri: 'http://www.organization.com/logo.png',
              name: `test-organization-agent-${did}#credentialagent-1`,
              oidc_conformant: true,
              token_endpoint_auth_method: 'client_secret_post',
            },
          ],
        ]);
        expect(mockSendEmail.mock.calls).toEqual([
          [sendServicesActivatedEmailMatcher()],
        ]);

        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);
      });

      it('Should add organization service if auth0 client create fail', async () => {
        mockAuth0ClientCreate.mockRejectedValueOnce(new Error());
        const organization = await setupOrganizationWithGroup();
        const did = organization.didDoc.id;
        const payload = {
          id: '#credentialagent-1',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        setServicePingNock(payload.serviceEndpoint);
        const monitorNockScope = setMonitorEventsNock();

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);

        expect(response.json).toEqual({
          service: payload,
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              payload,
            ]),
          },
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [
              ServiceCategories.CredentialAgentOperator,
            ],
          },
          services: expectedServices([payload]),
          activatedServiceIds: [toRelativeServiceId(payload.id)],
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: [],
        });

        expect(mockAuth0ClientCreate).toHaveBeenCalledTimes(1);
        expect(mockAuth0ClientGrantCreate).toHaveBeenCalledTimes(0);
        expect(mockSendError).toHaveBeenCalledTimes(1);

        expect(mockSendEmail.mock.calls).toEqual([
          [sendServicesActivatedEmailMatcher()],
        ]);

        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);
      });

      it('Should add organization service with full serviceId - type CredentialAgentOperator', async () => {
        const organization = await setupOrganizationWithGroup();
        const did = organization.didDoc.id;
        const payload = {
          id: `${did}#credentialagent-1`,
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        setServicePingNock(payload.serviceEndpoint);
        const monitorNockScope = setMonitorEventsNock();

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);

        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
          authClient: {
            clientId: expect.any(String),
            clientType: 'agent',
            serviceId: '#credentialagent-1',
            clientSecret: expect.any(String),
            type: 'auth0',
          },
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              expectedService,
            ]),
          },
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [
              ServiceCategories.CredentialAgentOperator,
            ],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          services: expectedServices([payload]),
          activatedServiceIds: ['#credentialagent-1'],
          authClients: [
            {
              ...omit(['clientSecret'], response.json.authClient),
              clientGrantIds: [expect.any(String)],
            },
          ],
        });

        expect(mockAuth0ClientGrantCreate).toHaveBeenCalledTimes(1);
        expect(mockAuth0ClientGrantCreate).toHaveBeenCalledWith({
          client_id: response.json.authClient.clientId,
          audience: 'https://velocitynetwork.node',
          scope: ['eth:*'],
        });

        expect(mockAuth0ClientCreate.mock.calls).toEqual([
          [
            {
              app_type: 'non_interactive',
              client_metadata: {
                did,
                service_id: '#credentialagent-1',
              },
              custom_login_page_on: false,
              description:
                'Credential Agent for "Test Organization" permitted to issue and verify credentials',
              grant_types: ['client_credentials'],
              is_first_party: true,
              is_token_endpoint_ip_header_trusted: true,
              jwt_configuration: {
                alg: 'RS256',
                lifetime_in_seconds: 36000,
                secret_encoded: true,
              },
              logo_uri: 'http://www.organization.com/logo.png',
              name: `test-organization-agent-${did}#credentialagent-1`,
              oidc_conformant: true,
              token_endpoint_auth_method: 'client_secret_post',
            },
          ],
        ]);
        expect(mockSendEmail.mock.calls).toEqual([
          [sendServicesActivatedEmailMatcher()],
        ]);
        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);
      });

      it('Should add organization service with adminEmail - type NotaryIssuer', async () => {
        const organization = await setupOrganizationWithGroup();
        const did = organization.didDoc.id;
        const payload = {
          id: `${did}#credentialagent-1`,
          type: ServiceTypes.NotaryIssuerType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);

        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
            service: [
              ...organization.didDoc.service,
              pick(didDocServiceFields, expectedService),
            ],
          },
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [ServiceCategories.NotaryIssuer],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: [],
          activatedServiceIds: [expectedService.id],
          services: expectedServices([expectedService]),
        });
        expect(mockSendEmail.mock.calls).toEqual([
          [sendServicesActivatedEmailMatcher()],
        ]);
      }, 30000);

      it('Should add organization service without automatic activation', async () => {
        const organization = await setupOrganizationWithGroup();
        const did = organization.didDoc.id;
        const payload = {
          id: `${did}#credentialagent-1`,
          type: ServiceTypes.NotaryIssuerType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: {
            'x-auto-activate': 0,
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);

        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              expectedService,
            ]),
          },
          profile: organization.profile,
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: expect.any(String),
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: [],
          activatedServiceIds: [],
          services: expectedServices([payload]),
        });

        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(0);
        expect(mockSendEmail.mock.calls).toEqual([
          [expectedServiceActivationRequiredEmail],
        ]);
      }, 20000);

      it('Should add service and send "emailToSupportForServicesAddedAndNeedActivation" email', async () => {
        mockAuth0GetUsers.mockResolvedValueOnce([]);
        const organization = await setupOrganizationWithGroup();
        const did = organization.didDoc.id;
        const payload = {
          id: `${did}#credentialagent-1`,
          type: ServiceTypes.NotaryIssuerType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: {
            'x-auto-activate': 0,
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });
        await wait(2000);
        expect(response.statusCode).toEqual(201);

        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
        });

        expect(mockSendEmail.mock.calls).toEqual([
          [expectedServiceActivationRequiredEmail],
        ]);
      });

      it('Should add organization service - type HolderAppProvider', async () => {
        const organization = await setupOrganizationWithGroup();
        const did = organization.didDoc.id;
        const payload = {
          id: `${did}#credentialagent-1`,
          type: ServiceTypes.HolderAppProviderType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
          logoUrl: 'http://example.com/1.png',
          name: 'fooWallet',
          playStoreUrl: 'http://example.com/play-store',
          appleAppStoreUrl: 'http://example.com/apple-app-store',
          appleAppId: 'com.example.app',
          googlePlayId: 'com.example.app',
          supportedExchangeProtocols: ['VN_API'],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);

        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
            service: [
              ...organization.didDoc.service,
              pick(didDocServiceFields, expectedService),
            ],
          },
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [
              ServiceCategories.HolderAppProvider,
            ],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: [],
          activatedServiceIds: [expectedService.id],
          services: expectedServices([payload]),
        });
        expect(mockSendEmail.mock.calls).toEqual([
          [sendServicesActivatedEmailMatcher()],
        ]);
      });

      it('Should add organization service - type NodeOperator', async () => {
        const organization = await setupOrganizationWithGroup();
        const did = organization.didDoc.id;
        const payload = {
          id: `${did}#credentialagent-1`,
          type: ServiceTypes.NodeOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const monitorNockScope = setMonitorEventsNock();

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);

        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
          authClient: expect.any(Object),
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
            service: [
              ...organization.didDoc.service,
              pick(didDocServiceFields, expectedService),
            ],
          },
          services: expectedServices([expectedService]),
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [ServiceCategories.NodeOperator],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: [expect.any(Object)],
          ids: {
            ...mongoify(organization).ids,
            stakesAccountId: 'foo',
          },
          activatedServiceIds: [expectedService.id],
        });
        expect(mockSendEmail.mock.calls).toEqual([
          [sendServicesActivatedEmailMatcher()],
        ]);

        expect(mockCreateStakesAccount).toHaveBeenLastCalledWith(
          organization.ids.fineractClientId,
          dbOrg.didDoc.id,
          expect.any(Object)
        );
        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(1);
        expect(mockAuth0ClientGrantCreate).toHaveBeenCalledWith({
          client_id: response.json.authClient.clientId,
          audience: 'https://velocitynetwork.node',
          scope: ['*:*'],
        });
        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);
      });
      it('Should add second organization service with type NodeOperator', async () => {
        const organization = await persistOrganization({
          service: [
            {
              id: '#credentialagent-1',
              type: ServiceTypes.NodeOperatorType,
              serviceEndpoint: 'https://test.member.com/acme',
            },
          ],
          authClients: [
            {
              type: 'auth0',
              clientType: 'clientType',
              serviceId: '#credentialagent-1',
              clientId: 'cl_1',
              clientGrantIds: ['grant_1'],
            },
          ],
          activatedServiceIds: ['#credentialagent-1'],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        await persistGroup({ organization });
        const did = organization.didDoc.id;
        const payload = {
          id: '#credentialagent-2',
          type: ServiceTypes.NodeOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const monitorNockScope = setMonitorEventsNock();

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);

        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
          authClient: expect.any(Object),
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              expectedService,
            ]),
          },
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [ServiceCategories.NodeOperator],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: [expect.any(Object), expect.any(Object)],
          ids: {
            ...mongoify(organization).ids,
            stakesAccountId: 'foo',
          },
          services: expectedServices([
            ...organization.didDoc.service,
            expectedService,
          ]),
          activatedServiceIds: ['#credentialagent-1', expectedService.id],
        });
        expect(mockSendEmail.mock.calls).toEqual([
          [sendServicesActivatedEmailMatcher()],
        ]);

        expect(mockCreateStakesAccount).toHaveBeenLastCalledWith(
          organization.ids.fineractClientId,
          dbOrg.didDoc.id,
          expect.any(Object)
        );
        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(1);
        expect(mockAuth0ClientGrantCreate).toHaveBeenCalledWith({
          client_id: response.json.authClient.clientId,
          audience: 'https://velocitynetwork.node',
          scope: ['*:*'],
        });
        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);
      });
      it('Should not add stakes account if already a node operator', async () => {
        const didDocumentService = {
          id: '#test-service-1',
          type: ServiceTypes.NodeOperatorType,
          serviceEndpoint: 'https://test.member.com/acme',
        };
        const organization = await persistOrganization({
          service: [didDocumentService],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        const did = organization.didDoc.id;
        const payload = {
          id: `${did}#credentialagent-1`,
          type: ServiceTypes.InspectionType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: { 'x-auto-activate': '1' },
        });

        expect(response.statusCode).toEqual(201);

        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              expectedService,
            ]),
          },
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [
              ServiceCategories.NodeOperator,
              ServiceCategories.Inspector,
            ],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          authClients: [],
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          services: expectedServices([
            ...organization.didDoc.service,
            expectedService,
          ]),
          activatedServiceIds: expect.arrayContaining([expectedService.id]),
        });

        expect(mockCreateStakesAccount).not.toHaveBeenCalled();
      });

      it('Should add organization service and not add stakes account if account already exists', async () => {
        const didDocumentService = {
          id: '#test-service-1',
          type: ServiceTypes.NodeOperatorType,
          serviceEndpoint: 'https://test.member.com/acme',
        };
        const organization = await persistOrganization({
          _mergeIds: {
            stakesAccountId: '15',
          },
          service: [didDocumentService],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });

        const did = organization.didDoc.id;
        const payload = {
          id: `${did}#credentialagent-1`,
          type: ServiceTypes.NodeOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: { 'x-auto-activate': '1' },
        });

        expect(response.statusCode).toEqual(201);

        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
          authClient: expect.any(Object),
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
            service: map(pick(didDocServiceFields), [
              ...organization.didDoc.service,
              expectedService,
            ]),
          },
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [ServiceCategories.NodeOperator],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          authClients: [expect.any(Object)],
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          services: expectedServices([
            ...organization.didDoc.service,
            expectedService,
          ]),
          activatedServiceIds: expect.arrayContaining([expectedService.id]),
        });
        expect(mockCreateStakesAccount).not.toHaveBeenCalled();
      });

      it('Should not call client grant if trying call with wrong type', async () => {
        const payload = {
          id: '#credentialagent-1',
          type: ServiceTypes.IdDocumentIssuerType,
          serviceEndpoint: 'https://test.samplevendor.com/acme',
        };
        const organization = await persistOrganization({
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        await persistGroup({ organization });
        const did = organization.didDoc.id;
        setServicePingNock(payload.serviceEndpoint);

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: { 'x-auto-activate': '1' },
        });

        expect(response.statusCode).toEqual(201);

        expect(mockAuth0ClientGrantCreate).toHaveBeenCalledTimes(0);
      });
      describe('Organization Service Addition with invitations Test Suite', () => {
        it('Should add service and ignore missing invitationCode', async () => {
          const organization = await setupOrganizationWithGroup();
          const did = organization.didDoc.id;
          const payload = {
            id: `${did}#credentialagent-1`,
            type: ServiceTypes.CareerIssuerType,
            credentialTypes: ['EducationDegree'],
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: {
              'x-auto-activate': '1',
              'x-override-oauth-user': JSON.stringify(
                testWriteOrganizationsUser
              ),
            },
          });

          expect(response.statusCode).toEqual(201);
        });
        it('Should add service and ignore expired invitation', async () => {
          const invitationCode = '1234567812345678';
          const invitation = await persistInvitation({
            invitationCode,
            expiresAt: subDays(1, new Date()),
          });
          const organization = await setupOrganizationWithGroup();
          const did = organization.didDoc.id;
          const payload = {
            id: `${did}#credentialagent-1`,
            type: ServiceTypes.CareerIssuerType,
            credentialTypes: ['EducationDegree'],
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            invitationCode: '1234567812345678',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: {
              'x-auto-activate': '1',
              'x-override-oauth-user': JSON.stringify(
                testWriteOrganizationsUser
              ),
            },
          });

          expect(response.statusCode).toEqual(201);

          const invitationFromDb = await invitationCollection.findOne({
            invitationCode,
          });
          expect(invitationFromDb).toEqual(
            mongoify({
              _id: invitation._id,
              code: '1234567812345678',
              expiresAt: expect.any(Date),
              invitationCode,
              inviteeEmail: 'foo@example.com',
              createdBy: 'sub-123',
              invitationUrl: 'https://someurl.com',
              updatedAt: expect.any(Date),
              createdAt: expect.any(Date),
            })
          );
        });
        it('Should add service and accept invitation without sending email if inviter service with cao type not exist', async () => {
          const inviterOrganization = await persistOrganization({
            service: [
              {
                id: '#abc1',
                type: ServiceTypes.CareerIssuerType,
                serviceEndpoint: 'https://www.123.com',
              },
            ],
          });
          await persistGroup({
            groupId: inviterOrganization.didDoc.id,
            organization: inviterOrganization,
            clientAdminIds: [nanoid()],
          });
          const invitationCode = '1234567812345678';
          const invitation = await persistInvitation({
            invitationCode,
            inviterOrganization,
          });
          const organization = await setupOrganizationWithGroup();
          const did = organization.didDoc.id;
          const payload = {
            id: '#credentialagent-1',
            type: ServiceTypes.CareerIssuerType,
            credentialTypes: ['EducationDegree'],
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            invitationCode: '1234567812345678',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: {
              'x-auto-activate': '1',
              'x-override-oauth-user': JSON.stringify(
                testWriteOrganizationsUser
              ),
            },
          });

          expect(response.statusCode).toEqual(201);
          const invitationFromDb = await invitationCollection.findOne({
            invitationCode,
          });
          expect(invitationFromDb).toEqual(
            mongoify({
              _id: invitation._id,
              acceptedAt: expect.any(Date),
              acceptedBy: expect.stringMatching(AUTH0_USER_ID_FORMAT),
              code: '1234567812345678',
              expiresAt: expect.any(Date),
              invitationCode,
              inviterDid: inviterOrganization.didDoc.id,
              inviteeEmail: 'foo@example.com',
              createdBy: 'sub-123',
              invitationUrl: 'https://someurl.com',
              updatedAt: expect.any(Date),
              createdAt: expect.any(Date),
            })
          );

          const organizationFromDb = await organizationsRepo.findById(
            organization._id
          );
          expect(organizationFromDb).toEqual({
            ...mongoify(organization),
            services: expectedServices([payload], { invitation }),
            activatedServiceIds: ['#credentialagent-1'],
            didDoc: {
              ...organization.didDoc,
              service: [pick(didDocServiceFields, payload)],
            },
            profile: {
              ...organization.profile,
              permittedVelocityServiceCategory: ['Issuer'],
            },
            verifiableCredentialJwt: expect.any(String),
            updatedAt: expect.any(Date),
          });
          expect(mockSendEmail).toBeCalledTimes(1);
        });
        it('Should add service and accept invitation', async () => {
          const inviterOrganization = await persistOrganization({
            service: [
              {
                id: '#caoid',
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: 'https://www.cao.com',
              },
            ],
          });
          await persistGroup({
            groupId: inviterOrganization.didDoc.id,
            organization: inviterOrganization,
            clientAdminIds: [nanoid()],
          });
          const invitationCode = '1234567812345678';
          const invitation = await persistInvitation({
            invitationCode,
            inviterOrganization,
          });
          const organization = await setupOrganizationWithGroup();
          const dltKey = extractVerificationMethod(
            organization.didDoc,
            '#eth-account-key-1'
          );
          await persistOrganizationKey({
            organization,
            id: dltKey.id,
            publicKey: dltKey.publicKeyJwk,
            purposes: ['DLT_TRANSACTIONS'],
          });
          const did = organization.didDoc.id;
          const payload = {
            id: '#credentialagent-1',
            type: ServiceTypes.CareerIssuerType,
            credentialTypes: ['EducationDegree'],
            serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            invitationCode: '1234567812345678',
          };
          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: {
              'x-auto-activate': '1',
              'x-override-oauth-user': JSON.stringify(
                testWriteOrganizationsUser
              ),
            },
          });

          expect(response.statusCode).toEqual(201);
          const invitationFromDb = await invitationCollection.findOne({
            invitationCode,
          });
          expect(invitationFromDb).toEqual(
            mongoify({
              _id: invitation._id,
              acceptedAt: expect.any(Date),
              acceptedBy: expect.stringMatching(AUTH0_USER_ID_FORMAT),
              code: '1234567812345678',
              expiresAt: expect.any(Date),
              invitationCode,
              inviterDid: inviterOrganization.didDoc.id,
              inviteeEmail: 'foo@example.com',
              createdBy: 'sub-123',
              invitationUrl: 'https://someurl.com',
              updatedAt: expect.any(Date),
              createdAt: expect.any(Date),
            })
          );

          const organizationFromDb = await organizationsRepo.findById(
            organization._id
          );
          expect(organizationFromDb).toEqual({
            ...mongoify(organization),
            services: expectedServices([payload], { invitation }),
            activatedServiceIds: ['#credentialagent-1'],
            didDoc: {
              ...organization.didDoc,
              service: [pick(didDocServiceFields, payload)],
            },
            profile: {
              ...organization.profile,
              permittedVelocityServiceCategory: ['Issuer'],
            },
            verifiableCredentialJwt: expect.any(String),
            updatedAt: expect.any(Date),
          });

          expect(mockSendEmail).toBeCalledTimes(3);
          expect(mockSendEmail.mock.calls).toEqual(
            expect.arrayContaining([
              [sendServicesActivatedEmailToCAOsMatcher(inviterOrganization)],
              [expectedInvitationAcceptanceEmail],
            ])
          );
        });

        it('Should send only "ACTIVATION REQUIRED" email if clientAdminIds is empty in cao group', async () => {
          const inviterOrganization = await persistOrganization({
            service: [
              {
                id: '#caoid',
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: 'https://www.cao.com',
              },
            ],
          });
          await persistGroup({
            groupId: inviterOrganization.didDoc.id,
            organization: inviterOrganization,
          });
          const invitationCode = '1234567812345678';
          await persistInvitation({
            invitationCode,
            inviterOrganization,
          });
          const organization = await persistOrganization({
            keys: [
              buildOrgFactoryKey({
                id: '#eth-account-key-1',
                purposes: [
                  KeyPurposes.DLT_TRANSACTIONS,
                  KeyPurposes.ISSUING_METADATA,
                  KeyPurposes.EXCHANGES,
                ],
              }),
            ],
          });
          const dltKey = extractVerificationMethod(
            organization.didDoc,
            '#eth-account-key-1'
          );
          await persistOrganizationKey({
            organization,
            id: dltKey.id,
            publicKey: dltKey.publicKeyJwk,
            purposes: ['DLT_TRANSACTIONS'],
          });
          await persistGroup({
            organization,
            clientAdminIds: [testWriteOrganizationsUser.sub],
          });
          const did = organization.didDoc.id;
          const payload = {
            id: '#credentialagent-1',
            type: ServiceTypes.CareerIssuerType,
            credentialTypes: ['EducationDegree'],
            serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            invitationCode: '1234567812345678',
          };
          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: {
              'x-auto-activate': '0',
              'x-override-oauth-user': JSON.stringify(
                testWriteOrganizationsUser
              ),
            },
          });

          expect(response.statusCode).toEqual(201);

          expect(mockSendEmail).toBeCalledTimes(1);
          expect(mockSendEmail.mock.calls[0][0]).toEqual(
            expectedServiceActivationRequiredEmail
          );
        });
        it('Should send email to CAO on service activation', async () => {
          const caoService = {
            id: '#caoid',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://www.acme.com',
          };
          const caoOrg = await persistOrganization({
            name: 'CAO name',
            service: [caoService],
            keys: [
              buildOrgFactoryKey({
                id: '#eth-account-key-1',
                purposes: [
                  KeyPurposes.DLT_TRANSACTIONS,
                  KeyPurposes.ISSUING_METADATA,
                  KeyPurposes.EXCHANGES,
                ],
              }),
            ],
          });
          const dltKey = extractVerificationMethod(
            caoOrg.didDoc,
            '#eth-account-key-1'
          );
          await persistOrganizationKey({
            organization: caoOrg,
            id: dltKey.id,
            publicKey: dltKey.publicKeyJwk,
            purposes: ['DLT_TRANSACTIONS'],
          });
          await persistGroup({
            organization: caoOrg,
          });

          const did = caoOrg.didDoc.id;
          const payload = {
            id: `${did}#credentialagent-1`,
            type: ServiceTypes.CareerIssuerType,
            credentialTypes: ['EducationDegree'],
            serviceEndpoint: `${caoOrg.didDoc.id}#caoid`,
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: `${baseUrl}/${did}/services`,
            payload,
            headers: {
              'x-auto-activate': '1',
              'x-override-oauth-user': JSON.stringify(
                testWriteOrganizationsUser
              ),
            },
          });

          expect(response.statusCode).toEqual(201);
          expect(mockSendEmail).toBeCalledTimes(2);
          expect(mockSendEmail.mock.calls).toEqual(
            expect.arrayContaining([
              [sendServicesActivatedEmailMatcher()],
              [sendServicesActivatedEmailToCAOsMatcher(caoOrg)],
            ])
          );
        });
      });
    });

    describe('Organization Service Retrieval', () => {
      it('Should return 404 when organization not found', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/did:test:notfound/services/SERVICE-ID`,
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 404 when service not found in organization', async () => {
        const didDocumentService = {
          id: '#credentialagent-1',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const organization = await persistOrganization({
          service: [didDocumentService],
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/services/SERVICE-ID`,
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return organization service', async () => {
        const didDocumentService = {
          id: '#credentialagent-1',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
          logoUrl: 'https://example.com/logo.jpg',
        };
        const organization = await persistOrganization({
          service: [didDocumentService],
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${
            organization.didDoc.id
          }/services/${didDocumentService.id.substring(1)}`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(buildPublicService(didDocumentService));
      });

      describe('Get Wallet Provider service Test Suite', () => {
        it('Should return an organization with HolderAppProvider service with additional fields', async () => {
          const serviceFoo = {
            id: '#app-1',
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
            logoUrl: 'http://example.com/logo',
            name: 'fooWallet',
          };
          const org = await persistOrganization({
            service: [serviceFoo],
          });
          const response = await fastify.injectJson({
            method: 'GET',
            url: `${baseUrl}/${org.didDoc.id}/services/app-1`,
          });

          expect(response.statusCode).toEqual(200);
          expect(response.json).toEqual(buildPublicService(serviceFoo));
        });
        it('Should return an organization with HolderAppProvider when additional fields have not been added', async () => {
          const serviceFoo = {
            id: '#app-1',
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com',
            supportedExchangeProtocols: ['VN_API'],
          };
          const org = await persistOrganization({
            service: [serviceFoo],
          });
          const response = await fastify.injectJson({
            method: 'GET',
            url: `${baseUrl}/${org.didDoc.id}/services/app-1`,
          });

          expect(response.statusCode).toEqual(200);
          expect(response.json).toEqual(buildPublicService(serviceFoo));
        });
        it('Should return an organization with WebWalletProvider service with additional fields', async () => {
          const serviceFoo = {
            id: '#web-1',
            type: ServiceTypes.WebWalletProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com',
            logoUrl: 'http://example.com/logo',
            name: 'fooWallet',
            supportedExchangeProtocols: ['VN_API'],
          };
          const org = await persistOrganization({
            service: [serviceFoo],
          });
          const response = await fastify.injectJson({
            method: 'GET',
            url: `${baseUrl}/${org.didDoc.id}/services/web-1`,
          });

          expect(response.statusCode).toEqual(200);
          expect(response.json).toEqual(buildPublicService(serviceFoo));
        });
        it('Should return an organization with WebWalletProvider when additional fields have not been added', async () => {
          const serviceFoo = {
            id: '#web-1',
            type: ServiceTypes.WebWalletProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com',
          };
          const org = await persistOrganization({
            service: [serviceFoo],
          });
          const response = await fastify.injectJson({
            method: 'GET',
            url: `${baseUrl}/${org.didDoc.id}/services/web-1`,
          });

          expect(response.statusCode).toEqual(200);
          expect(response.json).toEqual(buildPublicService(serviceFoo));
        });
      });
    });

    describe('Organization Service Modification', () => {
      it('Should return 400 when request is malformed', async () => {
        const organization = await persistOrganization();
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${did}/services/service-1`,
          payload: {},
        });

        expect(response.statusCode).toEqual(400);
      });

      it('Should fail when id is specified in the payload', async () => {
        const serviceIdFragment = 'service-1';
        const service = {
          id: `#${serviceIdFragment}`,
          type: ServiceTypes.InspectionType,
          serviceEndpoint: 'https://www.acme.com',
        };
        const organization = await persistOrganization({
          service: [service],
        });

        const updatedService = {
          ...service,
          serviceEndpoint: 'https://www.update.acme.com',
        };
        const did = organization.didDoc.id;

        const payload = updatedService;

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${did}/services/${serviceIdFragment}`,
          payload,
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            statusCode: 400,
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message:
              OrganizationServiceErrorMessages.SERVICE_ID_CANNOT_BE_UPDATED,
          })
        );
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toMatchObject({
          didDoc: { service: [{ ...service }] },
        });
      });

      it('Should fail when type is specified in the payload', async () => {
        const serviceIdFragment = 'service-1';
        const service = {
          id: `#${serviceIdFragment}`,
          type: ServiceTypes.InspectionType,
          serviceEndpoint: 'https://www.acme.com',
        };
        const organization = await persistOrganization({
          service: [service],
        });

        const updatedService = {
          type: service.type,
          serviceEndpoint: 'https://www.update.acme.com',
        };
        const did = organization.didDoc.id;

        const payload = updatedService;

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${organization.didDoc.id}/services/${serviceIdFragment}`,
          payload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            statusCode: 400,
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message:
              OrganizationServiceErrorMessages.SERVICE_TYPE_CANNOT_BE_UPDATED,
          })
        );
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toMatchObject({
          didDoc: { service: [{ ...service }] },
        });
      });

      it('Should return 404 when organization not found', async () => {
        const payload = {
          serviceEndpoint: 'SERVICE-ENDPOINT',
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/did:test:notfound/services/service-1`,
          payload,
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 404 when service not found in organization', async () => {
        const service = {
          serviceEndpoint: 'https://www.acme.com',
        };
        const organization = await persistOrganization();

        const payload = service;

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${organization.didDoc.id}/services/missing-service-1`,
          payload,
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should 400 when update serviceEndpoint is bad protocol', async () => {
        const serviceIdFragment = 'service-1';
        const service = {
          id: `#${serviceIdFragment}`,
          type: ServiceTypes.InspectionType,
          serviceEndpoint: 'https://www.acme.com',
        };
        const organization = await persistOrganization({
          service: [service],
        });

        const updatedServiceValues = {
          serviceEndpoint: 'http://www.update.acme.com',
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${organization.didDoc.id}/services/${serviceIdFragment}`,
          payload: updatedServiceValues,
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          'serviceEndpoint is invalid format'
        );
      });

      it('Should 400 when logoUrl does not exist for HolderAppProvider', async () => {
        const serviceIdFragment = 'service-1';
        const service = {
          id: `#${serviceIdFragment}`,
          type: ServiceTypes.HolderAppProviderType,
          serviceEndpoint: 'https://www.acme.com',
          logoUrl: 'http://example.com/1.png',
          playStoreUrl: 'http://example.com/play-store',
          appleAppStoreUrl: 'http://example.com/apple-app-store',
          appleAppId: 'com.example.app',
          googlePlayId: 'com.example.app',
        };
        const organization = await persistOrganization({
          service: [service],
        });

        const updatedServiceValues = {
          serviceEndpoint: 'https://www.acme2.com',
          playStoreUrl: 'http://example.com/play-store',
          appleAppStoreUrl: 'http://example.com/apple-app-store',
          appleAppId: 'com.example.app',
          googlePlayId: 'com.example.app',
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${organization.didDoc.id}/services/${serviceIdFragment}`,
          payload: updatedServiceValues,
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          'VlcHolderAppProvider_v1 service type requires "logoUrl"'
        );
      });

      it('Should fail to update service of deleted organiztions', async () => {
        const org = await persistOrganization({
          deletedAt: Date('2023-02-27T14'),
        });
        const payload = {
          serviceEndpoint: 'SERVICE-ENDPOINT',
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${org.didDoc.id}/services/service-1`,
          payload,
        });
        expect(response.statusCode).toEqual(404);
      });

      it('Should fail to update a organization service if the serviceEndpoint DID service reference doesnt exist', async () => {
        const caoOrg = await persistOrganization({
          service: [
            {
              id: '#caoid',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://www.acme.com',
            },
          ],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });

        const service = {
          id: '#service-1',
          type: ServiceTypes.InspectionType,
          serviceEndpoint: 'https://www.acme.com',
        };
        const organization = await persistOrganization({
          service: [service],
        });

        const updatedServiceValues = {
          serviceEndpoint: `${caoOrg.didDoc.id}#wrong-ref`,
        };
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${did}/services/${service.id.slice(1)}`,
          payload: updatedServiceValues,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'service_endpoint_ref_not_found',
            message: 'Service endpoint is not pointing to CAO',
            statusCode: 400,
          })
        );
      });

      it('Should update organization service', async () => {
        const serviceIdFragment = 'service-1';
        const service = [
          {
            id: '#other',
            type: ServiceTypes.InspectionType,
            serviceEndpoint: 'https://www.acme.com',
          },
          {
            id: `#${serviceIdFragment}`,
            type: ServiceTypes.InspectionType,
            serviceEndpoint: 'https://www.acme.com',
          },
        ];
        const organization = await persistOrganization({
          service,
        });
        const updatedServiceValues = {
          serviceEndpoint: 'https://www.update.acme.com',
        };
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${organization.didDoc.id}/services/${serviceIdFragment}`,
          payload: updatedServiceValues,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(
          buildPublicService({ ...service[1], ...updatedServiceValues })
        );

        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toMatchObject({
          didDoc: {
            service: map(pick(didDocServiceFields), [
              service[0],
              { ...service[1], ...updatedServiceValues },
            ]),
          },
          services: expectedServices([
            service[0],
            { ...service[1], ...updatedServiceValues },
          ]),
        });
      });

      describe('Update Wallet Provider service Test Suite', () => {
        it('Should 400 when HolderAppProvider is missing HolderAppProvider specific property', async () => {
          const organization = await persistOrganization({
            service: [
              {
                id: '#app-1',
                type: ServiceTypes.HolderAppProviderType,
                serviceEndpoint: 'https://agent.samplevendor.com/acme',
              },
            ],
          });
          await persistGroup({ organization });
          const did = organization.didDoc.id;

          const payload = {
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            playStoreUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
          };

          const response = await fastify.injectJson({
            method: 'PUT',
            url: `${baseUrl}/${did}/services/app-1`,
            payload,
            headers: { 'x-auto-activate': '0' },
          });
          expect(response.statusCode).toEqual(400);
          expect(response.json).toEqual(
            errorResponseMatcher({
              error: 'Bad Request',
              errorCode: 'missing_error_code',
              message:
                'VlcHolderAppProvider_v1 service type requires "logoUrl"',
              statusCode: 400,
            })
          );
        });

        it('Should 400 when WebWalletProvider is missing WebWalletProvider specific property', async () => {
          const organization = await persistOrganization({
            service: [
              {
                id: '#web-1',
                type: ServiceTypes.WebWalletProviderType,
                serviceEndpoint: 'https://agent.samplevendor.com/acme',
              },
            ],
          });
          await persistGroup({ organization });
          const did = organization.didDoc.id;

          const payload = {
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          };

          const response = await fastify.injectJson({
            method: 'PUT',
            url: `${baseUrl}/${did}/services/web-1`,
            payload,
            headers: { 'x-auto-activate': '0' },
          });
          expect(response.statusCode).toEqual(400);
          expect(response.json).toEqual(
            errorResponseMatcher({
              error: 'Bad Request',
              errorCode: 'missing_error_code',
              message:
                'VlcWebWalletProvider_v1 service type requires "logoUrl"',
              statusCode: 400,
            })
          );
        });

        it('Should 200 and update HolderAppProvider service without previously defined HolderAppProvider specific values', async () => {
          const service = {
            id: '#app-1',
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          };
          const organization = await persistOrganization({
            service: [service],
          });
          await persistGroup({ organization });
          const did = organization.didDoc.id;

          const updatedServiceValues = {
            serviceEndpoint: 'https://www.acme.com',
            logoUrl: 'http://example.com/2.png',
            name: 'fooWallet',
            playStoreUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
            supportedExchangeProtocols: ['VN_API'],
          };

          const response = await fastify.injectJson({
            method: 'PUT',
            url: `${baseUrl}/${did}/services/app-1`,
            payload: updatedServiceValues,
          });
          expect(response.statusCode).toEqual(200);
          expect(response.json).toEqual(
            buildPublicService({ ...service, ...updatedServiceValues })
          );

          const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
          expect(orgFromDb).toMatchObject({
            didDoc: {
              service: map(pick(didDocServiceFields), [
                { ...service, ...updatedServiceValues },
              ]),
            },
            services: expectedServices([
              { ...service, ...updatedServiceValues },
            ]),
          });
        });

        it('Should 200 and update WebWalletProvider service with already previously defined WebWalletProvider specific values', async () => {
          const service = {
            id: '#web-1',
            type: ServiceTypes.WebWalletProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            logoUrl: 'http://foo',
            name: 'foo',
            playStoreUrl: 'http://foo',
            appleAppStoreUrl: 'http://foo',
            appleAppId: 'foo',
            googlePlayId: 'foo',
          };
          const organization = await persistOrganization({
            service: [service],
          });
          await persistGroup({ organization });
          const did = organization.didDoc.id;

          const updatedServiceValues = {
            serviceEndpoint: 'https://www.acme.com',
            logoUrl: 'http://example.com/2.png',
            name: 'fooWallet',
            playStoreUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
            supportedExchangeProtocols: ['VN_API'],
          };

          const response = await fastify.injectJson({
            method: 'PUT',
            url: `${baseUrl}/${did}/services/web-1`,
            payload: updatedServiceValues,
          });
          expect(response.statusCode).toEqual(200);
          expect(response.json).toEqual(
            buildPublicService({ ...service, ...updatedServiceValues })
          );

          const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
          expect(orgFromDb).toMatchObject({
            didDoc: {
              service: map(pick(didDocServiceFields), [
                { ...service, ...updatedServiceValues },
              ]),
            },
            services: expectedServices([
              { ...service, ...updatedServiceValues },
            ]),
          });
        });
      });

      it('Should update organization service with did pattern without type in body', async () => {
        const caoOrg = await persistOrganization({
          service: [
            {
              id: '#caoid',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://www.acme.com',
            },
          ],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });

        const service = {
          id: '#service-1',
          type: ServiceTypes.InspectionType,
          serviceEndpoint: 'https://www.acme.com',
        };
        const organization = await persistOrganization({
          service: [service],
        });

        const updatedServiceValues = {
          serviceEndpoint: `${caoOrg.didDoc.id}#caoid`,
        };
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${did}/services/${service.id.slice(1)}`,
          payload: updatedServiceValues,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(
          buildPublicService({ ...service, ...updatedServiceValues })
        );

        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toMatchObject({
          didDoc: {
            service: map(pick(didDocServiceFields), [
              { ...service, ...updatedServiceValues },
            ]),
          },
          services: expectedServices([{ ...service, ...updatedServiceValues }]),
        });
      });
    });

    describe('Organization Service Removal', () => {
      it('Should return 404 when organization not found', async () => {
        const monitorNockScope = setMonitorEventsNock();
        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/did:test:notfound/services/service-1`,
        });

        expect(response.statusCode).toEqual(404);

        expect(monitorDeletionNockExecuted(monitorNockScope)).toEqual(false);
      });

      it('Should return 404 when service not found in organization', async () => {
        const monitorNockScope = setMonitorEventsNock();
        const organization = await persistOrganization({
          service: [
            {
              id: '#credentialagent-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
        });

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${organization.didDoc.id}/services/missing-service-1`,
        });

        expect(response.statusCode).toEqual(404);

        expect(monitorDeletionNockExecuted(monitorNockScope)).toEqual(false);
      });

      it('Should handle removal of a non-ion did', async () => {
        const serviceId = '#credentialagent-1';
        const didDocumentServices = [
          {
            id: serviceId,
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          },
          {
            id: '#credentialagent-2',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          },
        ];
        const organization = await persistOrganization({
          didDoc: {
            id: 'did:notion:123',
          },
          service: didDocumentServices,
        });

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${organization.didDoc.id}/services/${serviceId.slice(
            1
          )}`,
        });

        expect(response.statusCode).toEqual(204);
        expect(response.body).toEqual('');
        const dbOrg = await getOrganizationFromDb(organization.didDoc.id);
        expect(dbOrg).toMatchObject({
          didDoc: {
            id: organization.didDoc.id,
            service: [],
          },
          services: [
            {
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
              ...didDocumentServices[1],
            },
          ],
        });
      });

      it('Should remove organization service without the client grant ids', async () => {
        const monitorNockScope = setMonitorEventsNock();
        const serviceId = '#credentialagent-1';
        const authClients = [
          {
            type: 'auth0',
            clientType: AuthClientTypes.REGISTRAR,
            clientId: nanoid(),
          },
          {
            type: 'auth0',
            clientType: AuthClientTypes.CAO_NODE_CLIENT,
            clientId: nanoid(),
            serviceId,
          },
        ];

        const organization = await persistOrganization({
          service: [
            {
              id: serviceId,
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          authClients,
        });
        const did = organization.didDoc.id;

        setGetMonitorsNock(did, serviceId);

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}/services/${serviceId.slice(1)}`,
        });

        expect(response.statusCode).toEqual(204);
        expect(response.body).toEqual('');
        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [],
          },
          didDoc: {
            ...organization.didDoc,
            service: [],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: authClients.slice(0, 1),
          services: [],
          activatedServiceIds: [],
        });
        expect(mockAuth0ClientDelete.mock.calls).toEqual([
          [{ client_id: authClients[1].clientId }],
        ]);
        expect(monitorDeletionNockExecuted(monitorNockScope)).toEqual(true);
      });

      it('Should remove organization service', async () => {
        const monitorNockScope = setMonitorEventsNock();
        const serviceId = '#credentialagent-1';
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
            serviceId,
          },
        ];
        const organization = await persistOrganization({
          service: [
            {
              id: serviceId,
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          authClients,
        });
        const did = organization.didDoc.id;

        setGetMonitorsNock(did, serviceId);

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}/services/${serviceId.slice(1)}`,
        });

        expect(response.statusCode).toEqual(204);
        expect(response.body).toEqual('');
        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [],
          },
          didDoc: {
            ...organization.didDoc,
            service: [],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: authClients.slice(0, 1),
          services: [],
          activatedServiceIds: [],
        });

        expect(mockAuth0ClientGrantDelete.mock.calls).toEqual(
          map(
            (clientGrantId) => [{ id: clientGrantId }],
            authClients[1].clientGrantIds
          )
        );
        expect(mockAuth0ClientDelete.mock.calls).toEqual([
          [{ client_id: authClients[1].clientId }],
        ]);

        expect(monitorDeletionNockExecuted(monitorNockScope)).toEqual(true);

        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
        expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
          address: organization.ids.ethereumAccount,
          scopesToRemove: [
            'transactions:write',
            'credential:identityissue',
            'credential:contactissue',
            'credential:revoke',
            'credential:inspect',
            'credential:issue',
          ],
          scopesToAdd: [],
        });
      });
    });

    describe('Organization Service Deactivation', () => {
      it('Should return 404 when organization not found', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/did:test:notfound/deactivate-services`,
          payload: {
            serviceIds: ['missing-service-1'],
          },
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Not Found',
            errorCode: 'organization_not_found',
            message: 'Organization not found',
            statusCode: 404,
          })
        );
      });

      it('Should return 400 when service not found in organization', async () => {
        const organization = await persistOrganization({
          service: [
            {
              id: '#credentialagent-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });

        const response = await fastify.injectJson({
          method: 'post',
          url: `${baseUrl}/${organization.didDoc.id}/deactivate-services`,
          payload: {
            serviceIds: ['missing-service-1'],
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: `Service #missing-service-1 was not found in organization ${organization.didDoc.id}`,
            statusCode: 400,
          })
        );
      });

      it('Should return 400 when service not found in active services', async () => {
        const organization = await persistOrganization({
          service: [
            {
              id: '#credentialagent-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
            {
              id: '#credentialagent-2',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
            {
              id: '#credentialagent-3',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          activatedServiceIds: ['#credentialagent-1', '#credentialagent-2'],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });

        const response = await fastify.injectJson({
          method: 'post',
          url: `${baseUrl}/${organization.didDoc.id}/deactivate-services`,
          payload: {
            serviceIds: [
              '#credentialagent-1',
              '#credentialagent-2',
              '#credentialagent-3',
            ],
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: `Service #credentialagent-3 was not found in activated services of the organization ${organization.didDoc.id}`,
            statusCode: 400,
          })
        );
      });

      it('Deactivate a CAO service from an org with one CAO service', async () => {
        const serviceId = '#credentialagent-1';
        const authClients = [
          {
            type: 'auth0',
            clientType: AuthClientTypes.CAO_NODE_CLIENT,
            clientId: nanoid(),
            clientGrantIds: [nanoid(), nanoid()],
            serviceId,
          },
        ];
        const organization = await persistOrganization({
          service: [
            {
              id: serviceId,
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          authClients,
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/deactivate-services`,
          payload: {
            serviceIds: [serviceId],
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          profile: {
            id: did,
            ...organization.profile,
            permittedVelocityServiceCategory: [],
          },
          activatedServiceIds: [],
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: [
            {
              ...authClients[0],
              clientGrantIds: [],
            },
          ],
          activatedServiceIds: [],
        });

        expect(mockAuth0ClientGrantDelete.mock.calls).toEqual(
          map(
            (clientGrantId) => [{ id: clientGrantId }],
            authClients[0].clientGrantIds
          )
        );
        expect(mockAuth0ClientDelete).toHaveBeenCalledTimes(0);

        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
        expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
          address: organization.ids.ethereumAccount,
          scopesToRemove: [
            'transactions:write',
            'credential:identityissue',
            'credential:contactissue',
            'credential:revoke',
            'credential:inspect',
            'credential:issue',
          ],
          scopesToAdd: [],
        });
      });

      it('Deactivate a CAO service from an org with two CAO service', async () => {
        const serviceId = '#credentialagent-1';
        const authClients = [
          {
            type: 'auth0',
            clientType: AuthClientTypes.CAO_NODE_CLIENT,
            clientId: nanoid(),
            clientGrantIds: [nanoid(), nanoid()],
            serviceId,
          },
          {
            type: 'auth0',
            clientType: AuthClientTypes.CAO_NODE_CLIENT,
            clientId: nanoid(),
            clientGrantIds: [nanoid(), nanoid()],
            serviceId: '#credentialagent-2',
          },
        ];
        const organization = await persistOrganization({
          service: [
            {
              id: serviceId,
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
            {
              id: '#credentialagent-2',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          authClients,
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/deactivate-services`,
          payload: {
            serviceIds: [serviceId],
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          profile: {
            id: did,
            ...organization.profile,
            permittedVelocityServiceCategory: ['CredentialAgentOperator'],
          },
          activatedServiceIds: ['#credentialagent-2'],
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: ['CredentialAgentOperator'],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: [
            {
              ...authClients[0],
              clientGrantIds: [],
            },
            authClients[1],
          ],
          activatedServiceIds: ['#credentialagent-2'],
        });

        expect(mockAuth0ClientGrantDelete.mock.calls).toEqual(
          map(
            (clientGrantId) => [{ id: clientGrantId }],
            authClients[0].clientGrantIds
          )
        );
        expect(mockAuth0ClientDelete).toHaveBeenCalledTimes(0);

        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
        expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
          address: organization.ids.ethereumAccount,
          scopesToRemove: [
            'transactions:write',
            'credential:identityissue',
            'credential:contactissue',
            'credential:revoke',
            'credential:inspect',
            'credential:issue',
          ],
          scopesToAdd: [],
        });
      });

      it('Deactivate two CAO services from an org with two CAO service', async () => {
        const authClients = [
          {
            type: 'auth0',
            clientType: AuthClientTypes.CAO_NODE_CLIENT,
            clientId: nanoid(),
            clientGrantIds: [nanoid(), nanoid()],
            serviceId: '#credentialagent-1',
          },
          {
            type: 'auth0',
            clientType: AuthClientTypes.CAO_NODE_CLIENT,
            clientId: nanoid(),
            clientGrantIds: [nanoid(), nanoid()],
            serviceId: '#credentialagent-2',
          },
        ];
        const organization = await persistOrganization({
          service: [
            {
              id: '#credentialagent-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
            {
              id: '#credentialagent-2',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          authClients,
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/deactivate-services`,
          payload: {
            serviceIds: ['#credentialagent-1', '#credentialagent-2'],
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          profile: {
            id: did,
            ...organization.profile,
            permittedVelocityServiceCategory: [],
          },
          activatedServiceIds: [],
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: [
            {
              ...authClients[1],
              clientGrantIds: [],
            },
            {
              ...authClients[0],
              clientGrantIds: [],
            },
          ],
          activatedServiceIds: [],
        });

        expect(mockAuth0ClientGrantDelete).toHaveBeenNthCalledWith(1, {
          id: authClients[0].clientGrantIds[0],
        });
        expect(mockAuth0ClientGrantDelete).toHaveBeenNthCalledWith(2, {
          id: authClients[0].clientGrantIds[1],
        });
        expect(mockAuth0ClientGrantDelete).toHaveBeenNthCalledWith(3, {
          id: authClients[1].clientGrantIds[0],
        });
        expect(mockAuth0ClientGrantDelete).toHaveBeenNthCalledWith(4, {
          id: authClients[1].clientGrantIds[1],
        });

        expect(mockAuth0ClientDelete).toHaveBeenCalledTimes(0);
      });

      it('Deactivate a Issuer service from an org with one CAO service and one Issuer service', async () => {
        const serviceId = '#issuer-1';
        const authClients = [
          {
            type: 'auth0',
            clientType: AuthClientTypes.CAO_NODE_CLIENT,
            clientId: nanoid(),
            clientGrantIds: [nanoid(), nanoid()],
            serviceId: '#credentialagent-1',
          },
        ];
        const organization = await persistOrganization({
          service: [
            {
              id: '#credentialagent-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
            {
              id: serviceId,
              type: ServiceTypes.CareerIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/ocge',
            },
          ],
          authClients,
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/deactivate-services`,
          payload: {
            serviceIds: [serviceId],
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          profile: {
            id: did,
            ...organization.profile,
            permittedVelocityServiceCategory: ['CredentialAgentOperator'],
          },
          activatedServiceIds: ['#credentialagent-1'],
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        expect(mockAuth0ClientGrantDelete).toHaveBeenCalledTimes(0);
        expect(mockAuth0ClientDelete).toHaveBeenCalledTimes(0);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: ['CredentialAgentOperator'],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients,
          activatedServiceIds: ['#credentialagent-1'],
        });
      });

      it('Deactivate a Issuer service from an org with one CAO service and two Issuer services', async () => {
        const serviceId = '#issuer-1';
        const authClients = [
          {
            type: 'auth0',
            clientType: AuthClientTypes.CAO_NODE_CLIENT,
            clientId: nanoid(),
            clientGrantIds: [nanoid(), nanoid()],
            serviceId: '#credentialagent-1',
          },
        ];
        const organization = await persistOrganization({
          service: [
            {
              id: '#credentialagent-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
            {
              id: serviceId,
              type: ServiceTypes.CareerIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/ocge',
            },
            {
              id: '#issuer-2',
              type: ServiceTypes.CareerIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/ocge',
            },
          ],
          authClients,
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const dltKey = extractVerificationMethod(
          organization.didDoc,
          '#eth-account-key-1'
        );
        await persistOrganizationKey({
          organization,
          id: dltKey.id,
          publicKey: dltKey.publicKeyJwk,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.ISSUING_METADATA,
            KeyPurposes.EXCHANGES,
          ],
        });
        const did = organization.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/deactivate-services`,
          payload: {
            serviceIds: [serviceId],
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          profile: {
            id: did,
            ...organization.profile,
            permittedVelocityServiceCategory: [
              'CredentialAgentOperator',
              'Issuer',
            ],
          },
          activatedServiceIds: ['#credentialagent-1', '#issuer-2'],
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        expect(mockAuth0ClientGrantDelete).toHaveBeenCalledTimes(0);
        expect(mockAuth0ClientDelete).toHaveBeenCalledTimes(0);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [
              'CredentialAgentOperator',
              'Issuer',
            ],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients,
          activatedServiceIds: ['#credentialagent-1', '#issuer-2'],
        });
      });
    });
  });

  describe('Organization Service Monitoring Tests', () => {
    let orgs = [];
    let dids;
    const serviceIds = ['#acme', '#beta'];
    const serviceEndpoints = [
      'https://agent.samplevendor.com/acme',
      'https://agent.samplevendor.com/beta',
    ];

    beforeEach(async () => {
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
      orgs = [];
      const org1 = await persistOrganization({
        service: [
          {
            id: serviceIds[0],
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: serviceEndpoints[0],
          },
        ],
      });
      const dltKey = extractVerificationMethod(
        org1.didDoc,
        '#eth-account-key-1'
      );
      await persistOrganizationKey({
        organization: org1,
        id: dltKey.id,
        publicKey: dltKey.publicKeyJwk,
        controller: org1.didDoc.id,
        purposes: ['DLT_TRANSACTIONS'],
      });
      orgs.push(org1);

      const org2 = await persistOrganization({
        service: [
          {
            id: serviceIds[1],
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: serviceEndpoints[1],
          },
        ],
        authClients,
      });
      const dltKey2 = extractVerificationMethod(
        org1.didDoc,
        '#eth-account-key-1'
      );
      await persistOrganizationKey({
        organization: org2,
        id: dltKey2.id,
        publicKey: dltKey2.publicKeyJwk,
        controller: org2.didDoc.id,
        purposes: ['DLT_TRANSACTIONS'],
      });
      orgs.push(org2);

      dids = map('didDoc.id', orgs);
    });

    describe('monitoring failures during service creation', () => {
      it('failed get service version should still create a monitor', async () => {
        const payload = {
          id: '#credentialagent-2',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const serviceVersionNock = setServicePingNock(
          payload.serviceEndpoint,
          undefined,
          500
        );
        const getSectionsNock = setGetMonitorsNock(dids, serviceIds);
        const monitorEventsNock = setMonitorEventsNock();
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${dids[0]}/services`,
          payload,
        });

        expect(response.statusCode).toEqual(201);
        expect(
          getServiceVersionNockExecuted('https://agent.samplevendor.com/acme')(
            serviceVersionNock
          )
        ).toEqual(true);
        expect(getSectionsNockExecuted(getSectionsNock)).toEqual(true);
        expect(postMonitorNockExecuted(monitorEventsNock)).toEqual(true);
      });

      it('failed sync should error silently', async () => {
        const payload = {
          id: '#credentialagent-1',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const serviceVersionNock = setServicePingNock(payload.serviceEndpoint);
        const failureNock = setGetSectionsFailNock();
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${dids[0]}/services`,
          payload,
        });

        expect(response.statusCode).toEqual(201);
        expect(
          getServiceVersionNockExecuted('https://agent.samplevendor.com/acme')(
            serviceVersionNock
          )
        ).toEqual(true);
        expect(getSectionsNockExecuted(failureNock)).toEqual(true);
      }, 20000);
    });

    it('Removing service: Monitor removing should fail silently', async () => {
      const getMonitorsNock = setGetMonitorsFailNock();

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${baseUrl}/${dids[1]}/services/${serviceIds[1].slice(1)}`,
      });

      expect(postMonitorNockExecuted(getMonitorsNock)).toEqual(true);
      expect(response.statusCode).toEqual(204);
    });
  });

  describe('Non-custodied DID:WEB Services test suites', () => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    const generateDidWebDoc = (service) => ({
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
      ],
      id: `did:web:${nanoid()}`,
      verificationMethod: [
        {
          id: 'did:web:example.com#key-0',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
        {
          id: 'did:web:example.com#key-1',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
        {
          id: 'did:web:example.com#key-3',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
      ],
      authentication: [
        'did:web:example.com#key-0',
        'did:web:example.com#key-1',
      ],
      assertionMethod: [
        'did:web:example.com#key-0',
        'did:web:example.com#key-1',
      ],
      service,
      publicKey: [
        {
          id: 'did:web:example.com#key-0',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
        {
          id: 'did:web:example.com#key-1',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
        {
          id: 'did:web:example.com#key-3',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
      ],
    });
    let organization;
    let expectedDidWebDoc;
    beforeEach(async () => {
      nock.cleanAll();
      expectedDidWebDoc = generateDidWebDoc();
      organization = await persistOrganization({
        name: 'Did web org',
        didDocId: expectedDidWebDoc.id,
        didNotCustodied: true,
      });
      await persistGroup({ organization });
    });

    const didWebUrl = (didWebDoc) => `https://${didWebDoc.id.substring(8)}`;

    describe('Organization Service Addition', () => {
      it('Should add organization service', async () => {
        const nockData = nock(didWebUrl(expectedDidWebDoc))
          .get('/.well-known/did.json')
          .reply(200, {
            ...expectedDidWebDoc,
            service: [
              {
                id: '#credentialagent-1',
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: 'https://agent.samplevendor.com/acme',
              },
            ],
          });
        await persistOrganizationKey({
          organization,
          purposes: [KeyPurposes.DLT_TRANSACTIONS],
          ...expectedDidWebDoc.verificationMethod[0],
          publicKey: expectedDidWebDoc.verificationMethod[0].publicKeyJwk,
        });
        const did = organization.didDoc.id;
        const payload = {
          id: '#credentialagent-1',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
          authClient: {
            clientId: expect.any(String),
            clientType: 'agent',
            serviceId: '#credentialagent-1',
            clientSecret: expect.any(String),
            type: 'auth0',
          },
        });
        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toMatchObject({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
          },
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [
              ServiceCategories.CredentialAgentOperator,
            ],
          },
          services: expectedServices([payload]),
          activatedServiceIds: [toRelativeServiceId(payload.id)],
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          authClients: [
            {
              clientId: expect.any(String),
              clientType: 'agent',
              serviceId: '#credentialagent-1',
              type: 'auth0',
            },
          ],
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
        });

        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(1);
        expect(mockSendEmail.mock.calls).toEqual([
          [sendServicesActivatedEmailMatcher()],
        ]);

        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
        expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
          address: organization.ids.ethereumAccount,
          scopesToAdd: [],
          scopesToRemove: [
            'transactions:write',
            'credential:identityissue',
            'credential:contactissue',
            'credential:revoke',
            'credential:inspect',
            'credential:issue',
          ],
        });
        expect(nockData.isDone()).toEqual(true);

        // consent entity checks
        expect(await getConsentsFromDb(dbOrg)).toEqual(
          expectedConsents(
            organization,
            dbOrg.services,
            testWriteOrganizationsUser
          )
        );
      }, 30000);

      it('Should add organization service without activation', async () => {
        const nockData = nock(didWebUrl(expectedDidWebDoc))
          .get('/.well-known/did.json')
          .reply(200, {
            ...expectedDidWebDoc,
            service: [
              {
                id: '#credentialagent-1',
                type: ServiceTypes.IdDocumentIssuerType,
                serviceEndpoint: 'https://agent.samplevendor.com/acme',
              },
            ],
          });
        await persistOrganizationKey({
          organization,
          id: expectedDidWebDoc.verificationMethod[0].id,
          purposes: [KeyPurposes.DLT_TRANSACTIONS],
        });
        await persistOrganizationKey({
          organization,
          id: expectedDidWebDoc.verificationMethod[1].id,
          purposes: [KeyPurposes.EXCHANGES],
        });
        await persistOrganizationKey({
          organization,
          id: expectedDidWebDoc.verificationMethod[2].id,
          purposes: [KeyPurposes.ISSUING_METADATA],
        });
        const did = organization.didDoc.id;
        const payload = {
          id: '#credentialagent-1',
          type: ServiceTypes.IdDocumentIssuerType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
          credentialTypes: ['IdDocument'],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: { 'x-auto-activate': '0' },
        });

        expect(response.statusCode).toEqual(201);
        const expectedService = {
          ...payload,
          id: toRelativeServiceId(payload.id),
        };
        expect(response.json).toEqual({
          service: expectedService,
        });
        expect(nockData.isDone()).toEqual(true);
        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toMatchObject({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
          },
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [],
          },
          services: expectedServices([payload]),
          activatedServiceIds: [],
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          authClients: [],
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
        });

        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(0);
        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(0);

        // consent entity checks
        expect(await getConsentsFromDb(dbOrg)).toEqual(
          expectedConsents(organization, dbOrg.services, testRegistrarSuperUser)
        );
      });

      it('Should add additional organization service', async () => {
        const nockData = nock(didWebUrl(expectedDidWebDoc))
          .get('/.well-known/did.json')
          .twice()
          .reply(200, {
            ...expectedDidWebDoc,
            service: [
              {
                id: '#credentialagent-1',
                type: ServiceTypes.IdDocumentIssuerType,
                serviceEndpoint: 'https://agent.samplevendor.com/acme',
              },
              {
                id: '#credentialagent-2',
                type: ServiceTypes.IdDocumentIssuerType,
                serviceEndpoint: 'https://agent.samplevendor.com/acme',
              },
            ],
          });

        const did = organization.didDoc.id;

        await persistOrganizationKey({
          organization,
          id: expectedDidWebDoc.verificationMethod[0].id,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.EXCHANGES,
            KeyPurposes.ISSUING_METADATA,
          ],
        });

        const payloads = [
          {
            id: `${did}#credentialagent-1`,
            type: ServiceTypes.IdDocumentIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            logoUrl: 'https://example.com/logo.url',
          },
          {
            id: '#credentialagent-2',
            type: ServiceTypes.IdDocumentIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          },
        ];

        const response0 = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload: payloads[0],
          headers: { 'x-auto-activate': '0' },
        });

        expect(response0.statusCode).toEqual(201);
        expect(response0.json).toEqual({
          service: {
            ...payloads[0],
            id: toRelativeServiceId(payloads[0].id),
          },
        });

        const response1 = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload: payloads[1],
          headers: { 'x-auto-activate': '0' },
        });

        expect(response1.statusCode).toEqual(201);
        expect(response1.json).toEqual({
          service: payloads[1],
        });
        expect(nockData.isDone()).toEqual(true);
        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toMatchObject({
          ...mongoify(organization),
          didDoc: {
            ...organization.didDoc,
          },
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [],
          },
          services: expectedServices(payloads),
          activatedServiceIds: [],
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          authClients: [],
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
        });

        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(0);
        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(0);

        // consent entity checks
        expect(await getConsentsFromDb(dbOrg)).toEqual(
          expectedConsents(organization, dbOrg.services, testRegistrarSuperUser)
        );
      });

      it('Should throw error if service id already exists', async () => {
        const didDocumentService = {
          id: '#credentialagent-1',
          type: ServiceTypes.IdDocumentIssuerType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const didWebDoc = generateDidWebDoc([didDocumentService]);
        const nockData = nock(didWebUrl(didWebDoc))
          .get('/.well-known/did.json')
          .reply(200, didWebDoc);
        const org = await persistOrganization({
          service: [didDocumentService],
          name: 'Did web org',
          didDocId: didWebDoc.id,
          didNotCustodied: true,
        });

        await persistOrganizationKey({
          organization: org,
          id: didWebDoc.verificationMethod[0].id,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.EXCHANGES,
            KeyPurposes.ISSUING_METADATA,
          ],
        });
        const did = org.didDoc.id;
        const payload = {
          id: '#credentialagent-1',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme2',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: { 'x-auto-activate': '0' },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message:
              OrganizationRegistryErrorMessages.SERVICE_ID_ALREADY_EXISTS,
            statusCode: 400,
          })
        );
        expect(nockData.isDone()).toEqual(true);
        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toMatchObject({
          ...mongoify(org),
          services: expectedServices([didDocumentService]),
          activatedServiceIds: ['#credentialagent-1'],
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          authClients: [],
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
        });

        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(0);
        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(0);
      });

      it('Should 400 if did document does not have service', async () => {
        const nockData = nock(didWebUrl(expectedDidWebDoc))
          .get('/.well-known/did.json')
          .reply(200, {
            ...expectedDidWebDoc,
            service: [
              {
                id: '#credentialagent-1',
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: 'https://agent.samplevendor.com/acme',
              },
            ],
          });
        const did = organization.didDoc.id;
        const payload = {
          id: '#issuer-1',
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: { 'x-auto-activate': '0' },
        });

        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'Service with ID #issuer-1 does not exist',
          },
        });
        expect(nockData.isDone()).toEqual(true);
      });

      it('Should error 400 if there is no DID Doc', async () => {
        const did = organization.didDoc.id;
        const payload = {
          id: '#credentialagent-1',
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: { 'x-auto-activate': '1' },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'did_resolution_failed',
            message: `Could not resolve ${expectedDidWebDoc.id}`,
            statusCode: 400,
          })
        );
      });

      it('Should throw error if no key for particular service type', async () => {
        const nockData = nock(didWebUrl(expectedDidWebDoc))
          .get('/.well-known/did.json')
          .reply(200, {
            ...expectedDidWebDoc,
            service: [
              {
                id: '#credentialagent-1',
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: 'https://agent.samplevendor.com/acme',
              },
            ],
          });
        const did = organization.didDoc.id;
        const payload = {
          id: '#credentialagent-1',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/services`,
          payload,
          headers: { 'x-auto-activate': '1' },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'No required purpose for service',
            statusCode: 400,
          })
        );
        expect(nockData.isDone()).toEqual(true);
      });

      it('Should send to CAO information about tenant and keys using DID:WEB', async () => {
        nock(didWebUrl(expectedDidWebDoc))
          .get('/.well-known/did.json')
          .reply(200, {
            ...expectedDidWebDoc,
            service: [
              {
                id: '#issue-1',
                type: ServiceTypes.IdDocumentIssuerType,
                serviceEndpoint: 'https://agent.samplevendor.com/acme',
              },
            ],
          });

        await persistOrganizationKey({
          organization,
          id: expectedDidWebDoc.verificationMethod[0].id,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.EXCHANGES,
            KeyPurposes.ISSUING_METADATA,
          ],
        });

        const caoService = {
          id: '#caoid',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://www.acme.com',
        };

        const caoOrg = await persistOrganization({
          service: [caoService],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const payload = {
          id: '#issue-1',
          type: ServiceTypes.CareerIssuerType,
          serviceEndpoint: `${caoOrg.didDoc.id}#caoid`,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${organization.didDoc.id}/services`,
          payload,
        });
        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          service: payload,
        });
        const orgDb = await getOrganizationFromDb(organization.didDoc.id);
        expect(orgDb).toMatchObject({
          services: expectedServices([payload]),
        });
      });

      it('Should not add service to organization service when reference does not point at cao service using DID:WEB', async () => {
        nock(didWebUrl(expectedDidWebDoc))
          .get('/.well-known/did.json')
          .reply(200, {
            ...expectedDidWebDoc,
            service: [
              {
                id: '#issue-1',
                type: ServiceTypes.IdDocumentIssuerType,
                serviceEndpoint: 'https://agent.samplevendor.com/acme',
              },
            ],
          });

        await persistOrganizationKey({
          organization,
          id: expectedDidWebDoc.verificationMethod[0].id,
          purposes: [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.EXCHANGES,
            KeyPurposes.ISSUING_METADATA,
          ],
        });

        const caoService = {
          id: '#caoid',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://www.acme.com',
        };

        const caoOrg = await persistOrganization({
          service: [caoService],
          keys: [
            buildOrgFactoryKey({
              id: '#eth-account-key-1',
              purposes: [
                KeyPurposes.DLT_TRANSACTIONS,
                KeyPurposes.ISSUING_METADATA,
                KeyPurposes.EXCHANGES,
              ],
            }),
          ],
        });
        const payload = {
          id: '#issue-1',
          type: ServiceTypes.CareerIssuerType,
          serviceEndpoint: `${caoOrg.didDoc.id}#wrong-service-id`,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${organization.didDoc.id}/services`,
          payload,
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'service_endpoint_ref_not_found',
            message: 'Service endpoint is not pointing to CAO',
            statusCode: 400,
          })
        );
      });
    });
    describe('Organization Service Removal', () => {
      it('Should remove organization service', async () => {
        const monitorNockScope = setMonitorEventsNock();
        const serviceId = '#credentialagent-1';
        const didWebDoc = generateDidWebDoc();
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
            serviceId,
          },
        ];
        organization = await persistOrganization({
          authClients,
          name: 'Did web org',
          didDocId: didWebDoc.id,
          service: [
            {
              id: serviceId,
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          didNotCustodied: true,
        });
        const did = organization.didDoc.id;

        setGetMonitorsNock(did, serviceId);

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}/services/${serviceId.slice(1)}`,
        });

        expect(response.statusCode).toEqual(204);
        expect(response.body).toEqual('');

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          name: 'Did web org',
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: [],
          },
          didDoc: {
            ...organization.didDoc,
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: authClients.slice(0, 1),
          services: [],
          activatedServiceIds: [],
        });
        expect(dbOrg.services.length).toEqual(0);
        expect(mockAuth0ClientGrantDelete.mock.calls).toEqual(
          map(
            (clientGrantId) => [{ id: clientGrantId }],
            authClients[1].clientGrantIds
          )
        );

        expect(mockAuth0ClientDelete.mock.calls).toEqual([
          [{ client_id: authClients[1].clientId }],
        ]);

        expect(monitorDeletionNockExecuted(monitorNockScope)).toEqual(true);

        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
        expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
          address: organization.ids.ethereumAccount,
          scopesToRemove: [
            'transactions:write',
            'credential:identityissue',
            'credential:contactissue',
            'credential:revoke',
            'credential:inspect',
            'credential:issue',
          ],
          scopesToAdd: [],
        });
      });
      it('Should remove additional organization service', async () => {
        const monitorNockScope = setMonitorEventsNock();
        const serviceId = '#credentialagent-1';
        const didWebDoc = generateDidWebDoc();
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
            serviceId,
          },
        ];
        organization = await persistOrganization({
          authClients,
          name: 'Did web org',
          didDocId: didWebDoc.id,
          service: [
            {
              id: serviceId,
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
            {
              id: '#other',
              type: ServiceTypes.CareerIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          didNotCustodied: true,
        });
        const did = organization.didDoc.id;

        setGetMonitorsNock(did, serviceId);

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}/services/${serviceId.slice(1)}`,
        });

        expect(response.statusCode).toEqual(204);
        expect(response.body).toEqual('');

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          ...mongoify(organization),
          name: 'Did web org',
          profile: {
            ...organization.profile,
            permittedVelocityServiceCategory: ['Issuer'],
          },
          didDoc: {
            ...organization.didDoc,
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${did}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: authClients.slice(0, 1),
          services: expectedServices(organization.services.slice(1, 2)),
          activatedServiceIds: ['#other'],
        });
        expect(dbOrg.services.length).toEqual(1);
        expect(mockAuth0ClientGrantDelete.mock.calls).toEqual(
          map(
            (clientGrantId) => [{ id: clientGrantId }],
            authClients[1].clientGrantIds
          )
        );

        expect(mockAuth0ClientDelete.mock.calls).toEqual([
          [{ client_id: authClients[1].clientId }],
        ]);

        expect(monitorDeletionNockExecuted(monitorNockScope)).toEqual(true);

        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
        expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
          address: organization.ids.ethereumAccount,
          scopesToRemove: [
            'credential:identityissue',
            'credential:contactissue',
            'credential:inspect',
          ],
          scopesToAdd: [
            'transactions:write',
            'credential:revoke',
            'credential:issue',
          ],
        });
      });
    });
    describe('Organization Service Retrieval', () => {
      it('Should return organization service', async () => {
        const serviceIdFragment = 'service-1';
        const service = {
          id: `#${serviceIdFragment}`,
          type: ServiceTypes.IdDocumentIssuerType,
          serviceEndpoint: 'https://www.acme.com',
          credentialTypes: ['IdDocument'],
        };
        const organizationWithService = await persistOrganization({
          name: 'Did web org',
          didDocId: generateDidWebDoc().id,
          service: [service],
          didNotCustodied: true,
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organizationWithService.didDoc.id}/services/service-1`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(buildPublicService(service));
      });

      it('Should return error when no organization service', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/services/service-1`,
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Not Found',
            errorCode: 'missing_error_code',
            message: 'Organization service not found',
            statusCode: 404,
          })
        );
      });
    });
    describe('Organization Service Modification', () => {
      it('Should error 400 if did doc cannot be resolved', async () => {
        const serviceIdFragment = 'service-1';
        const service = {
          id: `#${serviceIdFragment}`,
          type: ServiceTypes.IdDocumentIssuerType,
          serviceEndpoint: 'https://www.acme.com',
        };
        const organizationWithService = await persistOrganization({
          service: [service],
          name: 'Did web org',
          didDocId: generateDidWebDoc().id,
          didNotCustodied: true,
        });

        const updatedServiceValues = {
          serviceEndpoint: 'https://www.update.acme.com',
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${organizationWithService.didDoc.id}/services/${serviceIdFragment}`,
          payload: updatedServiceValues,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'did_resolution_failed',
            message: `Could not resolve ${organizationWithService.didDoc.id}`,
            statusCode: 400,
          })
        );
      });
      it('Should update organization service', async () => {
        const serviceIdFragment = 'service-1';
        const service = {
          id: `#${serviceIdFragment}`,
          type: ServiceTypes.IdDocumentIssuerType,
          serviceEndpoint: 'https://www.acme.com',
        };
        const didWebDoc = generateDidWebDoc([service]);
        nock(didWebUrl(didWebDoc))
          .get('/.well-known/did.json')
          .reply(200, didWebDoc);
        const organizationWithService = await persistOrganization({
          service: [service],
          name: 'Did web org',
          didDocId: didWebDoc.id,
          didNotCustodied: true,
        });

        const updatedServiceValues = {
          serviceEndpoint: 'https://www.update.acme.com',
          credentialTypes: ['Email', 'IdDocument'],
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${organizationWithService.didDoc.id}/services/${serviceIdFragment}`,
          payload: updatedServiceValues,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(
          buildPublicService({
            ...service,
            ...updatedServiceValues,
          })
        );
      });
    });
    describe('Organization Service Activation', () => {
      it('should 200 and activate service', async () => {
        const service = [
          {
            id: '#test-service-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
          {
            id: '#credentialagent-2',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];
        const didWebDoc = generateDidWebDoc(service);
        const nockData = nock(didWebUrl(didWebDoc))
          .get('/.well-known/did.json')
          .reply(200, didWebDoc);

        const organizationWithService = await persistOrganization({
          authClients: [
            ...map((s) => {
              return buildTestAuthClient(s.id);
            }, service),
            buildTestAuthClient('unrelated-id'),
          ],
          didDocId: didWebDoc.id,
          service,
          activatedServiceIds: [],
          didNotCustodied: true,
        });
        await persistGroup({
          organization: organizationWithService,
        });
        await persistOrganizationKey({
          organization: organizationWithService,
          purposes: [KeyPurposes.DLT_TRANSACTIONS],
          ...didWebDoc.verificationMethod[0],
          publicKey: didWebDoc.verificationMethod[0].publicKeyJwk,
        });

        const did = organizationWithService.didDoc.id;

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${did}/activate-services`,
          payload: { serviceIds: map('id', service) },
        });
        expect(response.json).toEqual({
          profile: {
            ...organizationWithService.profile,
            permittedVelocityServiceCategory: [
              'NodeOperator',
              'CredentialAgentOperator',
            ],
            id: did,
            verifiableCredentialJwt: expect.any(String),
          },
          activatedServiceIds: map('id', service),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });

        expect(response.statusCode).toEqual(200);

        const dbOrg = await getOrganizationFromDb(did);
        expect(dbOrg).toEqual({
          _id: expect.any(ObjectId),
          profile: {
            ...organizationWithService.profile,
            permittedVelocityServiceCategory: [
              'NodeOperator',
              'CredentialAgentOperator',
            ],
          },
          authClients: [
            ...map(
              (s) => ({
                ...buildTestAuthClient(s.id),
                clientGrantIds: [expect.any(String)],
              }),
              service
            ),
            buildTestAuthClient('unrelated-id'),
          ],
          services: expectedServices(service),
          activatedServiceIds: map('id', service),
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          didDoc: expect.any(Object),
          verifiableCredentialJwt: expect.any(String),
          ids: expect.any(Object),
          normalizedProfileName: normalizeProfileName(
            organizationWithService.profile.name
          ),
          didNotCustodied: true,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
        });

        expect(mockAuth0ClientGrantCreate).toBeCalledTimes(2);
        expect(mockAuth0ClientGrantCreate).toHaveBeenNthCalledWith(1, {
          client_id: first(dbOrg.authClients).clientId,
          audience: fastify.config.blockchainApiAudience,
          scope: ['*:*'],
        });
        expect(mockAuth0ClientGrantCreate).toHaveBeenNthCalledWith(2, {
          client_id: dbOrg.authClients[1].clientId,
          audience: fastify.config.blockchainApiAudience,
          scope: ['eth:*'],
        });
        expect(nockData.isDone()).toEqual(true);
      });
      it('Should 400 error if DLT_TRANSACTIONS key is not present', async () => {
        const service = [
          {
            id: '#test-service-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
          {
            id: '#credentialagent-2',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];
        const didWebDoc = generateDidWebDoc(service);
        const nockData = nock(didWebUrl(didWebDoc))
          .get('/.well-known/did.json')
          .reply(200, didWebDoc);

        const organizationWithService = await persistOrganization({
          authClients: [
            ...map((s) => {
              return buildTestAuthClient(s.id);
            }, service),
            buildTestAuthClient('unrelated-id'),
          ],
          didDocId: didWebDoc.id,
          service,
          activatedServiceIds: [],
          didNotCustodied: true,
        });
        await persistGroup({
          organization: organizationWithService,
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${didWebDoc.id}/activate-services`,
          payload: { serviceIds: map('id', service) },
        });
        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'No required purpose for service',
          },
        });
        expect(nockData.isDone()).toEqual(true);
      });

      it('Should 400 error if service not in db', async () => {
        const service = [
          {
            id: '#test-service-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
          {
            id: '#credentialagent-2',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];
        const didWebDoc = generateDidWebDoc(service);

        const organizationWithService = await persistOrganization({
          didDocId: didWebDoc.id,
          didNotCustodied: true,
        });
        await persistGroup({
          organization: organizationWithService,
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${didWebDoc.id}/activate-services`,
          payload: { serviceIds: map('id', service) },
        });
        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'Organization service not found',
          },
        });
      });
      it('Should 400 error if service not on did doc', async () => {
        const service = [
          {
            id: '#test-service-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
          {
            id: '#credentialagent-2',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];
        const didWebDoc = generateDidWebDoc();
        const nockData = nock(didWebUrl(didWebDoc))
          .get('/.well-known/did.json')
          .reply(200, didWebDoc);

        const organizationWithService = await persistOrganization({
          authClients: [
            ...map((s) => {
              return buildTestAuthClient(s.id);
            }, service),
            buildTestAuthClient('unrelated-id'),
          ],
          didDocId: didWebDoc.id,
          service,
          activatedServiceIds: [],
          didNotCustodied: true,
        });
        await persistGroup({
          organization: organizationWithService,
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${didWebDoc.id}/activate-services`,
          payload: { serviceIds: map('id', service) },
        });
        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'Service with ID #test-service-1 does not exist',
          },
        });
        expect(nockData.isDone()).toEqual(true);
      });
    });
    describe('Organization Service Deactivation', () => {
      it('Deactivate a CAO service from an org with one CAO service', async () => {
        const serviceId = '#credentialagent-1';
        const authClients = [
          {
            type: 'auth0',
            clientType: AuthClientTypes.CAO_NODE_CLIENT,
            clientId: nanoid(),
            clientGrantIds: [nanoid(), nanoid()],
            serviceId,
          },
        ];
        const service = {
          id: serviceId,
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const didWebDoc = generateDidWebDoc([service]);
        const organizationWithService = await persistOrganization({
          authClients,
          didDocId: didWebDoc.id,
          service: [service],
          activatedServiceIds: [serviceId],
          didNotCustodied: true,
        });
        await persistOrganizationKey({
          organization: organizationWithService,
          purposes: [KeyPurposes.DLT_TRANSACTIONS],
          ...didWebDoc.verificationMethod[0],
          publicKey: didWebDoc.verificationMethod[0].publicKeyJwk,
        });
        const nockData = nock(didWebUrl(didWebDoc))
          .get('/.well-known/did.json')
          .reply(200, didWebDoc);
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${didWebDoc.id}/deactivate-services`,
          payload: {
            serviceIds: [serviceId],
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          profile: {
            id: didWebDoc.id,
            ...organizationWithService.profile,
            permittedVelocityServiceCategory: [],
          },
          activatedServiceIds: [],
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });

        const dbOrg = await getOrganizationFromDb(didWebDoc.id);
        expect(dbOrg).toEqual({
          ...mongoify(organizationWithService),
          profile: {
            ...organizationWithService.profile,
            permittedVelocityServiceCategory: [],
          },
          signedProfileVcJwt: {
            credentialId: expect.any(String),
            signedCredential: expect.any(String),
          },
          verifiableCredentialJwt: `http://localhost.test/api/v0.6/organizations/${didWebDoc.id}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          authClients: [
            {
              ...authClients[0],
              clientGrantIds: [],
            },
          ],
          activatedServiceIds: [],
        });

        expect(mockAuth0ClientGrantDelete.mock.calls).toEqual(
          map(
            (clientGrantId) => [{ id: clientGrantId }],
            authClients[0].clientGrantIds
          )
        );
        expect(mockAuth0ClientDelete).toHaveBeenCalledTimes(0);

        expect(mockUpdateAddressScopes).toHaveBeenCalledTimes(1);
        expect(mockUpdateAddressScopes).toHaveBeenCalledWith({
          address: organizationWithService.ids.ethereumAccount,
          scopesToRemove: [
            'transactions:write',
            'credential:identityissue',
            'credential:contactissue',
            'credential:revoke',
            'credential:inspect',
            'credential:issue',
          ],
          scopesToAdd: [],
        });
        expect(nockData.isDone()).toEqual(true);
      });
      it('Deactivate should throw error service is not present on db', async () => {
        const serviceId = '#credentialagent-1';
        const authClients = [
          {
            type: 'auth0',
            clientType: AuthClientTypes.CAO_NODE_CLIENT,
            clientId: nanoid(),
            clientGrantIds: [nanoid(), nanoid()],
            serviceId,
          },
        ];

        const service = {
          id: serviceId,
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const didWebDoc = generateDidWebDoc([service]);
        await persistOrganization({
          authClients,
          didDocId: didWebDoc.id,
          didNotCustodied: true,
        });
        const nockData = nock(didWebUrl(didWebDoc))
          .get('/.well-known/did.json')
          .reply(200, didWebDoc);

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}/${didWebDoc.id}/deactivate-services`,
          payload: {
            serviceIds: [serviceId],
          },
        });
        expect(response).toMatchObject({
          statusCode: 400,
          json: {
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: `Service #credentialagent-1 was not found in activated services of the organization ${didWebDoc.id}`,
          },
        });
        expect(nockData.isDone()).toEqual(true);
      });
    });
  });
});

const buildTestAuthClient = (id) => {
  return {
    type: 'auth0',
    clientType: 'foo',
    serviceId: id,
    clientId: `clientId${id}`,
  };
};

const buildOrgFactoryKey = ({ id, purposes }) => {
  return {
    id,
    purposes,
    type: 'JsonWebKey2020',
    publicKey: generateKeyPair({ format: 'jwk' }).publicKey,
    algorithm: KeyAlgorithms.SECP256K1,
  };
};

const expectedServices = (services, { invitation } = {}) => {
  return flow(
    castArray,
    map((service) => {
      const result = {
        ...omit(['invitationCode'], service),
        id: toRelativeServiceId(service.id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };
      if (invitation != null) {
        result.invitationId = new ObjectId(invitation._id);
      }
      return result;
    })
  )(services);
};

const expectedConsents = (organization, services, user) =>
  map(
    (service) => ({
      _id: expect.any(ObjectId),
      consentId: expect.any(String),
      organizationId: new ObjectId(organization._id),
      serviceId: service.id,
      type: getServiceConsentType(service),
      version: 1,
      userId: user.sub,
      createdAt: expect.any(Date),
    }),
    services
  );
