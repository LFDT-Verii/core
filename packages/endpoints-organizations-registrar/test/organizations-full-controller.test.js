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

const mockSendError = mock.fn(() => {
  console.log('sendError test');
});
const mockInitSendError = mock.fn(() =>
  Promise.resolve({
    sendError: mockSendError,
    startProfiling: () => {
      console.log('fake start sentry profiling');
    },
    finishProfiling: () => {
      console.log('fake finish sentry profiling');
    },
  }),
);

mock.module('@verii/error-aggregation', {
  namedExports: {
    initSendError: mockInitSendError,
  },
});

const mockAuth0ClientDelete = mock.fn(async ({ id }) => {
  console.log(`deleting auth0 client ${id}`);
});
const mockAuth0ClientGrantDelete = mock.fn(async ({ id }) => {
  console.log(`deleting auth0 client grant ${id}`);
});
const mockAuth0ClientCreate = mock.fn(async (obj) => {
  const id = nanoid();
  console.log(`create auth0 client ${id}`);
  return { data: { client_id: id, client_secret: nanoid(), ...obj } };
});
const mockAuth0ClientGrantCreate = mock.fn(async (obj) => {
  const id = nanoid();
  console.log(`create auth0 clientGrant ${id}`);
  return { data: { id: nanoid(), ...obj } };
});
const mockAuth0UserUpdate = mock.fn(async ({ id }, obj) => {
  console.log(`update auth0 user ${id}`);
  return { data: { id, ...obj } };
});
const mockAuth0GetUsers = mock.fn(() =>
  Promise.resolve({
    data: [{ email: '0@localhost.test' }, { email: '1@localhost.test' }],
  }),
);
const mockAuth0GetUser = mock.fn(() =>
  Promise.resolve({ data: { email: 'admin@localhost.test' } }),
);

class ManagementClient {
  constructor() {
    this.clients = {
      create: mockAuth0ClientCreate,
      delete: mockAuth0ClientDelete,
    };
    this.clientGrants = {
      create: mockAuth0ClientGrantCreate,
      delete: mockAuth0ClientGrantDelete,
    };
    this.users = {
      get: mockAuth0GetUser,
      update: mockAuth0UserUpdate,
    };
    this.getUsers = mockAuth0GetUsers;
  }
}
mock.module('auth0', {
  namedExports: {
    ManagementClient,
  },
});

const mockAddPrimary = mock.fn(() => Promise.resolve(undefined));
const mockAddOperator = mock.fn(() => Promise.resolve(undefined));
const mockRemoveOperator = mock.fn(() => Promise.resolve(undefined));
const mockUpdateAddressScopes = mock.fn(() => Promise.resolve(undefined));
const mockInitPermission = mock.fn(() =>
  Promise.resolve({
    addPrimary: mockAddPrimary,
    addOperatorKey: mockAddOperator,
    removeOperatorKey: mockRemoveOperator,
    updateAddressScopes: mockUpdateAddressScopes,
  }),
);
mock.module('@verii/contract-permissions', {
  namedExports: {
    ...require('../../contract-permissions/src/constants'),
    initPermissions: mockInitPermission,
  },
});

const mockCreateFineractClient = mock.fn();
const mockCreateStakesAccount = mock.fn();
mock.module('@verii/fineract-client', {
  namedExports: {
    createFineractClient: mockCreateFineractClient,
    createStakesAccount: mockCreateStakesAccount,
  },
});

class SESClient {}
const mockSESSendEmail = mock.fn((payload) => payload);
SESClient.prototype.send = mockSESSendEmail;
mock.module('@aws-sdk/client-ses', {
  namedExports: {
    SendEmailCommand: class SendEmailCommand {
      constructor(args) {
        return args;
      }
    },
    SESClient,
  },
});

const csvParser = require('@verii/csv-parser');

const parseToCsvSpy = mock.fn(csvParser.parseToCsv);
mock.module('@verii/csv-parser', {
  namedExports: { parseToCsv: parseToCsvSpy },
});

const {
  castArray,
  compact,
  first,
  flow,
  includes,
  last,
  map,
  kebabCase,
  omit,
  reverse,
  uniq,
  some,
  isEmpty,
  pick,
  forEach,
  reject,
  without,
} = require('lodash/fp');
const { nanoid } = require('nanoid');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const {
  KeyPurposes,
  generateKeyPair,
  decryptCollection,
} = require('@verii/crypto');
const { decodeCredentialJwt, hexFromJwk } = require('@verii/jwt');
const { mapWithIndex, runSequentially } = require('@verii/common-functions');
const { toRelativeKeyId } = require('@verii/did-doc');
const {
  DID_FORMAT,
  ISO_DATETIME_FORMAT,
  UUID_FORMAT,
  ETHEREUM_ADDRESS_FORMAT,
  AUTH0_USER_ID_FORMAT,
} = require('@verii/test-regexes');
const {
  generateOrganizationKeyMatcher,
  testRegistrarSuperUser,
  testReadOrganizationsUser,
  testWriteOrganizationsUser,
  testNoGroupRegistrarUser,
  mongoify,
  errorResponseMatcher,
} = require('@verii/tests-helpers');
const {
  ServiceTypes,
  ServiceCategories,
  ServiceTypeToCategoryMap,
} = require('@verii/organizations-registry');

const console = require('console');

const nock = require('nock');
const { subDays } = require('date-fns/fp');
const { ObjectId } = require('mongodb');
const { NANO_ID_FORMAT } = require('@verii/test-regexes/src/regexes');
const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');
const initImageFactory = require('../src/entities/images/factories/images-factory');
const initGroupsFactory = require('../src/entities/groups/factories/groups-factory');
const initInvitationsFactory = require('../src/entities/invitations/factories/invitations-factory');
const {
  sendServicesActivatedEmailMatcher,
  expectedSupportEmail,
  expectedSignatoryApprovalEmail,
  expectedInvitationAcceptanceEmail,
  sendServicesActivatedEmailToCAOsMatcher,
  expectedServiceActivationRequiredEmail,
} = require('./helpers/email-matchers');
const { mapResponseKeyToDbKey } = require('./helpers/map-response-key-to-db');
const buildFastify = require('./helpers/build-fastify');
const organizationKeysRepoPlugin = require('../src/entities/organization-keys/repos/repo');
const organizationsRepoPlugin = require('../src/entities/organizations/repos/repo');
const groupsRepoPlugin = require('../src/entities/groups/repo');
const imagesRepoPlugin = require('../src/entities/images/repo');

const {
  ImageState,
  findKeyByPurpose,
  buildPublicServices,
  buildFullOrganizationResponse,
  didDocServiceFields,
  normalizeProfileName,
  VNF_GROUP_ID_CLAIM,
  getServiceConsentType,
} = require('../src/entities');
const { Authorities } = require('../src');

const fullUrl = '/api/v0.6/organizations/full';

const mockCreateFineractClientReturnValue = {
  fineractClientId: '11',
  tokenAccountId: '12',
  escrowAccountId: '13',
};

const serviceAgentVersionMock = '0.9.0-build.abc12345';

const setServicePingNock = (
  serviceEndpoint,
  // eslint-disable-next-line default-param-last
  versionFlag = true,
  statusCode,
  delay = 10,
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
      `Welcome to Credential APIs\nHost: https://devagent.velocitycareerlabs.io ${version}`,
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

const nockExecuted = (pendingMockString) => (nockScope) => {
  const pendingMocks = nockScope.pendingMocks();
  return !some((element) => includes(pendingMockString, element), pendingMocks);
};

const postMonitorNockExecuted = nockExecuted(
  'POST https://betteruptime.com:443/api/v2/monitors',
);

const idsMatcher = ({ did, services, includeMongoId = false } = {}) => {
  const ids = {
    did: did ?? expect.stringMatching(DID_FORMAT),
    ethereumAccount: expect.stringMatching(ETHEREUM_ADDRESS_FORMAT),
    brokerClientId: expect.anything(),
    ...mockCreateFineractClientReturnValue,
  };

  if (some({ type: ServiceTypes.NodeOperatorType }, services)) {
    ids.stakesAccountId = '20';
  }

  if (includeMongoId) {
    ids.mongoId = expect.any(ObjectId);
  }

  return ids;
};

const publicProfileMatcher = (profile) =>
  omit(
    [
      'adminGivenName',
      'adminFamilyName',
      'adminTitle',
      'adminEmail',
      'signatoryGivenName',
      'signatoryFamilyName',
      'signatoryTitle',
      'signatoryEmail',
    ],
    profile,
  );

describe('Organizations Full Test Suite', () => {
  let fastify;
  let organizationsRepo;
  let organizationKeysRepo;
  let persistOrganization;
  let newOrganization;
  let persistGroup;
  let groupsRepo;
  let persistInvitation;
  let invitationCollection;
  let persistImage;
  let imagesRepo;
  const persistIndexedOrganizationWithIssuerService = async (identifier) => {
    const service = {
      type: ServiceTypes.CareerIssuerType,
      credentialTypes: ['EducationDegree'],
      serviceEndpoint: `https://agent.samplevendor.com/acme/api/${identifier}/get-credential-manifest`,
    };
    return persistIndexedOrganizationWithServices(identifier, [service]);
  };

  const persistIndexedOrganizationWithServices = async (
    identifier,
    services,
  ) => {
    const newServices = mapWithIndex((service, idx) => {
      return {
        id: `#${kebabCase(service.type.slice(0, -3))}-${idx + 1}`,
        ...service,
      };
    }, services);
    const organization = await persistOrganization({
      service: newServices,
      name: `Test Organization${identifier}`,
      commercialEntities: [
        {
          type: 'Brand',
          name: `commercialName ${identifier}`,
          logo: 'http://img.com/commercialLogo.png',
        },
      ],
    });
    return {
      organization,
      services: organization.services,
    };
  };

  const getOrganizationFromDb = (did) =>
    mongoDb().collection('organizations').findOne({
      'didDoc.id': did,
    });

  const getConsentsFromDb = ({ _id }) =>
    mongoDb()
      .collection('registrarConsents')
      .find({ organizationId: _id })
      .toArray();

  const clearDb = async () => {
    await mongoDb().collection('organizations').deleteMany({});
    await mongoDb().collection('organizationKeys').deleteMany({});
    await mongoDb().collection('kms').deleteMany({});
    await mongoDb().collection('groups').deleteMany({});
    await mongoDb().collection('invitations').deleteMany({});
    await mongoDb().collection('images').deleteMany({});
    await mongoDb().collection('registrarConsents').deleteMany({});
  };

  const getKeysFromDb = async (organization) => {
    const sort = {
      id: -1,
    };
    const projection = {
      id: 1,
      key: 1,
      purposes: 1,
      algorithm: 1,
      encoding: 1,
      publicKey: 1,
      controller: 1,
      custodied: 1,
    };

    const dbKeys = await organizationKeysRepo.find(
      {
        filter: {
          organizationId: organization._id,
        },
        sort,
      },
      projection,
    );

    return map((dbKey) => {
      const key =
        dbKey.key != null
          ? JSON.parse(decryptCollection(dbKey.key, fastify.config.mongoSecret))
          : undefined;
      return {
        ...dbKey,
        key,
      };
    }, dbKeys);
  };

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistOrganization, newOrganization } =
      initOrganizationFactory(fastify));
    ({ persistGroup } = initGroupsFactory(fastify));
    ({ persistInvitation } = initInvitationsFactory(fastify));
    ({ persistImage } = initImageFactory(fastify));

    invitationCollection = mongoDb().collection('invitations');
    organizationsRepo = organizationsRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });
    organizationKeysRepo = organizationKeysRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });
    imagesRepo = imagesRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });
    groupsRepo = groupsRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });

    await mongoDb().collection('credentialSchemas').deleteMany({});
    await mongoDb()
      .collection('credentialSchemas')
      .insertMany([
        { credentialType: 'EducationDegree' },
        { credentialType: 'PastEmploymentPosition' },
        { credentialType: 'DriversLicenseV1.0' },
      ]);
  }, 20000);

  beforeEach(async () => {
    mockAddPrimary.mock.resetCalls();
    mockAddOperator.mock.resetCalls();
    mockAuth0ClientCreate.mock.resetCalls();
    mockAuth0ClientGrantCreate.mock.resetCalls();
    mockAuth0UserUpdate.mock.resetCalls();
    mockCreateStakesAccount.mock.resetCalls();
    mockCreateStakesAccount.mock.mockImplementation(() =>
      Promise.resolve('foo'),
    );
    mockInitPermission.mock.resetCalls();
    mockSESSendEmail.mock.resetCalls();
    mockUpdateAddressScopes.mock.resetCalls();
    parseToCsvSpy.mock.resetCalls();
    nock.cleanAll();
  });

  after(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
    mock.reset();
  });

  describe('Organization Modifications', () => {
    let orgProfile;
    before(async () => {
      const org = await newOrganization();
      orgProfile = omit(['id', 'createdAt', 'updatedAt'], org.profile);
    });

    beforeEach(async () => {
      await clearDb();
      mockCreateFineractClient.mock.mockImplementation(
        () => mockCreateFineractClientReturnValue,
      );
    });

    describe('CREATE FULL Organizations', () => {
      it('Should return 400 when request is malformed', async () => {
        const monitorNockScope = setMonitorEventsNock();
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload: {},
        });

        expect(response.statusCode).toEqual(400);

        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(false);
      });

      it('Should return 400 when organization profile is malformed', async () => {
        const monitorNockScope = setMonitorEventsNock();
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload: { profile: 'MALFORMED' },
        });

        expect(response.statusCode).toEqual(400);

        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(false);
      });

      it('Should return 400 when service endpoint is malformed', async () => {
        const monitorNockScope = setMonitorEventsNock();
        const payload = {
          profile: orgProfile,
          serviceEndpoints: ['MALFORMED'],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
        });

        expect(response.statusCode).toEqual(400);

        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(false);
      });

      it('Should 400 when service endpoint is bad protocol', async () => {
        const service1 = {
          id: '#credentialagent-1',
          type: ServiceTypes.NodeOperatorType,
          serviceEndpoint: 'https://node.example.com',
        };
        const service2 = {
          id: '#credentialagent-2',
          type: ServiceTypes.CareerIssuerType,
          serviceEndpoint: 'http://node2.example.com',
        };

        const payload = {
          profile: orgProfile,
          serviceEndpoints: [service1, service2],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          'serviceEndpoint is invalid format',
        );
      });

      it('Should return 400 when service endpoint is missing', async () => {
        const service1 = {
          id: '#credentialagent-1',
          type: ServiceTypes.CareerIssuerType,
        };

        const payload = {
          profile: orgProfile,
          serviceEndpoints: [service1],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'service_endpoint_required',
            message: 'Service must have a serviceEndpoint',
            statusCode: 400,
          }),
        );
      });

      it('Should return 400 when service type is missing', async () => {
        const service1 = {
          id: '#credentialagent-1',
          serviceEndpoint: 'did:test:foo#node-service',
        };

        const payload = {
          profile: orgProfile,
          serviceEndpoints: [service1],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'type_required',
            message: 'Service must have a type',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 when service operator uses did endpoint', async () => {
        const service1 = {
          id: '#credentialagent-1',
          type: ServiceTypes.NodeOperatorType,
          serviceEndpoint: 'did:test:foo#node-service',
        };
        const payload = {
          profile: orgProfile,
          serviceEndpoints: [service1],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          'serviceEndpoint is invalid format',
        );
      });

      describe('Create Organization with Wallet Provider service Test Suite', () => {
        it('Should 400 when HolderAppProvider is missing logoUrl property', async () => {
          const service1 = {
            id: '#wallet-provider-1',
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            playStoreUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
          };
          const payload = {
            profile: orgProfile,
            serviceEndpoints: [service1],
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
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
            }),
          );
        });

        it('Should 400 when HolderAppProvider is missing playStoreUrl property', async () => {
          const service1 = {
            id: '#wallet-provider-1',
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
            logoUrl: 'http://example.com/logo',
            name: 'fooWallet',
          };
          const payload = {
            profile: orgProfile,
            serviceEndpoints: [service1],
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
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
            }),
          );
        });

        it('Should 400 when HolderAppProvider is missing appleAppStoreUrl property', async () => {
          const service1 = {
            id: '#wallet-provider-1',
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            playStoreUrl: 'http://example.com/play-store',
            appleAppId: 'com.example.app',
            googlePlayId: 'com.example.app',
            logoUrl: 'http://example.com/logo',
            name: 'fooWallet',
          };
          const payload = {
            profile: orgProfile,
            serviceEndpoints: [service1],
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
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
            }),
          );
        });

        it('Should 400 when HolderAppProvider is missing appleAppId property', async () => {
          const service1 = {
            id: '#wallet-provider-1',
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            playStoreUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            googlePlayId: 'com.example.app',
            logoUrl: 'http://example.com/logo',
            name: 'fooWallet',
          };
          const payload = {
            profile: orgProfile,
            serviceEndpoints: [service1],
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
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
            }),
          );
        });

        it('Should 400 when HolderAppProvider is missing googlePlayId property', async () => {
          const service1 = {
            id: '#wallet-provider-1',
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            playStoreUrl: 'http://example.com/play-store',
            appleAppStoreUrl: 'http://example.com/apple-app-store',
            appleAppId: 'com.example.app',
            logoUrl: 'http://example.com/logo',
            name: 'fooWallet',
          };
          const payload = {
            profile: orgProfile,
            serviceEndpoints: [service1],
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
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
            }),
          );
        });

        it('Should 400 when WebWalletProvider is missing name property', async () => {
          const service1 = {
            id: '#wallet-provider-1',
            type: ServiceTypes.WebWalletProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            logoUrl: 'http://example.com/logo',
          };
          const payload = {
            profile: orgProfile,
            serviceEndpoints: [service1],
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: { 'x-auto-activate': '1' },
          });
          expect(response.statusCode).toEqual(400);
          expect(response.json).toEqual(
            errorResponseMatcher({
              error: 'Bad Request',
              errorCode: 'missing_error_code',
              message: 'VlcWebWalletProvider_v1 service type requires "name"',
              statusCode: 400,
            }),
          );
        });

        it('Should add organization service type WebWalletProvider', async () => {
          const service1 = {
            id: '#wallet-provider-1',
            type: ServiceTypes.WebWalletProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            logoUrl: 'http://example.com/logo',
            name: 'fooWallet',
            supportedExchangeProtocols: ['VN_API'],
          };
          const payload = {
            profile: orgProfile,
            serviceEndpoints: [service1],
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: { 'x-auto-activate': '1' },
          });

          expect(response.statusCode).toEqual(201);
          const did = response.json.id;
          const prefixedServices = [service1];

          expect(did).toMatch(DID_FORMAT);
          expect(response.json).toEqual(
            expectedCreateFullOrganizationResponse(
              did,
              orgProfile,
              prefixedServices,
            ),
          );

          const orgFromDb = await getOrganizationFromDb(did);
          expect(orgFromDb).toEqual(
            expectedOrganization(did, orgProfile, prefixedServices, {
              activatedServiceIds: [service1.id],
              authClients: response.json.authClients,
            }),
          );
        });
      });

      it('Should 400 with an unrecognized authority', async () => {
        const monitorNockScope = setMonitorEventsNock();
        const payload = {
          profile: {
            ...orgProfile,
            registrationNumbers: [
              {
                ...orgProfile.registrationNumbers[0],
                authority: 'not-an-authority',
              },
            ],
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            statusCode: 400,
            errorCode: 'request_validation_failed',
            message: expect.stringMatching(
              /^body\/profile\/registrationNumbers\/[\d]\/authority must be equal to one of the allowed values$/g,
            ),
          }),
        );
        const organizationDocumentCount = await mongoDb()
          .collection('organizations')
          .countDocuments();

        expect(organizationDocumentCount).toEqual(0);

        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(false);
      });

      it('Should 400 with profile as payload', async () => {
        const monitorNockScope = setMonitorEventsNock();
        const payload = orgProfile;
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
        });
        expect(response.statusCode).toEqual(400);

        const orgsInDbcount = await organizationsRepo.count({});
        expect(orgsInDbcount).toEqual(0);
        const orgKeysInDbcount = await organizationsRepo.count({});
        expect(orgKeysInDbcount).toEqual(0);

        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(false);
      });

      it('Should 400 with unsupported organization type', async () => {
        const profile = { ...orgProfile, ...{ type: 'non-exist' } };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
      });

      it('Should 400 without description in profile', async () => {
        const profile = { ...orgProfile, ...{ contactEmail: undefined } };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'contactEmail'",
        );
      });

      it('Should 400 without description in profile', async () => {
        const profile = { ...orgProfile, ...{ description: undefined } };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'description'",
        );
      });

      it('Should 400 without contactEmail in profile', async () => {
        const profile = { ...orgProfile, ...{ contactEmail: undefined } };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'contactEmail'",
        );
      });

      it('Should 400 with contactEmail wrong email format in profile', async () => {
        const profile = { ...orgProfile, ...{ contactEmail: 'undefined' } };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          'body/profile/contactEmail must match format "email"',
        );
      });

      it('Should 400 with technicalEmail wrong email format in profile', async () => {
        const profile = { ...orgProfile, ...{ technicalEmail: 'undefined' } };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          'body/profile/technicalEmail must match format "email"',
        );
      });

      it('Should 400 with long profile name ', async () => {
        const profile = {
          ...orgProfile,
          ...{
            // eslint-disable-next-line max-len
            name: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenatis vitae, justo. Nullam dictum felis eu pede mollis pretium. Integer tincidunt. Cras dapibus. Vivamus elementum semper nisi. Aenean vulputate eleifend tellus. Aenean leo ligula, porttitor eu, consequat vitae, eleifend ac, enim. Aliquam lorem ante, dapibus in, viverra quis, feugiat a, tellus. Phasellus viverra nulla ut metus varius laoreet. Quisque rutrum. Aenean imperdiet. Etiam ultricies nisi vel augue. Curabitur ullamcorper ultricies nisi. Nam eget dui. Etiam rhoncus. Maecenas tempus, tellus eget condimentum rhoncus, sem quam semper libero, sit amet adipiscing sem neque sed ipsum. Nam quam nunc, blandit vel, luctus pulvinar, hendrerit id, lorem. Maecenas nec odio et ante tincidunt tempus. Donec vitae sapien ut libero venenatis faucibus. Nullam quis ante. Etiam sit amet orci eget eros faucibus tincidunt. Duis leo. Sed fringilla mauris sit amet nibh. Donec sodales sagittis magna. Sed consequat, leo eget bibendum sodales, augue velit cursus nunc, ',
          },
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          'body/profile/name must NOT have more than 100 characters',
        );
      });

      it('Should 400 with duplicate profile name ', async () => {
        const profile = {
          ...orgProfile,
          ...{
            name: 'Gabriel Biggus Antonius',
          },
        };

        await persistOrganization({
          name: 'gabriel biggus antonius',
          normalizedProfileName: 'gabriel biggus antonius',
        });

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'name_change_forbidden',
            message: 'Organization name already exists',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 with duplicate profile name and payload with empty spaces and different letter cases', async () => {
        await persistOrganization({
          name: 'gabriel biggus antonius',
          normalizedProfileName: 'gabriel biggus antonius',
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload: {
            profile: {
              ...orgProfile,
              name: ' Gabriel \t    Biggus \n Antonius',
            },
          },
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'name_change_forbidden',
            message: 'Organization name already exists',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 with duplicate profile name and payload with special regexp characters', async () => {
        await persistOrganization({
          name: 'gabriel! biggus* antonius?',
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload: {
            profile: {
              ...orgProfile,
              name: ' gabriel!     \t biggus* \n AntoNius?',
            },
          },
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'name_change_forbidden',
            message: 'Organization name already exists',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 with duplicate profile name if db record contains empty spaces and special character', async () => {
        await persistOrganization({
          name: 'gabriel biggus*** antonius',
          normalizedProfileName: 'gabriel biggus*** antonius',
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload: {
            profile: {
              ...orgProfile,
              name: '  Gabriel Biggus*** \t Antonius  ',
            },
          },
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'name_change_forbidden',
            message: 'Organization name already exists',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 if contactEmail is empty ', async () => {
        const profile = {
          ...omit(['contactEmail'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'contactEmail'",
        );
      });

      it('Should 400 if technicalEmail is empty ', async () => {
        const profile = {
          ...omit(['technicalEmail'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'technicalEmail'",
        );
      });

      it('Should 400 if description is empty', async () => {
        const profile = {
          ...omit(['description'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'description'",
        );
      });

      it('Should 400 if commercialEntities info is invalid', async () => {
        const payload = {
          profile: {
            ...orgProfile,
            commercialEntities: [
              {
                type: 'Brand',
                name: 'mock',
                logo: 'not-url',
              },
            ],
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toStrictEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              'body/profile/commercialEntities/0/logo must match format "uri"',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 if adminGivenName is empty', async () => {
        const profile = {
          ...omit(['adminGivenName'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-validate-kyb-profile': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'adminGivenName'",
        );
      });

      it('Should 400 if adminFamilyName is empty', async () => {
        const profile = {
          ...omit(['adminFamilyName'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-validate-kyb-profile': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'adminFamilyName'",
        );
      });

      it('Should 400 if adminTitle is empty', async () => {
        const profile = {
          ...omit(['adminTitle'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-validate-kyb-profile': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'adminTitle'",
        );
      });

      it('Should 400 if adminEmail is empty', async () => {
        const profile = {
          ...omit(['adminEmail'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-validate-kyb-profile': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'adminEmail'",
        );
      });

      it('Should 400 if signatoryGivenName is empty', async () => {
        const profile = {
          ...omit(['signatoryGivenName'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-validate-kyb-profile': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'signatoryGivenName'",
        );
      });

      it('Should 400 if signatoryFamilyName is empty', async () => {
        const profile = {
          ...omit(['signatoryFamilyName'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-validate-kyb-profile': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'signatoryFamilyName'",
        );
      });

      it('Should 400 if signatoryTitle is empty', async () => {
        const profile = {
          ...omit(['signatoryTitle'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-validate-kyb-profile': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'signatoryTitle'",
        );
      });

      it('Should 400 if signatoryEmail is empty', async () => {
        const profile = {
          ...omit(['signatoryEmail'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-validate-kyb-profile': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'signatoryEmail'",
        );
      });

      it('Should 400 if physicalAddress is empty', async () => {
        const profile = {
          ...omit(['physicalAddress'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-validate-kyb-profile': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'physicalAddress'",
        );
      });

      it('Should 400 if linkedInProfile is empty', async () => {
        const profile = {
          ...omit(['linkedInProfile'], orgProfile),
        };

        const payload = {
          profile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-validate-kyb-profile': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json.message).toEqual(
          "body/profile must have required property 'linkedInProfile'",
        );
      });

      it('Should 400 if profile.logo already active', async () => {
        await persistImage({
          url: 'https://example.com/logo.png',
          state: ImageState.ACTIVE,
        });
        const payload = {
          profile: {
            ...orgProfile,
            logo: 'https://example.com/logo.png',
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'image_already_active',
            message: 'Image already active',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 if profile.website exists already', async () => {
        const organization = await persistOrganization({
          name: 'CAO',
        });
        const payload = {
          profile: { ...orgProfile, website: organization.profile.website },
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'website_already_exists',
            message: 'Website already exists',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 if profile.website lacks https', async () => {
        const payload = {
          profile: { ...orgProfile, website: 'http://foo.example.com' },
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'website_protocol_must_be_https',
            message: 'Website protocol must be https',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 if profile.website is not lowercase', async () => {
        const payload = {
          profile: { ...orgProfile, website: 'https://FOO.example.com' },
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'website_path_must_be_empty',
            message: 'Website must have empty path after domain',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 if profile.website has trailing /', async () => {
        const payload = {
          profile: { ...orgProfile, website: 'https://foo.example.com/' },
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'website_path_must_be_empty',
            message: 'Website must have empty path after domain',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 if profile.website has trailing ?', async () => {
        const payload = {
          profile: { ...orgProfile, website: 'https://foo.example.com?' },
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'website_path_must_be_empty',
            message: 'Website must have empty path after domain',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 if profile.website has path after domain', async () => {
        const payload = {
          profile: { ...orgProfile, website: 'https://foo.example.com/foo' },
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'website_path_must_be_empty',
            message: 'Website must have empty path after domain',
            statusCode: 400,
          }),
        );
      });

      it('Should 400 if profile.website has query parameters', async () => {
        const payload = {
          profile: {
            ...orgProfile,
            website: 'https://foo.example.com/?foo=bar',
          },
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'website_path_must_be_empty',
            message: 'Website must have empty path after domain',
            statusCode: 400,
          }),
        );
      });

      it('Should 201 if profile.website has a port', async () => {
        const payload = {
          profile: { ...orgProfile, website: 'https://foo.example.com:1234' },
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });
        expect(response.statusCode).toEqual(201);
      });

      it('Should create organization and activate image', async () => {
        await persistImage({
          url: 'https://example.com/logo.png',
          state: ImageState.UPLOAD_DONE,
          uploadSucceeded: true,
        });
        const payload = {
          profile: {
            ...orgProfile,
            logo: 'https://example.com/logo.png',
          },
        };
        setMonitorEventsNock();

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        const imageDb = await imagesRepo.findOne({
          url: 'https://example.com/logo.png',
        });
        expect(imageDb).toStrictEqual({
          _id: expect.anything(),
          createdAt: expect.anything(),
          updatedAt: expect.anything(),
          key: 'file-1234567.png',
          state: 'active',
          uploadSucceeded: true,
          uploadUrl: 'http://aws.s3.test/file-1234567.png',
          url: 'https://example.com/logo.png',
          userId: expect.stringMatching(AUTH0_USER_ID_FORMAT),
        });
      });

      it('Should 201 if linkedInProfile is empty but x-validate-kyb-profile=0 is not sent', async () => {
        const profile = {
          ...omit(['linkedInProfile'], orgProfile),
        };

        const payload = {
          profile,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-validate-kyb-profile': '0',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });
        expect(response.statusCode).toEqual(201);
      });

      it('Should create organization, DID & ethereum accounts with default type even if no services or invitation', async () => {
        const monitorNockScope = setMonitorEventsNock();
        const registrationNumbers = [
          {
            authority: Authorities.LinkedIn,
            number: 'foo',
          },
          {
            authority: Authorities.GLEIF,
            number: '1',
            uri: 'uri://uri',
          },
        ];
        const payload = {
          profile: {
            ...omit(['type'], orgProfile),
            registrationNumbers,
          },
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '0',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
            'x-validate-kyb-profile': '1',
          },
        });

        expect(response.statusCode).toEqual(201);
        const did = response.json?.id;

        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(response.json.id, {
            ...orgProfile,
            registrationNumbers,
          }),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, { ...orgProfile, registrationNumbers }),
        );
        const credentialPayload = decodeCredentialJwt(
          orgFromDb.signedProfileVcJwt.signedCredential,
        );
        expect(credentialPayload).toEqual({
          credentialSubject: {
            ...publicProfileMatcher({ ...orgProfile, registrationNumbers }),
            id: did,
            permittedVelocityServiceCategory: [],
          },
          id: expect.stringMatching(UUID_FORMAT),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });

        // key entity checks
        const dbKeys = await getKeysFromDb(orgFromDb);
        expect(dbKeys).toEqual(
          expect.arrayContaining(
            map(mapResponseKeyToDbKey, reverse(response.json.keys)),
          ),
        );
        expect(dbKeys).toHaveLength(5);

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents([]),
        );

        // group entity checks
        expect(await groupsRepo.count({})).toEqual(1);

        // blockchain contract checks
        blockchainContractExpectations(orgFromDb, dbKeys);

        // auth0 checks
        expect(mockAuth0ClientGrantCreate.mock.callCount()).toEqual(0);
        expect(mockAuth0UserUpdate.mock.callCount()).toEqual(0);
        expect(mockUpdateAddressScopes.mock.callCount()).toEqual(1);
        expect(
          mockUpdateAddressScopes.mock.calls.map((call) => call.arguments),
        ).toContainEqual([
          expectedAuth0ScopeChanges(orgFromDb.ids.ethereumAccount),
        ]);

        // monitoring checks
        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(false);

        // email checks
        expect(
          mockSESSendEmail.mock.calls.map((call) => call.arguments),
        ).toEqual(
          expect.arrayContaining([
            [expectedSupportEmail()],
            [expectedSignatoryApprovalEmail(null, orgFromDb)],
          ]),
        );

        expect(parseToCsvSpy.mock.calls[0].arguments).toEqual([
          [
            expect.objectContaining({
              registrationNumbers: reject(
                {
                  authority: Authorities.LinkedIn,
                },
                registrationNumbers,
              ),
            }),
          ],
          expect.any(Array),
        ]);
      });

      it('Should create org with a did service', async () => {
        const monitorNockScope = setMonitorEventsNock();

        const inviterOrganization = await persistOrganization({
          name: 'CAO',
          service: [
            {
              id: '#cao1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://www.cao.com',
            },
          ],
        });

        const service1 = {
          id: '#issuer1',
          type: ServiceTypes.CareerIssuerType,
          serviceEndpoint: `${inviterOrganization.didDoc.id}#cao1`,
        };
        const payload = {
          profile: orgProfile,
          serviceEndpoints: [service1],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });
        expect(response.statusCode).toEqual(201);
        const did = response.json?.id;

        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(did, orgProfile, [service1]),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, orgProfile, [service1]),
        );

        // key entity checks
        const dbKeys = await getKeysFromDb(orgFromDb);
        expect(dbKeys).toEqual(
          expect.arrayContaining(
            map(mapResponseKeyToDbKey, response.json.keys),
          ),
        );
        expect(dbKeys).toHaveLength(5);

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents(orgFromDb, [service1], testNoGroupRegistrarUser),
        );

        // group entity checks
        expect(await groupsRepo.count({})).toEqual(1);

        // blockchain contract checks
        blockchainContractExpectations(orgFromDb, dbKeys);

        // auth0 checks
        expect(mockAuth0ClientGrantCreate.mock.callCount()).toEqual(0);
        expect(mockAuth0UserUpdate.mock.callCount()).toEqual(1);
        expect(mockUpdateAddressScopes.mock.callCount()).toEqual(1);
        expect(
          mockUpdateAddressScopes.mock.calls.map((call) => call.arguments),
        ).toContainEqual([
          expectedAuth0ScopeChanges(orgFromDb.ids.ethereumAccount, [
            'transactions:write',
            'credential:revoke',
            'credential:issue',
          ]),
        ]);

        // monitoring checks
        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(false);

        // email checks
        expect(mockSESSendEmail.mock.callCount()).toEqual(3);
        expect(
          mockSESSendEmail.mock.calls.map((call) => call.arguments),
        ).toEqual(
          expect.arrayContaining([
            [expectedSupportEmail()],
            [expectedSignatoryApprovalEmail(null, orgFromDb)],
          ]),
        );
      });

      it('Should create organization with multiple services and auto activate', async () => {
        const services = [
          {
            id: '#credentialagent-1',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          },
          {
            id: '#issuer-1',
            type: ServiceTypes.CareerIssuerType,
            credentialTypes: ['EducationDegree'],
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          },
          {
            id: '#inspector-1',
            type: ServiceTypes.InspectionType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          },
        ];

        const monitorNockScope = setMonitorEventsNock();

        const payload = {
          profile: orgProfile,
          serviceEndpoints: services,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        const did = response.json?.id;

        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(did, orgProfile, services, {
            authClients: [
              {
                clientId: expect.stringMatching(NANO_ID_FORMAT),
                clientSecret: expect.stringMatching(NANO_ID_FORMAT),
                clientType: 'agent',
                serviceId: '#credentialagent-1',
                type: 'auth0',
              },
            ],
          }),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, orgProfile, services, {
            authClients: response.json.authClients,
          }),
        );

        const credentialPayload = decodeCredentialJwt(
          orgFromDb.signedProfileVcJwt.signedCredential,
        );
        expect(credentialPayload).toEqual({
          credentialSubject: {
            ...publicProfileMatcher(orgProfile),
            id: orgFromDb.didDoc.id,
            permittedVelocityServiceCategory: expect.arrayContaining([
              ServiceCategories.Issuer,
              ServiceCategories.Inspector,
              ServiceCategories.CredentialAgentOperator,
            ]),
          },
          id: expect.stringMatching(UUID_FORMAT),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });

        // key entity checks
        const dbKeys = await getKeysFromDb(orgFromDb);
        expect(dbKeys).toEqual(
          expect.arrayContaining(
            map(mapResponseKeyToDbKey, response.json.keys),
          ),
        );
        expect(dbKeys).toHaveLength(5);

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents(orgFromDb, services, testNoGroupRegistrarUser),
        );

        // group entity checks
        expect(await groupsRepo.count({})).toEqual(1);

        // blockchain contract checks
        blockchainContractExpectations(orgFromDb, dbKeys);

        // auth0 checks
        expect(mockAuth0ClientGrantCreate.mock.callCount()).toEqual(1);
        expect(
          mockAuth0ClientCreate.mock.calls.map((call) => call.arguments),
        ).toEqual([
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
              name: `test-organization-agent-${orgFromDb.didDoc.id}${orgFromDb.didDoc.service[0].id}`,
              oidc_conformant: true,
              token_endpoint_auth_method: 'client_secret_post',
            },
          ],
        ]);
        expect(mockAuth0ClientGrantCreate.mock.callCount()).toEqual(1);
        expect(
          mockAuth0ClientGrantCreate.mock.calls.map((call) => call.arguments),
        ).toContainEqual([
          {
            client_id: last(orgFromDb.authClients).clientId,
            audience: fastify.config.blockchainApiAudience,
            scope: ['eth:*'],
          },
        ]);
        expect(mockAuth0UserUpdate.mock.callCount()).toEqual(1);
        expect(mockUpdateAddressScopes.mock.callCount()).toEqual(1);
        expect(
          mockUpdateAddressScopes.mock.calls.map((call) => call.arguments),
        ).toContainEqual([
          expectedAuth0ScopeChanges(orgFromDb.ids.ethereumAccount, [
            'transactions:write',
            'credential:revoke',
            'credential:issue',
            'credential:inspect',
          ]),
        ]);

        // monitoring checks
        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);

        // email checks
        expect(
          mockSESSendEmail.mock.calls.map((call) => call.arguments),
        ).toEqual(
          expect.arrayContaining([
            [expectedSupportEmail()],
            [expectedSignatoryApprovalEmail(null, orgFromDb)],
            [sendServicesActivatedEmailMatcher()],
          ]),
        );
      });

      it('Should create organization and handle services with cao organization refs', async () => {
        const caoOrganization = await persistOrganization({
          name: 'CAO',
          service: [
            {
              id: '#cao-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://iop.io',
            },
          ],
        });
        await persistGroup({
          organization: caoOrganization,
          groupId: 'did:test:1234',
        });
        const services = [
          {
            id: '#notary-1',
            type: ServiceTypes.NotaryIssuerType,
            serviceEndpoint: `${caoOrganization.didDoc.id}#cao-1`,
          },
          {
            id: '#inspector-1',
            type: ServiceTypes.InspectionType,
            serviceEndpoint: 'https://inspector.com',
          },
        ];
        const payload = {
          profile: orgProfile,
          serviceEndpoints: services,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        const did = response.json.id;

        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(did, orgProfile, services),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, orgProfile, services, {
            authClients: response.json.authClients,
          }),
        );

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents(orgFromDb, services, testNoGroupRegistrarUser),
        );

        expect(mockSESSendEmail.mock.callCount()).toEqual(3);
        expect(
          mockSESSendEmail.mock.calls.map((call) => call.arguments),
        ).toEqual(
          expect.arrayContaining([
            [sendServicesActivatedEmailMatcher()],
            [expectedSupportEmail()],
            [expectedSignatoryApprovalEmail(null, orgFromDb)],
          ]),
        );
      });

      it('Should create organization with two Inspection services without auto-activate', async () => {
        const services = [
          {
            id: '#test-service-1',
            type: ServiceTypes.InspectionType,
            credentialTypes: ['DriversLicenseV1.0'],
            serviceEndpoint: 'https://verifagent.samplevendor.com/acme',
          },
          {
            id: '#test-service-2',
            type: ServiceTypes.InspectionType,
            credentialTypes: ['PhoneV1.0'],
            serviceEndpoint: 'https://verifagent.samplevendor.com/acme',
          },
        ];
        const payload = {
          profile: orgProfile,
          serviceEndpoints: services,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': 0,
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });
        expect(response.statusCode).toEqual(201);
        const did = response.json.id;

        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(did, orgProfile, services, {
            profile: { permittedVelocityServiceCategory: [] },
            activatedServiceIds: [],
          }),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, orgProfile, services, {
            profile: { permittedVelocityServiceCategory: [] },
            activatedServiceIds: [],
          }),
        );

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents(orgFromDb, services, testNoGroupRegistrarUser),
        );

        // auth0 checks
        expect(mockAuth0ClientGrantCreate.mock.callCount()).toEqual(0);
        expect(mockUpdateAddressScopes.mock.callCount()).toEqual(1);
        expect(
          mockUpdateAddressScopes.mock.calls.map((call) => call.arguments),
        ).toContainEqual([
          {
            address: response.json.ids.ethereumAccount,
            scopesToRemove: [
              'transactions:write',
              'credential:identityissue',
              'credential:contactissue',
              'credential:revoke',
              'credential:inspect',
              'credential:issue',
            ],
            scopesToAdd: [],
          },
        ]);
      });

      it('should create org with services even if # isnt specified on the id', async () => {
        const services = [
          {
            id: 'credentialagent-1',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          },
        ];
        const profile = { ...orgProfile, name: 'Super Organization' };

        await persistGroup();
        const payload = {
          profile,
          serviceEndpoints: services,
        };

        setServicePingNock(services[0].serviceEndpoint);
        const monitorNockScope = setMonitorEventsNock();

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': 0,
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });

        expect(response.statusCode).toEqual(201);

        const did = response.json.id;
        const prefixedServices = [{ ...services[0], id: `#${services[0].id}` }];
        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(
            did,
            profile,
            prefixedServices,
            {
              profile: { permittedVelocityServiceCategory: [] },
              activatedServiceIds: [],
              authClients: [
                {
                  clientId: expect.stringMatching(NANO_ID_FORMAT),
                  clientSecret: expect.stringMatching(NANO_ID_FORMAT),
                  clientType: 'agent',
                  serviceId: '#credentialagent-1',
                  type: 'auth0',
                },
              ],
            },
          ),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, profile, prefixedServices, {
            profile: { permittedVelocityServiceCategory: [] },
            activatedServiceIds: [],
            authClients: response.json.authClients,
          }),
        );

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents(
            orgFromDb,
            prefixedServices,
            testNoGroupRegistrarUser,
          ),
        );

        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);

        expect(mockAuth0ClientGrantCreate.mock.callCount()).toEqual(0);

        expect(
          mockSESSendEmail.mock.calls.map((call) => call.arguments),
        ).toEqual(
          expect.arrayContaining([
            [expectedSupportEmail('Super Organization')],
            [expectedSignatoryApprovalEmail(null, orgFromDb)],
            [expectedServiceActivationRequiredEmail],
          ]),
        );
      });

      it('Should create organization that is a Node Operator', async () => {
        mockCreateFineractClient.mock.mockImplementationOnce(() => ({
          ...mockCreateFineractClientReturnValue,
          stakesAccountId: '20',
        }));
        const services = [
          {
            id: '#nodeoperator-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];
        await persistGroup({ skipOrganization: true });
        const profile = { ...orgProfile, name: 'Super Organization' };
        const payload = {
          profile,
          serviceEndpoints: services,
        };

        const monitorNockScope = setMonitorEventsNock();

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        const did = response.json.id;

        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(did, profile, services, {
            authClients: [
              {
                clientId: expect.stringMatching(NANO_ID_FORMAT),
                clientSecret: expect.stringMatching(NANO_ID_FORMAT),
                clientType: 'node',
                serviceId: '#nodeoperator-1',
                type: 'auth0',
              },
            ],
          }),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, profile, services, {
            authClients: response.json.authClients,
          }),
        );

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents(orgFromDb, services, testWriteOrganizationsUser),
        );

        expect(
          mockCreateFineractClient.mock.calls.map((call) => call.arguments),
        ).toContainEqual([
          {
            _id: orgFromDb._id,
            profile: omit(['permittedVelocityServiceCategory'], {
              ...orgProfile,
              name: 'Super Organization',
            }),
            services: expectedServices(services),
            normalizedProfileName: normalizeProfileName('Super Organization'),
            didDoc: response.json.didDoc,
            didNotCustodied: false,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
          true,
          expect.any(Object),
        ]);
        expect(
          mockSESSendEmail.mock.calls.map((call) => call.arguments),
        ).toEqual(
          expect.arrayContaining([[sendServicesActivatedEmailMatcher()]]),
        );
        expect(
          mockAuth0UserUpdate.mock.calls.map((call) => call.arguments),
        ).toEqual([]);
        expect(
          mockAuth0ClientCreate.mock.calls.map((call) => call.arguments),
        ).toEqual([
          [
            {
              app_type: 'non_interactive',
              client_metadata: {
                did,
                service_id: '#nodeoperator-1',
              },
              custom_login_page_on: false,
              description:
                'Administrator for the Node operated by "Super Organization"',
              grant_types: ['client_credentials'],
              is_first_party: true,
              is_token_endpoint_ip_header_trusted: true,
              jwt_configuration: {
                alg: 'RS256',
                lifetime_in_seconds: 36000,
                secret_encoded: true,
              },
              logo_uri: 'http://www.organization.com/logo.png',
              name: `super-organization-node-${orgFromDb.didDoc.id}${services[0].id}`,
              oidc_conformant: true,
              token_endpoint_auth_method: 'client_secret_post',
            },
          ],
        ]);

        expect(mockAuth0ClientGrantCreate.mock.callCount()).toEqual(1);
        expect(
          mockAuth0ClientGrantCreate.mock.calls.map((call) => call.arguments),
        ).toContainEqual([
          {
            client_id: last(orgFromDb.authClients).clientId,
            audience: fastify.config.blockchainApiAudience,
            scope: ['*:*'],
          },
        ]);

        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);
      });

      it('Should create organization with two Node Operator services', async () => {
        mockCreateFineractClient.mock.mockImplementationOnce(() => ({
          ...mockCreateFineractClientReturnValue,
          stakesAccountId: '20',
        }));
        const services = [
          {
            id: '#nodeoperator-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
          {
            id: '#nodeoperator-2',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example2.com',
          },
        ];
        const profile = { ...orgProfile, name: 'Super Organization' };
        await persistGroup({ skipOrganization: true });
        const payload = {
          profile,
          serviceEndpoints: services,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        const did = response.json.id;

        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(did, profile, services, {
            authClients: [
              {
                clientId: expect.stringMatching(NANO_ID_FORMAT),
                clientSecret: expect.stringMatching(NANO_ID_FORMAT),
                clientType: 'node',
                serviceId: '#nodeoperator-1',
                type: 'auth0',
              },
              {
                clientId: expect.stringMatching(NANO_ID_FORMAT),
                clientSecret: expect.stringMatching(NANO_ID_FORMAT),
                clientType: 'node',
                serviceId: '#nodeoperator-2',
                type: 'auth0',
              },
            ],
          }),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, profile, services, {
            authClients: response.json.authClients,
          }),
        );

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents(orgFromDb, services, testWriteOrganizationsUser),
        );

        expect(
          mockCreateFineractClient.mock.calls.map((call) => call.arguments),
        ).toContainEqual([
          {
            _id: orgFromDb._id,
            profile: omit(['permittedVelocityServiceCategory'], {
              ...orgProfile,
              name: 'Super Organization',
            }),
            normalizedProfileName: normalizeProfileName('Super Organization'),
            didDoc: response.json.didDoc,
            didNotCustodied: false,
            services: expectedServices(services),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
          true,
          expect.any(Object),
        ]);
        expect(
          mockSESSendEmail.mock.calls.map((call) => call.arguments),
        ).toEqual(
          expect.arrayContaining([[sendServicesActivatedEmailMatcher()]]),
        );
        expect(
          mockAuth0UserUpdate.mock.calls.map((call) => call.arguments),
        ).toEqual([]);
        expect(
          mockAuth0ClientCreate.mock.calls.map((call) => call.arguments),
        ).toEqual([
          [
            {
              app_type: 'non_interactive',
              client_metadata: {
                did,
                service_id: '#nodeoperator-1',
              },
              custom_login_page_on: false,
              description:
                'Administrator for the Node operated by "Super Organization"',
              grant_types: ['client_credentials'],
              is_first_party: true,
              is_token_endpoint_ip_header_trusted: true,
              jwt_configuration: {
                alg: 'RS256',
                lifetime_in_seconds: 36000,
                secret_encoded: true,
              },
              logo_uri: 'http://www.organization.com/logo.png',
              name: `super-organization-node-${orgFromDb.didDoc.id}${services[0].id}`,
              oidc_conformant: true,
              token_endpoint_auth_method: 'client_secret_post',
            },
          ],
          [
            {
              app_type: 'non_interactive',
              client_metadata: {
                did,
                service_id: '#nodeoperator-2',
              },
              custom_login_page_on: false,
              description:
                'Administrator for the Node operated by "Super Organization"',
              grant_types: ['client_credentials'],
              is_first_party: true,
              is_token_endpoint_ip_header_trusted: true,
              jwt_configuration: {
                alg: 'RS256',
                lifetime_in_seconds: 36000,
                secret_encoded: true,
              },
              logo_uri: 'http://www.organization.com/logo.png',
              name: `super-organization-node-${orgFromDb.didDoc.id}${services[1].id}`,
              oidc_conformant: true,
              token_endpoint_auth_method: 'client_secret_post',
            },
          ],
        ]);

        expect(mockAuth0ClientGrantCreate.mock.callCount()).toEqual(2);
        expect(mockAuth0ClientGrantCreate.mock.calls[0].arguments).toEqual([
          {
            client_id: first(orgFromDb.authClients).clientId,
            audience: fastify.config.blockchainApiAudience,
            scope: ['*:*'],
          },
        ]);
        expect(mockAuth0ClientGrantCreate.mock.calls[1].arguments).toEqual([
          {
            client_id: last(orgFromDb.authClients).clientId,
            audience: fastify.config.blockchainApiAudience,
            scope: ['*:*'],
          },
        ]);
      });

      it('Should create organization with escrow account', async () => {
        const payload = {
          profile: orgProfile,
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        const did = response.json.id;

        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(did, orgProfile),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(expectedOrganization(did, orgProfile));

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents(orgFromDb, [], testNoGroupRegistrarUser),
        );

        expect(
          mockCreateFineractClient.mock.calls.map((call) => call.arguments),
        ).toContainEqual([
          {
            _id: orgFromDb._id,
            profile: omit(['permittedVelocityServiceCategory'], orgProfile),
            didNotCustodied: false,
            didDoc: response.json.didDoc,
            normalizedProfileName: normalizeProfileName(orgProfile.name),
            services: [],
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
          false,
          expect.any(Object),
        ]);
      });

      it('Should create organization even if auth client fails', async () => {
        await persistGroup({ skipOrganization: true });

        mockAuth0ClientCreate.mock.mockImplementationOnce(async () => {
          throw new Error('Auth0 creation error');
        });

        const services = [
          {
            id: '#credentialagent-1',
            type: ServiceTypes.NodeOperatorType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];

        const payload = {
          profile: orgProfile,
          serviceEndpoints: services,
        };

        const monitorNockScope = setMonitorEventsNock();
        setServicePingNock(services[0].serviceEndpoint);

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        const did = response.json.id;

        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(did, orgProfile, services, {
            ids: {
              did,
              ethereumAccount: expect.any(String),
              escrowAccountId: '13',
              fineractClientId: '11',
              tokenAccountId: '12',
              brokerClientId: expect.any(String),
            },
          }),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, orgProfile, services, {
            ids: {
              mongoId: expect.any(ObjectId),
              did,
              ethereumAccount: expect.any(String),
              escrowAccountId: '13',
              fineractClientId: '11',
              tokenAccountId: '12',
              brokerClientId: expect.any(ObjectId),
            },
          }),
        );

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents(orgFromDb, services, testWriteOrganizationsUser),
        );

        expect(
          mockAuth0ClientCreate.mock.calls.map((call) => call.arguments),
        ).toEqual([
          [
            {
              app_type: 'non_interactive',
              client_metadata: {
                did: orgFromDb.didDoc.id,
                service_id: '#credentialagent-1',
              },
              custom_login_page_on: false,
              description:
                'Administrator for the Node operated by "Test Organization"',
              grant_types: ['client_credentials'],
              is_first_party: true,
              is_token_endpoint_ip_header_trusted: true,
              jwt_configuration: {
                alg: 'RS256',
                lifetime_in_seconds: 36000,
                secret_encoded: true,
              },
              logo_uri: 'http://www.organization.com/logo.png',
              name: `test-organization-node-${orgFromDb.didDoc.id}${services[0].id}`,
              oidc_conformant: true,
              token_endpoint_auth_method: 'client_secret_post',
            },
          ],
        ]);

        expect(mockAuth0ClientGrantCreate.mock.callCount()).toEqual(0);
        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);
      });

      it('Should create organization with "yyyy" format date strings in the profile', async () => {
        const profileWithYearOnlyDateStrings = {
          ...orgProfile,
          founded: '1968',
          closed: '1999',
        };

        const payload = {
          profile: profileWithYearOnlyDateStrings,
        };

        const monitorNockScope = setMonitorEventsNock();

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: { 'x-auto-activate': '1' },
        });

        expect(response.statusCode).toEqual(201);
        const did = response.json.id;

        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(
            did,
            profileWithYearOnlyDateStrings,
          ),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, profileWithYearOnlyDateStrings),
        );

        const credentialPayload = decodeCredentialJwt(
          orgFromDb.signedProfileVcJwt.signedCredential,
        );

        expect(credentialPayload).toEqual({
          credentialSubject: {
            ...publicProfileMatcher(profileWithYearOnlyDateStrings),
            permittedVelocityServiceCategory: [],
            id: orgFromDb.didDoc.id,
          },
          id: expect.stringMatching(UUID_FORMAT),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(false);
      });

      it('Should create organization with "yyyy-mm" format date strings in the profile', async () => {
        const monitorNockScope = setMonitorEventsNock();

        const profileWithYearAndMonthDateStrings = {
          ...orgProfile,
          founded: '1968-01',
          closed: '1999-12',
        };

        const payload = {
          profile: profileWithYearAndMonthDateStrings,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: { 'x-auto-activate': '1' },
        });

        expect(response.statusCode).toEqual(201);

        const did = response.json.id;

        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(
            did,
            profileWithYearAndMonthDateStrings,
          ),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, profileWithYearAndMonthDateStrings),
        );

        const credentialPayload = decodeCredentialJwt(
          orgFromDb.signedProfileVcJwt.signedCredential,
        );
        expect(credentialPayload).toEqual({
          credentialSubject: {
            ...publicProfileMatcher(profileWithYearAndMonthDateStrings),
            permittedVelocityServiceCategory: [],
            id: orgFromDb.didDoc.id,
          },
          id: expect.stringMatching(UUID_FORMAT),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(false);
      });

      describe('user & organization groups', () => {
        it('Should add organization to new group when creating an organization and no group exists for user', async () => {
          const payload = {
            profile: orgProfile,
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-auto-activate': '1',
              'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
            },
          });

          expect(response.statusCode).toEqual(201);
          const groupFromDb = await groupsRepo.findOne({
            filter: {
              clientAdminIds: testNoGroupRegistrarUser.sub,
            },
          });
          expect(groupFromDb).toMatchObject({
            groupId: response.json.didDoc.id,
            dids: [response.json.didDoc.id],
            clientAdminIds: [testNoGroupRegistrarUser.sub],
          });
        });

        it('Should not add organization to new group when creating an organization by admin (should not send email as well)', async () => {
          const payload = {
            profile: orgProfile,
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-auto-activate': '1',
              'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
            },
          });

          expect(response.statusCode).toEqual(201);
          await expect(
            groupsRepo.find({
              filter: {
                dids: response.json.id,
              },
            }),
          ).resolves.toEqual([
            {
              dids: [response.json.id],
              groupId: response.json.id,
              _id: expect.any(ObjectId),
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            },
          ]);
          await expect(
            groupsRepo.findOne({
              filter: {
                clientAdminIds: testRegistrarSuperUser.sub,
              },
            }),
          ).resolves.toBeNull();
          expect(
            mockSESSendEmail.mock.calls.map((call) => call.arguments),
          ).toEqual(
            expect.arrayContaining([
              [expectedSupportEmail(orgProfile.name)],
              [expectedSignatoryApprovalEmail(null, { profile: orgProfile })],
            ]),
          );
        });

        it("Should add organization to user's group when creating an organization and group exists already for user", async () => {
          const payload = {
            profile: { ...orgProfile, name: 'Super Organization' },
          };
          const group = await persistGroup();
          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-override-oauth-user': JSON.stringify(
                testWriteOrganizationsUser,
              ),
            },
          });

          expect(response.statusCode).toEqual(201);
          const groupFromDb = await groupsRepo.findOne({
            filter: {
              clientAdminIds: testWriteOrganizationsUser.sub,
            },
          });
          expect(groupFromDb).toMatchObject({
            groupId: group.groupId,
            dids: [...group.dids, response.json.didDoc.id],
            clientAdminIds: [testWriteOrganizationsUser.sub],
          });
          expect(await groupsRepo.count({})).toEqual(1);
        });

        it("Should add organization to already existed user's group without create one", async () => {
          const org = await persistOrganization();
          const group = await persistGroup({
            dids: [org.didDoc.id],
            clientAdminIds: [testWriteOrganizationsUser.sub],
          });

          const payload = {
            profile: {
              ...org.profile,
              name: 'Super Organization',
              website: 'https://foo.example.com',
            },
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-auto-activate': '1',
              'x-override-oauth-user': JSON.stringify(
                testWriteOrganizationsUser,
              ),
            },
          });

          expect(response.statusCode).toEqual(201);
          const groupFromDb = await groupsRepo.findOne({
            filter: {
              clientAdminIds: testWriteOrganizationsUser.sub,
            },
          });
          expect(groupFromDb).toMatchObject({
            groupId: group.groupId,
            dids: [org.didDoc.id, response.json.didDoc.id],
            clientAdminIds: [testWriteOrganizationsUser.sub],
          });
          expect(mockAuth0UserUpdate.mock.callCount()).toEqual(0);
          expect(await groupsRepo.count({})).toEqual(1);
        });
      });

      describe('commercialEntity variants', () => {
        it('Should create organization commercialEntities data in the org profile', async () => {
          const profile = {
            ...orgProfile,
            commercialEntities: [
              {
                type: 'Brand',
                name: 'commercialName',
                logo: 'http://img.com/commercialLogo.png',
              },
            ],
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload: {
              profile,
            },
            headers: {
              'x-auto-activate': '1',
              'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
            },
          });

          expect(response.statusCode).toEqual(201);
          const did = response.json?.id;

          // json response checks
          expect(did).toMatch(DID_FORMAT);
          expect(response.json).toEqual(
            expectedCreateFullOrganizationResponse(did, profile),
          );

          // organization entity checks
          const orgFromDb = await getOrganizationFromDb(did);
          expect(orgFromDb).toEqual(expectedOrganization(did, profile));

          const credentialPayload = decodeCredentialJwt(
            orgFromDb.signedProfileVcJwt.signedCredential,
          );
          expect(credentialPayload).toEqual({
            credentialSubject: {
              ...publicProfileMatcher(profile),
              id: orgFromDb.didDoc.id,
              permittedVelocityServiceCategory: [],
            },
            id: expect.stringMatching(UUID_FORMAT),
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            issuer: {
              id: fastify.config.rootDid,
            },
            type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
          });

          // key entity checks
          const dbKeys = await getKeysFromDb(orgFromDb);
          expect(dbKeys).toEqual(
            expect.arrayContaining(
              map(mapResponseKeyToDbKey, response.json.keys),
            ),
          );
          expect(dbKeys).toHaveLength(5);

          // consent entity checks
          expect(await getConsentsFromDb(orgFromDb)).toEqual(
            expectedConsents(orgFromDb, [], testNoGroupRegistrarUser),
          );
        });

        it('Should create organization if commercialEntities is empty array in the org profile', async () => {
          const profile = {
            ...orgProfile,
            commercialEntities: [],
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload: { profile },
            headers: {
              'x-auto-activate': '1',
              'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
            },
          });

          expect(response.statusCode).toEqual(201);
          const did = response.json?.id;

          // json response checks
          expect(did).toMatch(DID_FORMAT);
          expect(response.json).toEqual(
            expectedCreateFullOrganizationResponse(did, profile),
          );

          // organization entity checks
          const orgFromDb = await getOrganizationFromDb(did);
          expect(orgFromDb).toEqual(expectedOrganization(did, profile));
        });
      });

      describe('monitoring variants', () => {
        it('Should create org with services even if addMonitor request take long time of execution', async () => {
          const service = [
            {
              id: 'credentialagent-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ];
          const payload = {
            profile: orgProfile,
            serviceEndpoints: service,
          };

          setServicePingNock(service[0].serviceEndpoint);
          const monitorNockScope = setMonitorEventsNock(7000);

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
          });

          expect(response.statusCode).toEqual(201);
          expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);
        }, 8000);

        it.skip('Should create org with services even if serviceVersion request in addMonitor take long time of execution', async () => {
          const service = [
            {
              id: 'credentialagent-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ];
          const payload = {
            profile: orgProfile,
            serviceEndpoints: service,
          };

          setServicePingNock(service[0].serviceEndpoint, true, 200, 7000);
          const monitorNockScope = setMonitorEventsNock();

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
          });

          expect(response.statusCode).toEqual(201);
          expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);
        }, 8000);
      });

      describe('Organization Creation with invitations Test Suite', () => {
        it('Should create organization and ignore missing invitationCode', async () => {
          const profile = omit(['type'], orgProfile);

          const payload = {
            profile,
            invitationCode: 'foo',
          };
          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-auto-activate': '0',
              'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
            },
          });

          expect(response.statusCode).toEqual(201);

          expect(
            mockSESSendEmail.mock.calls.map((call) => call.arguments),
          ).toEqual([
            [expectedSupportEmail()],
            [expectedSignatoryApprovalEmail(null, { profile: orgProfile })],
          ]);
        });

        it('Should create organization and ignore expired invitation', async () => {
          const invitationCode = '1234567812345678';
          const invitation = await persistInvitation({
            invitationCode,
            expiresAt: subDays(1, new Date()),
          });
          const profile = omit(['type'], orgProfile);

          const payload = {
            profile,
            invitationCode: '1234567812345678',
          };
          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-auto-activate': '0',
              'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
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
              createdBy: 'sub-123',
              invitationUrl: 'https://someurl.com',
              expiresAt: expect.any(Date),
              invitationCode,
              inviteeEmail: 'foo@example.com',
              updatedAt: expect.any(Date),
              createdAt: expect.any(Date),
            }),
          );
          expect(
            mockSESSendEmail.mock.calls.map((call) => call.arguments),
          ).toEqual(
            expect.arrayContaining([
              [expectedSupportEmail()],
              [expectedSignatoryApprovalEmail(null, { profile: orgProfile })],
            ]),
          );
        });

        it('Should create organization without services and accept invitation', async () => {
          const profile = omit(['type'], orgProfile);
          const inviterOrganization = await persistOrganization({
            name: 'CAOTEST',
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
            code: invitationCode,
            inviterOrganization,
          });

          const payload = {
            profile,
            invitationCode: '1234567812345678',
          };
          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-auto-activate': '0',
              'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
            },
          });

          expect(response.statusCode).toEqual(201);
          const invitationFromDb = await invitationCollection.findOne({
            code: invitationCode,
          });
          expect(invitationFromDb).toEqual(
            mongoify({
              _id: invitation._id,
              acceptedAt: expect.any(Date),
              acceptedBy: expect.stringMatching(AUTH0_USER_ID_FORMAT),
              expiresAt: expect.any(Date),
              code: invitationCode,
              inviteeEmail: 'foo@example.com',
              inviterDid: inviterOrganization.didDoc.id,
              createdBy: 'sub-123',
              invitationUrl: 'https://someurl.com',
              updatedAt: expect.any(Date),
              createdAt: expect.any(Date),
            }),
          );
          expect(invitationFromDb.acceptedAt.getTime()).toBeGreaterThan(
            mongoify(invitation).createdAt.getTime(),
          );

          expect(
            mockSESSendEmail.mock.calls.map((call) => call.arguments),
          ).toEqual([
            [expectedSupportEmail()],
            [expectedSignatoryApprovalEmail(inviterOrganization, { profile })],
          ]);
        });

        it('Should create organization with services and accept invitation', async () => {
          const profile = omit(['type'], orgProfile);
          const inviterOrganization = await persistOrganization({
            name: 'CAOTEST',
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
            code: invitationCode,
            inviterOrganization,
          });
          const services = [
            {
              id: '#test-service-1',
              type: ServiceTypes.InspectionType,
              serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            },
            {
              id: '#test-service-2',
              type: ServiceTypes.InspectionType,
              serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            },
          ];

          const payload = {
            profile,
            serviceEndpoints: services,
            invitationCode: '1234567812345678',
          };
          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
            },
          });

          expect(response.statusCode).toEqual(201);
          const invitationFromDb = await invitationCollection.findOne({
            code: invitationCode,
          });
          expect(invitationFromDb).toEqual(
            mongoify({
              _id: invitation._id,
              acceptedAt: expect.any(Date),
              acceptedBy: expect.stringMatching(AUTH0_USER_ID_FORMAT),
              expiresAt: expect.any(Date),
              code: invitationCode,
              inviteeEmail: 'foo@example.com',
              inviterDid: inviterOrganization.didDoc.id,
              createdBy: 'sub-123',
              invitationUrl: 'https://someurl.com',
              updatedAt: expect.any(Date),
              createdAt: expect.any(Date),
            }),
          );
          expect(invitationFromDb.acceptedAt.getTime()).toBeGreaterThan(
            mongoify(invitation).createdAt.getTime(),
          );

          const did = response.json?.id;

          // json response checks
          expect(did).toMatch(DID_FORMAT);
          expect(response.json).toEqual(
            expectedCreateFullOrganizationResponse(did, orgProfile, services),
          );

          // organization entity checks
          const orgFromDb = await getOrganizationFromDb(did);
          expect(orgFromDb).toEqual(
            expectedOrganization(did, orgProfile, services, {
              invitation,
            }),
          );
          // consent entity checks
          expect(await getConsentsFromDb(orgFromDb)).toEqual(
            expectedConsents(orgFromDb, services, testNoGroupRegistrarUser),
          );
          expect(
            mockSESSendEmail.mock.calls.map((call) => call.arguments),
          ).toEqual(
            expect.arrayContaining([
              [sendServicesActivatedEmailMatcher(orgFromDb)],
              [sendServicesActivatedEmailToCAOsMatcher(orgFromDb)],
              [sendServicesActivatedEmailToCAOsMatcher(orgFromDb)],
              [expectedInvitationAcceptanceEmail],
              [expectedSupportEmail()],
              [expectedSignatoryApprovalEmail(inviterOrganization, orgFromDb)],
            ]),
          );

          expect(mockSESSendEmail.mock.calls[5].arguments).toEqual([
            expectedSignatoryApprovalEmail(inviterOrganization, orgFromDb),
          ]);
        });

        it('should create organization with services and accept invitation and send email with two services', async () => {
          const profile = omit(['type'], orgProfile);
          const inviterOrganization = await persistOrganization({
            name: 'CAOTEST',
            service: [
              {
                id: '#caoid',
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: 'https://www.cao.com',
              },
              {
                id: '#caoidtwo',
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: 'https://www.caotwo.com',
              },
            ],
          });
          await persistGroup({
            organization: inviterOrganization,
            clientAdminIds: [nanoid()],
          });
          const invitationCode = '1234567812345678';
          const invitation = await persistInvitation({
            invitationCode,
            inviterOrganization,
          });
          const services = [
            {
              id: '#test-service-1',
              type: ServiceTypes.InspectionType,
              serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            },
            {
              id: '#test-service-2',
              type: ServiceTypes.NotaryIssuerType,
              serviceEndpoint: `${inviterOrganization.didDoc.id}#caoidtwo`,
            },
          ];

          const payload = {
            profile,
            serviceEndpoints: services,
            invitationCode: '1234567812345678',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
            },
          });

          expect(response.statusCode).toEqual(201);
          const invitationFromDb = await invitationCollection.findOne({
            code: invitationCode,
          });
          expect(invitationFromDb).toEqual(
            mongoify({
              _id: invitation._id,
              acceptedAt: expect.any(Date),
              acceptedBy: expect.stringMatching(AUTH0_USER_ID_FORMAT),
              code: '1234567812345678',
              expiresAt: expect.any(Date),
              invitationCode,
              inviteeEmail: 'foo@example.com',
              inviterDid: inviterOrganization.didDoc.id,
              createdBy: 'sub-123',
              invitationUrl: 'https://someurl.com',
              updatedAt: expect.any(Date),
              createdAt: expect.any(Date),
            }),
          );
          expect(invitationFromDb.acceptedAt.getTime()).toBeGreaterThan(
            mongoify(invitation).createdAt.getTime(),
          );

          const did = response.json?.id;

          // json response checks
          expect(did).toMatch(DID_FORMAT);
          expect(response.json).toEqual(
            expectedCreateFullOrganizationResponse(did, orgProfile, services),
          );

          // organization entity checks
          const orgFromDb = await getOrganizationFromDb(did);
          expect(orgFromDb).toEqual(
            expectedOrganization(did, orgProfile, services, {
              invitation,
            }),
          );
          // consent entity checks
          expect(await getConsentsFromDb(orgFromDb)).toEqual(
            expectedConsents(orgFromDb, services, testNoGroupRegistrarUser),
          );

          expect(
            mockSESSendEmail.mock.calls.map((call) => call.arguments),
          ).toEqual(
            expect.arrayContaining([
              [sendServicesActivatedEmailMatcher(orgFromDb)],
              [sendServicesActivatedEmailToCAOsMatcher(orgFromDb)],
              [sendServicesActivatedEmailToCAOsMatcher(orgFromDb)],
              [expectedInvitationAcceptanceEmail],
              [expectedSupportEmail()],
              [expectedSignatoryApprovalEmail(inviterOrganization, orgFromDb)],
            ]),
          );
        });

        it('should create organization and skip sending email to CAO if no services for inviter', async () => {
          const profile = omit(['type'], orgProfile);
          const inviterOrganization = await persistOrganization({
            name: 'CAOTEST1',
            service: [
              {
                id: '#caoid',
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: 'https://www.cao.com',
              },
            ],
          });
          await persistGroup({ organization: inviterOrganization });
          const invitationCode = '1234567812345678';
          const invitation = await persistInvitation({
            code: invitationCode,
            inviterOrganization,
          });
          const services = [
            {
              id: '#test-service-1',
              type: ServiceTypes.InspectionType,
              serviceEndpoint: 'https://www.example.com/caoservice',
            },
          ];

          const payload = {
            profile,
            serviceEndpoints: services,
            invitationCode: '1234567812345678',
          };
          expect(mockSESSendEmail.mock.callCount()).toEqual(0);
          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
            },
          });

          expect(response.statusCode).toEqual(201);
          const invitationFromDb = await invitationCollection.findOne({
            code: invitationCode,
          });
          expect(invitationFromDb).toEqual(
            mongoify({
              _id: invitation._id,
              acceptedAt: expect.any(Date),
              acceptedBy: expect.stringMatching(AUTH0_USER_ID_FORMAT),
              expiresAt: expect.any(Date),
              code: invitationCode,
              inviteeEmail: 'foo@example.com',
              inviterDid: inviterOrganization.didDoc.id,
              createdBy: 'sub-123',
              invitationUrl: 'https://someurl.com',
              updatedAt: expect.any(Date),
              createdAt: expect.any(Date),
            }),
          );
          expect(invitationFromDb.acceptedAt.getTime()).toBeGreaterThan(
            mongoify(invitation).createdAt.getTime(),
          );

          const did = response.json?.id;

          // json response checks
          expect(did).toMatch(DID_FORMAT);
          expect(response.json).toEqual(
            expectedCreateFullOrganizationResponse(did, orgProfile, services),
          );

          // organization entity checks
          const orgFromDb = await getOrganizationFromDb(did);
          expect(orgFromDb).toEqual(
            expectedOrganization(did, orgProfile, services, {
              invitation,
            }),
          );
          // consent entity checks
          expect(await getConsentsFromDb(orgFromDb)).toEqual(
            expectedConsents(orgFromDb, services, testNoGroupRegistrarUser),
          );

          expect(
            mockSESSendEmail.mock.calls.map((call) => call.arguments),
          ).toEqual(
            expect.arrayContaining([
              [sendServicesActivatedEmailMatcher()],
              [expectedSupportEmail()],
            ]),
          );
        });

        it('should create organization and skip sending email about invitation', async () => {
          const profile = omit(['type'], orgProfile);
          const inviterOrganization1 = await persistOrganization({
            name: 'CAOTEST1',
            service: [
              {
                id: '#caoid1',
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: 'https://www.cao.com',
              },
            ],
          });
          const inviterOrganization2 = await persistOrganization({
            name: 'CAOTEST2',
            service: [
              {
                id: '#caoid2',
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: 'https://www.cao.com',
              },
            ],
          });
          await persistGroup({ organization: inviterOrganization1 });
          const invitationCode = '1234567812345678';
          const invitation = await persistInvitation({
            code: invitationCode,
            inviterOrganization: inviterOrganization1,
          });
          const services = [
            {
              id: '#test-service-2',
              type: ServiceTypes.NotaryIssuerType,
              serviceEndpoint: `${inviterOrganization2.didDoc.id}#caoid2`,
            },
            {
              id: '#test-service-3',
              type: ServiceTypes.InspectionType,
              serviceEndpoint: 'https://example.com/caoagent',
            },
          ];

          const payload = {
            profile,
            serviceEndpoints: services,
            invitationCode: '1234567812345678',
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
            },
          });

          expect(response.statusCode).toEqual(201);
          const invitationFromDb = await invitationCollection.findOne({
            code: invitationCode,
          });
          expect(invitationFromDb).toEqual(
            mongoify({
              _id: invitation._id,
              acceptedAt: expect.any(Date),
              acceptedBy: expect.stringMatching(AUTH0_USER_ID_FORMAT),
              expiresAt: expect.any(Date),
              code: invitationCode,
              inviteeEmail: 'foo@example.com',
              inviterDid: inviterOrganization1.didDoc.id,
              createdBy: 'sub-123',
              invitationUrl: 'https://someurl.com',
              updatedAt: expect.any(Date),
              createdAt: expect.any(Date),
            }),
          );
          expect(invitationFromDb.acceptedAt.getTime()).toBeGreaterThan(
            mongoify(invitation).createdAt.getTime(),
          );

          const did = response.json?.id;

          // json response checks
          expect(did).toMatch(DID_FORMAT);
          expect(response.json).toEqual(
            expectedCreateFullOrganizationResponse(did, orgProfile, services),
          );

          // organization entity checks
          const orgFromDb = await getOrganizationFromDb(did);
          expect(orgFromDb).toEqual(
            expectedOrganization(did, orgProfile, services, {
              invitation,
            }),
          );
          // consent entity checks
          expect(await getConsentsFromDb(orgFromDb)).toEqual(
            expectedConsents(orgFromDb, services, testNoGroupRegistrarUser),
          );

          expect(
            mockSESSendEmail.mock.calls.map((call) => call.arguments),
          ).toEqual(
            expect.arrayContaining([
              [sendServicesActivatedEmailMatcher(orgFromDb)],
              [expectedSupportEmail()],
              [expectedSignatoryApprovalEmail(inviterOrganization1, orgFromDb)],
            ]),
          );
        });

        it('Should not send email if CAO org does not exist', async () => {
          const caoOrg = await persistOrganization({
            name: 'Just Name',
          });

          await persistGroup({ organization: caoOrg });

          const profile = omit(['type'], orgProfile);
          const service = [
            {
              id: '#identityIssuer-1',
              type: ServiceTypes.IdDocumentIssuerType,
              serviceEndpoint: 'https://node.example.com',
            },
            {
              id: '#careerIssuer-2',
              type: ServiceTypes.CareerIssuerType,
              serviceEndpoint: 'https://node.example.com',
            },
          ];

          const payload = {
            profile,
            serviceEndpoints: service,
          };
          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-auto-activate': '1',
              'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
            },
          });
          expect(response.statusCode).toEqual(201);

          expect(
            mockSESSendEmail.mock.calls.map((call) => call.arguments),
          ).toEqual(
            expect.arrayContaining([
              [sendServicesActivatedEmailMatcher()],
              [expectedSupportEmail()],
            ]),
          );
        });

        it('Should create organization and send email to CAO about service activation', async () => {
          const caoOrg = await persistOrganization({
            name: 'CAO name',
            service: [
              {
                id: '#caoid',
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: 'https://www.acme.com',
              },
            ],
          });

          await persistGroup({ organization: caoOrg });

          const services = [
            {
              id: '#test-service-1',
              type: ServiceTypes.InspectionType,
              credentialTypes: ['DriversLicenseV1.0'],
              serviceEndpoint: 'https://verifagent.samplevendor.com/acme',
            },
            {
              id: '#test-service-2',
              type: ServiceTypes.InspectionType,
              credentialTypes: ['DriversLicenseV1.0'],
              serviceEndpoint: `${caoOrg.didDoc.id}#caoid`,
            },
          ];

          const payload = {
            profile: orgProfile,
            serviceEndpoints: services,
          };

          const response = await fastify.injectJson({
            method: 'POST',
            url: fullUrl,
            payload,
            headers: {
              'x-auto-activate': '1',
              'x-override-oauth-user': JSON.stringify(
                testWriteOrganizationsUser,
              ),
            },
          });

          expect(response.statusCode).toEqual(201);
          const did = response.json?.id;

          // json response checks
          expect(did).toMatch(DID_FORMAT);
          expect(response.json).toEqual(
            expectedCreateFullOrganizationResponse(
              did,
              orgProfile,
              services,
              {},
            ),
          );

          // organization entity checks
          const orgFromDb = await getOrganizationFromDb(did);
          expect(orgFromDb).toEqual(
            expectedOrganization(did, orgProfile, services),
          );
          // consent entity checks
          expect(await getConsentsFromDb(orgFromDb)).toEqual(
            expectedConsents(orgFromDb, services, testWriteOrganizationsUser),
          );

          expect(
            mockSESSendEmail.mock.calls.map((call) => call.arguments),
          ).toEqual(
            expect.arrayContaining([
              [sendServicesActivatedEmailMatcher(orgFromDb)],
              [sendServicesActivatedEmailToCAOsMatcher(orgFromDb)],
              [expectedSupportEmail()],
              [expectedSignatoryApprovalEmail(null, orgFromDb)],
            ]),
          );
        });
      });
    });
  });

  describe('GET FULL Organizations', () => {
    describe('Empty State', () => {
      before(async () => {
        await clearDb();
      });

      it('Should return an empty list when there are no organizations', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: fullUrl,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({ result: [] });
      });
    });

    describe('Single Organization State', () => {
      let organization;
      let services;
      let registrarFormatServices;

      beforeEach(async () => {
        await clearDb();
        ({ organization, services } =
          await persistIndexedOrganizationWithIssuerService(0));
        registrarFormatServices = map(
          omit(['createdAt', 'updatedAt']),
          services,
        );
      });

      it('Should return a list with items when there is at least one organization', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: fullUrl,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            buildFullOrganizationResponse({
              organization,
              services: registrarFormatServices,
            }),
          ],
        });
      });

      it('Should return a list with items when there are admin and signatory properties in the profile', async () => {
        await clearDb();
        const additionalProfileProperties = {
          adminGivenName: 'A-given-name',
          adminTitle: 'A-family-title',
          adminEmail: 'admin@email.com',
          signatoryGivenName: 'S-given-name',
          signatoryFamilyName: 'S-family-name',
          signatoryTitle: 'S-title',
          signatoryEmail: 'signatory@email.com',
        };
        const newOrg = await newOrganization();
        const orgProfile = omit(
          ['id', 'createdAt', 'updatedAt'],
          newOrg.profile,
        );
        const org = await persistOrganization({
          service: [],
          profile: {
            ...orgProfile,
            ...additionalProfileProperties,
          },
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: fullUrl,
        });

        const orgResponse = buildFullOrganizationResponse({
          organization: org,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            {
              ...orgResponse,
              profile: {
                ...orgResponse.profile,
                ...additionalProfileProperties,
              },
              services: [],
            },
          ],
        });
      });

      it('Should return a list with items without technicalEmail and contactEmail', async () => {
        await clearDb();
        const org = await newOrganization();
        const orgProfile = omit(
          [
            'id',
            'createdAt',
            'updatedAt',
            'technicalEmail',
            'contactEmail',
            'description',
          ],
          org.profile,
        );

        const oldFormatOrganization = await persistOrganization({
          ...org,
          profile: orgProfile,
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: fullUrl,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            buildFullOrganizationResponse({
              organization: oldFormatOrganization,
              services: [],
            }),
          ],
        });
        expect(response.json.result[0].profile).not.toHaveProperty(
          'technicalEmail',
        );
        expect(response.json.result[0].profile).not.toHaveProperty(
          'contactEmail',
        );
      });

      it('Should return a list with items with correct format founded and closed fields in profile', async () => {
        const org = await newOrganization();
        const orgProfile = omit(['id', 'createdAt', 'updatedAt'], org.profile);

        const oldFormatOrganization = await persistOrganization({
          profile: {
            ...orgProfile,
            founded: '2000-15-08',
            closed: '2000-15-08',
          },
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: fullUrl,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            buildFullOrganizationResponse({
              organization: oldFormatOrganization,
              services: [],
            }),
            buildFullOrganizationResponse({
              organization,
              services: registrarFormatServices,
            }),
          ],
        });
      });
    });

    describe('GET Full Organizations authorization filter tests', () => {
      let orgs;
      let servicesByOrg;

      before(async () => {
        await clearDb();
        const result = await runSequentially([
          () => persistIndexedOrganizationWithIssuerService(0),
          () => persistIndexedOrganizationWithIssuerService(1),
        ]);
        orgs = map((s) => s.organization, result);
        servicesByOrg = {};
        forEach(({ organization, services }) => {
          servicesByOrg[organization.didDoc.id] = map(
            omit(['createdAt', 'updatedAt']),
            services,
          );
        }, result);
      });

      it('Should 403 when no user group is present', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: fullUrl,
          headers: {
            'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(403);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Forbidden',
            errorCode: 'missing_error_code',
            message: expect.stringMatching(
              `User auth0|${NANO_ID_FORMAT} has an invalid group claim did:test:1234`,
            ),
            statusCode: 403,
          }),
        );
      });

      it('Should return empty list when users group is doesnt contain any orgs', async () => {
        const group = await persistGroup({ groupId: nanoid(), dids: [] });
        const response = await fastify.injectJson({
          method: 'GET',
          url: fullUrl,
          headers: {
            'x-override-oauth-user': JSON.stringify({
              ...testReadOrganizationsUser,
              [VNF_GROUP_ID_CLAIM]: group.groupId,
            }),
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({ result: [] });
      });
      it("Should return a list of only organizations that user's group contains", async () => {
        await persistGroup({ organization: orgs[0] });
        const response = await fastify.injectJson({
          method: 'GET',
          url: fullUrl,
          headers: {
            'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            buildFullOrganizationResponse({
              organization: orgs[0],
              services: servicesByOrg[orgs[0].didDoc.id],
            }),
          ],
        });
      });
    });

    describe('GET Full Organizations filtering tests', () => {
      let orgs;
      let servicesByOrg;

      before(async () => {
        await clearDb();

        const serviceIssuer = {
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const serviceInspector = {
          type: ServiceTypes.InspectionType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const result = await runSequentially([
          () => persistIndexedOrganizationWithServices(0, [serviceIssuer]),
          () => persistIndexedOrganizationWithServices(1, [serviceInspector]),
          () => persistIndexedOrganizationWithServices('00', [serviceIssuer]),
        ]);
        orgs = map((s) => s.organization, result);
        servicesByOrg = {};
        forEach(({ organization, services }) => {
          servicesByOrg[organization.didDoc.id] = map(
            omit(['createdAt', 'updatedAt']),
            services,
          );
        }, result);
      });

      it('Should return a list with a single item when only "q" param is provided', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?q=Organization1`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            buildFullOrganizationResponse({
              organization: orgs[1],
              services: servicesByOrg[orgs[1].didDoc.id],
            }),
          ],
        });
      });

      it('Should return a list with an item when only "filter.did" param is provided', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?filter.did=${orgs[1].didDoc.id}`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            buildFullOrganizationResponse({
              organization: orgs[1],
              services: servicesByOrg[orgs[1].didDoc.id],
            }),
          ],
        });
      });

      it('Should return a list with an item when only "filter.serviceTypes" param is provided', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?filter.serviceTypes=Issuer`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: map(
            (o) =>
              buildFullOrganizationResponse({
                organization: o,
                services: servicesByOrg[o.didDoc.id],
              }),
            [orgs[2], orgs[0]],
          ),
        });
      });

      it('Should return a list with HolderAppProvider orgs with all fields and missing fields', async () => {
        const holderAppServiceAllFields = {
          type: ServiceTypes.HolderAppProviderType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
          playStoreUrl: 'http://example.com/play-store',
          appleAppStoreUrl: 'http://example.com/apple-app-store',
          appleAppId: 'com.example.app',
          googlePlayId: 'com.example.app',
          logoUrl: 'http://example.com/logo',
          name: 'fooWallet',
          supportedExchangeProtocols: ['VN_API'],
        };

        const holderAppServiceMissingFields = {
          type: ServiceTypes.HolderAppProviderType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
          appleAppStoreUrl: 'http://example.com/apple-app-store',
          appleAppId: 'com.example.app',
          logoUrl: 'http://example.com/logo',
          name: 'fooWallet',
          supportedExchangeProtocols: ['VN_API'],
        };

        const webWalletServiceAllFields = {
          type: ServiceTypes.WebWalletProviderType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
          logoUrl: 'http://example.com/logo',
          name: 'fooWallet',
          supportedExchangeProtocols: ['VN_API'],
        };

        const webWalletServiceMissingFields = {
          type: ServiceTypes.WebWalletProviderType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
          logoUrl: 'http://example.com/logo',
          supportedExchangeProtocols: ['VN_API'],
        };

        const result = await runSequentially([
          () =>
            persistIndexedOrganizationWithServices('20', [
              holderAppServiceAllFields,
            ]),
          () =>
            persistIndexedOrganizationWithServices('21', [
              holderAppServiceMissingFields,
            ]),
          () =>
            persistIndexedOrganizationWithServices('23', [
              webWalletServiceAllFields,
            ]),
          () =>
            persistIndexedOrganizationWithServices('24', [
              webWalletServiceMissingFields,
            ]),
        ]);

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?filter.serviceTypes=HolderAppProvider`,
        });

        const servicesByWalletProviderOrg = {};
        forEach(({ organization, services }) => {
          servicesByWalletProviderOrg[organization.didDoc.id] = map(
            omit(['createdAt', 'updatedAt']),
            services,
          );
        }, result);
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: map(
            ({ organization: o }) =>
              buildFullOrganizationResponse({
                organization: o,
                services: servicesByWalletProviderOrg[o.didDoc.id],
              }),
            reverse(result),
          ),
        });
      });

      it('Should return an empty list when matching "filter.serviceTypes" but not matching "filter.credentialTypes"', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?filter.serviceTypes=Issuer&filter.credentialTypes=NonExistingType`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [],
        });
      });

      it('Should return a list with matching "filter.serviceTypes" and "filter.credentialTypes"', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?filter.serviceTypes=Issuer&filter.credentialTypes=EducationDegree,PastEmploymentPosition`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: map(
            (o) =>
              buildFullOrganizationResponse({
                organization: o,
                services: servicesByOrg[o.didDoc.id],
              }),
            [orgs[2], orgs[0]],
          ),
        });
      });

      it('Should return a list including disparate service types without any issuer credential types specified', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?filter.serviceTypes=Issuer,Inspector`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: flow(
            map((o) =>
              buildFullOrganizationResponse({
                organization: o,
                services: servicesByOrg[o.didDoc.id],
              }),
            ),
            reverse,
          )(orgs),
        });
      });

      it('Should return a list including disparate service types with issuer credential types specified', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?filter.serviceTypes=Issuer,Inspector&filter.credentialTypes=EducationDegree`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: flow(
            map((o) =>
              buildFullOrganizationResponse({
                organization: o,
                services: servicesByOrg[o.didDoc.id],
              }),
            ),
            reverse,
          )(orgs),
        });
      });
    });

    describe('GET Full Organizations Sort Tests', () => {
      let orgs;
      before(async () => {
        await clearDb();

        const serviceIssuer = {
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const result = await runSequentially([
          () => persistIndexedOrganizationWithServices(3, [serviceIssuer]),
          () => persistIndexedOrganizationWithServices('b', [serviceIssuer]),
          () => persistIndexedOrganizationWithServices(2, [serviceIssuer]),
          () => persistIndexedOrganizationWithServices('a', [serviceIssuer]),
          () => persistIndexedOrganizationWithServices(1, [serviceIssuer]),
          () => persistIndexedOrganizationWithServices('c', [serviceIssuer]),
        ]);
        orgs = map((s) => s.organization, result);
      });

      it('Should 400 when the "sort" param is not an array', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?sort=asd`,
        });

        expect(response.statusCode).toEqual(400);
      });

      it('Should 200 "sort[0]=createdAt,DESC" query with most recent organization sorted to first', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?sort[0]=createdAt,DESC`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(6);

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(6);
        expect(response.json.result[5].didDoc.id).toEqual(orgs[0].didDoc.id);
        expect(response.json.result[0].didDoc.id).toEqual(orgs[5].didDoc.id);
      });

      it('Should 200 "sort[0]=createdAt,ASC" query with most recent organization sorted to last', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?sort[0]=createdAt,ASC`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(6);
        expect(response.json.result[0].didDoc.id).toEqual(orgs[0].didDoc.id);
        expect(response.json.result[5].didDoc.id).toEqual(orgs[5].didDoc.id);
      });

      it('Should 200 "sort[0]=profile.name,ASC" query with organizations sorted alphabetically', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?sort[0]=profile.name,ASC`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(6);
        expect(response.json.result[0].didDoc.id).toEqual(orgs[4].didDoc.id);
        expect(response.json.result[5].didDoc.id).toEqual(orgs[5].didDoc.id);
      });

      it('Should 200 "sort[0]=profile.name,DESC" query with organizations sorted reverse-alphabetically', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?sort[0]=profile.name,DESC`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(6);
        expect(response.json.result[5].didDoc.id).toEqual(orgs[4].didDoc.id);
        expect(response.json.result[0].didDoc.id).toEqual(orgs[5].didDoc.id);
      });
    });

    describe('GET Full Organizations Size and Skip Tests', () => {
      let orgs;
      before(async () => {
        await clearDb();

        const serviceIssuer = {
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const result = await runSequentially([
          () => persistIndexedOrganizationWithServices(0, [serviceIssuer]),
          () => persistIndexedOrganizationWithServices(1, [serviceIssuer]),
          () => persistIndexedOrganizationWithServices(2, [serviceIssuer]),
        ]);
        orgs = map((s) => s.organization, result);
      });

      it('Should 400 when the "page.size" param is not a number', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?page.size=a`,
        });

        expect(response.statusCode).toEqual(400);
      });

      it('Should 400 when the "page.skip" param is not a number', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?page.skip=a`,
        });

        expect(response.statusCode).toEqual(400);
      });

      it('Should 200 with length matching "page.size"', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?page.size=1`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(1);
      });

      it('Should 200 with length matching "page.size", and value should match skip with implicit sort (["id","DESC"])', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?page.size=1&page.skip=2`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(1);
        expect(response.json.result[0].didDoc.id).toEqual(orgs[0].didDoc.id);
      });

      it('Should 200 with length matching "page.size", value should match the expected skip when using sort[0]=profile.name,ASC', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}?page.size=1&page.skip=2&sort[0]=profile.name,ASC`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(1);
        expect(response.json.result[0].didDoc.id).toEqual(orgs[2].didDoc.id);
      });
    });
  });

  describe('Non-custodied DID:WEB test suite', () => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    const expectedDidWebDoc = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
      ],
      id: 'did:web:example.com',
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
          id: 'did:web:example.com#key-2',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
      ],
      authentication: ['did:web:example.com#key-0'],
      assertionMethod: ['did:web:example.com#key-0'],
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
          id: 'did:web:example.com#key-2',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
      ],
    };
    let orgProfile;

    before(async () => {
      const org = await newOrganization();
      orgProfile = omit(['id', 'createdAt', 'updatedAt'], org.profile);
    });

    beforeEach(async () => {
      await clearDb();
    });

    describe('DID:WEB creation', () => {
      beforeEach(async () => {
        mockCreateFineractClient.mock.mockImplementation(
          () => mockCreateFineractClientReturnValue,
        );
      });

      it('Should create organizations without service', async () => {
        const nockData = nock('https://example.com')
          .get('/.well-known/did.json')
          .reply(200, expectedDidWebDoc);

        const payload = {
          profile: orgProfile,
          serviceEndpoints: [],
          byoDid: expectedDidWebDoc.id,
          keys: [
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[0].id,
              ),
              purposes: [KeyPurposes.DLT_TRANSACTIONS],
            },
          ],
        };
        const monitorNockScope = setMonitorEventsNock();

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        const did = response.json.id;

        // json response checks
        expect(did).toMatch(DID_FORMAT);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(did, orgProfile, [], {
            keys: payload.keys,
          }),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, orgProfile, null, {
            didNotCustodied: true,
          }),
        );
        const credentialPayload = decodeCredentialJwt(
          orgFromDb.signedProfileVcJwt.signedCredential,
        );
        expect(credentialPayload).toEqual({
          credentialSubject: {
            ...publicProfileMatcher(orgProfile),
            id: did,
            permittedVelocityServiceCategory: [],
          },
          id: expect.stringMatching(UUID_FORMAT),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });

        // key entity checks
        const dbKeys = await getKeysFromDb(orgFromDb);
        expect(dbKeys).toEqual(
          expect.arrayContaining(
            map(mapResponseKeyToDbKey, response.json.keys),
          ),
        );
        expect(dbKeys).toHaveLength(3);

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents(orgFromDb, [], testNoGroupRegistrarUser),
        );

        // group entity checks
        expect(await groupsRepo.count({})).toEqual(1);

        // blockchain contract checks
        blockchainContractExpectations(orgFromDb, dbKeys);

        // auth0 checks
        expect(mockAuth0ClientGrantCreate.mock.callCount()).toEqual(0);
        expect(mockAuth0UserUpdate.mock.callCount()).toEqual(0);
        expect(mockUpdateAddressScopes.mock.callCount()).toEqual(1);
        expect(
          mockUpdateAddressScopes.mock.calls.map((call) => call.arguments),
        ).toContainEqual([
          expectedAuth0ScopeChanges(orgFromDb.ids.ethereumAccount),
        ]);

        // monitoring checks
        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(false);

        // email checks
        expect(
          mockSESSendEmail.mock.calls.map((call) => call.arguments),
        ).toEqual(
          expect.arrayContaining([
            [expectedSupportEmail()],
            [expectedSignatoryApprovalEmail(null, orgFromDb)],
          ]),
        );

        expect(nockData.isDone()).toEqual(true);
      });

      it('Should create organizations with service and invitation', async () => {
        const inviterOrganization = await persistOrganization({
          name: 'CAOTEST1',
          service: [
            {
              id: '#caoid1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://www.cao.com',
            },
          ],
        });
        const invitationCode = '1234567812345678';
        const invitation = await persistInvitation({
          code: invitationCode,
          inviterOrganization,
        });

        const services = [
          {
            id: '#acme-1',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          },
          {
            id: '#acme-2',
            type: ServiceTypes.IdDocumentIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            credentialTypes: ['IdDocument'],
          },
        ];

        const nockData = nock('https://example.com')
          .get('/.well-known/did.json')
          .reply(200, {
            ...expectedDidWebDoc,
            service: map(omit(['credentialTypes']), services),
          });

        const payload = {
          profile: orgProfile,
          serviceEndpoints: [
            {
              id: '#acme-1',
            },
            {
              id: '#acme-2',
              credentialTypes: services[1].credentialTypes,
            },
          ],
          byoDid: expectedDidWebDoc.id,
          invitationCode,
          keys: [
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[0].id,
              ),
              purposes: [KeyPurposes.DLT_TRANSACTIONS],
            },
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[1].id,
              ),
              purposes: [KeyPurposes.ISSUING_METADATA],
            },
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[2].id,
              ),
              purposes: [KeyPurposes.EXCHANGES],
            },
          ],
        };
        const monitorNockScope = setMonitorEventsNock();

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        const did = response.json.id;

        // json response checks
        expect(did).toMatch(expectedDidWebDoc.id);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(did, orgProfile, services, {
            keys: payload.keys,
            profile: {
              permittedVelocityServiceCategory: [
                'CredentialAgentOperator',
                'IdDocumentIssuer',
                'IdentityIssuer',
              ],
            },
            authClients: [
              {
                clientId: expect.stringMatching(NANO_ID_FORMAT),
                clientSecret: expect.stringMatching(NANO_ID_FORMAT),
                clientType: 'agent',
                serviceId: '#acme-1',
                type: 'auth0',
              },
            ],
          }),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, orgProfile, services, {
            authClients: response.json.authClients,
            profile: {
              permittedVelocityServiceCategory: [
                'CredentialAgentOperator',
                'IdDocumentIssuer',
                'IdentityIssuer',
              ],
            },
            didNotCustodied: true,
            invitation,
          }),
        );
        const credentialPayload = decodeCredentialJwt(
          orgFromDb.signedProfileVcJwt.signedCredential,
        );
        expect(credentialPayload).toEqual({
          credentialSubject: {
            ...publicProfileMatcher(orgProfile),
            id: did,
            permittedVelocityServiceCategory: [
              'CredentialAgentOperator',
              'IdDocumentIssuer',
              'IdentityIssuer',
            ],
          },
          id: expect.stringMatching(UUID_FORMAT),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });

        // key entity checks
        const dbKeys = await getKeysFromDb(orgFromDb);
        expect(dbKeys).toEqual(
          expect.arrayContaining(
            map(mapResponseKeyToDbKey, response.json.keys),
          ),
        );
        expect(dbKeys).toHaveLength(5);

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents(orgFromDb, services, testNoGroupRegistrarUser),
        );

        // group entity checks
        expect(await groupsRepo.count({})).toEqual(1);

        // blockchain contract checks
        blockchainContractExpectations(orgFromDb, dbKeys);

        // auth0 checks
        expect(mockAuth0ClientGrantCreate.mock.callCount()).toEqual(1);
        expect(
          mockAuth0ClientCreate.mock.calls.map((call) => call.arguments),
        ).toEqual([
          [
            {
              app_type: 'non_interactive',
              client_metadata: {
                did,
                service_id: '#acme-1',
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
              name: `test-organization-agent-${orgFromDb.didDoc.id}${services[0].id}`,
              oidc_conformant: true,
              token_endpoint_auth_method: 'client_secret_post',
            },
          ],
        ]);
        expect(mockAuth0UserUpdate.mock.callCount()).toEqual(1);
        expect(mockUpdateAddressScopes.mock.callCount()).toEqual(1);
        expect(
          mockUpdateAddressScopes.mock.calls.map((call) => call.arguments),
        ).toContainEqual([
          expectedAuth0ScopeChanges(orgFromDb.ids.ethereumAccount, [
            'transactions:write',
            'credential:revoke',
            'credential:identityissue',
          ]),
        ]);

        // monitoring checks
        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);

        // email checks
        expect(
          mockSESSendEmail.mock.calls.map((call) => call.arguments),
        ).toEqual(
          expect.arrayContaining([
            [expectedSupportEmail()],
            [sendServicesActivatedEmailMatcher()],
            [expectedSignatoryApprovalEmail(inviterOrganization, orgFromDb)],
          ]),
        );

        expect(nockData.isDone()).toEqual(true);
      });

      it('Should create organizations with encoded uri byodid with service', async () => {
        const services = [
          {
            id: '#acme-1',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          },
          {
            id: '#acme-2',
            type: ServiceTypes.IdDocumentIssuerType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
            credentialTypes: ['IdDocument'],
          },
        ];

        const didWebDoc = {
          '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/suites/jws-2020/v1',
          ],
          id: 'did:web:example.com/test:alias',
          verificationMethod: [
            {
              id: 'did:web:example.com/test:alias#key-0',
              type: 'JsonWebKey2020',
              controller: 'did:web:example.com/test:alias',
              publicKeyJwk: keyPair.publicKey,
            },
            {
              id: 'did:web:example.com/test:alias#key-1',
              type: 'JsonWebKey2020',
              controller: 'did:web:example.com/test:alias',
              publicKeyJwk: keyPair.publicKey,
            },
            {
              id: 'did:web:example.com/test:alias#key-2',
              type: 'JsonWebKey2020',
              controller: 'did:web:example.com/test:alias',
              publicKeyJwk: keyPair.publicKey,
            },
          ],
          authentication: ['did:web:example.com/test:alias#key-0'],
          assertionMethod: ['did:web:example.com/test:alias#key-0'],
          publicKey: [
            {
              id: 'did:web:example.com/test:alias#key-0',
              type: 'JsonWebKey2020',
              controller: 'did:web:example.com/test:alias',
              publicKeyJwk: keyPair.publicKey,
            },
            {
              id: 'did:web:example.com/test:alias#key-1',
              type: 'JsonWebKey2020',
              controller: 'did:web:example.com/test:alias',
              publicKeyJwk: keyPair.publicKey,
            },
            {
              id: 'did:web:example.com/test:alias#key-2',
              type: 'JsonWebKey2020',
              controller: 'did:web:example.com/test:alias',
              publicKeyJwk: keyPair.publicKey,
            },
          ],
          service: map(pick(didDocServiceFields), services),
        };
        const nockData = nock('https://example.com/test')
          .get('/alias/did.json')
          .reply(200, didWebDoc);

        const payload = {
          profile: orgProfile,
          serviceEndpoints: services,
          byoDid: 'did:web:example.com%2Ftest:alias',
          keys: [
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[0].id,
              ),
              purposes: [KeyPurposes.DLT_TRANSACTIONS],
            },
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[1].id,
              ),
              purposes: [KeyPurposes.ISSUING_METADATA],
            },
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[2].id,
              ),
              purposes: [KeyPurposes.EXCHANGES],
            },
          ],
        };
        const monitorNockScope = setMonitorEventsNock();

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(201);

        const did = response.json.id;

        // json response checks
        expect(did).toMatch(expectedDidWebDoc.id);
        expect(response.json).toEqual(
          expectedCreateFullOrganizationResponse(did, orgProfile, services, {
            keys: payload.keys,
            profile: {
              permittedVelocityServiceCategory: [
                'CredentialAgentOperator',
                'IdDocumentIssuer',
                'IdentityIssuer',
              ],
            },
            authClients: [
              {
                clientId: expect.stringMatching(NANO_ID_FORMAT),
                clientSecret: expect.stringMatching(NANO_ID_FORMAT),
                clientType: 'agent',
                serviceId: '#acme-1',
                type: 'auth0',
              },
            ],
          }),
        );

        // organization entity checks
        const orgFromDb = await getOrganizationFromDb(did);
        expect(orgFromDb).toEqual(
          expectedOrganization(did, orgProfile, services, {
            authClients: response.json.authClients,
            profile: {
              permittedVelocityServiceCategory: [
                'CredentialAgentOperator',
                'IdDocumentIssuer',
                'IdentityIssuer',
              ],
            },
            didNotCustodied: true,
          }),
        );
        const credentialPayload = decodeCredentialJwt(
          orgFromDb.signedProfileVcJwt.signedCredential,
        );
        expect(credentialPayload).toEqual({
          credentialSubject: {
            ...publicProfileMatcher(orgProfile),
            id: did,
            permittedVelocityServiceCategory: [
              'CredentialAgentOperator',
              'IdDocumentIssuer',
              'IdentityIssuer',
            ],
          },
          id: expect.stringMatching(UUID_FORMAT),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });

        // key entity checks
        const dbKeys = await getKeysFromDb(orgFromDb);
        expect(dbKeys).toEqual(
          expect.arrayContaining(
            map(mapResponseKeyToDbKey, response.json.keys),
          ),
        );
        expect(dbKeys).toHaveLength(5);

        // consent entity checks
        expect(await getConsentsFromDb(orgFromDb)).toEqual(
          expectedConsents(orgFromDb, services, testRegistrarSuperUser),
        );

        expect(mockAuth0UserUpdate.mock.callCount()).toEqual(0);

        expect(mockAuth0ClientGrantCreate.mock.callCount()).toEqual(1);

        expect(postMonitorNockExecuted(monitorNockScope)).toEqual(true);

        expect(mockUpdateAddressScopes.mock.callCount()).toEqual(1);
        expect(
          mockUpdateAddressScopes.mock.calls.map((call) => call.arguments),
        ).toContainEqual([
          expectedAuth0ScopeChanges(orgFromDb.ids.ethereumAccount, [
            'transactions:write',
            'credential:revoke',
            'credential:identityissue',
          ]),
        ]);
        expect(nockData.isDone()).toEqual(true);
      });

      it('Should throw error if byodid already exists', async () => {
        const nockData = nock('https://example.com')
          .get('/.well-known/did.json')
          .reply(200, expectedDidWebDoc);

        const payload = {
          profile: orgProfile,
          serviceEndpoints: [],
          byoDid: expectedDidWebDoc.id,
          keys: [
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[0].id,
              ),
              purposes: [KeyPurposes.DLT_TRANSACTIONS],
            },
          ],
        };
        await persistOrganization({
          service: [],
          didDocId: expectedDidWebDoc.id,
          name: 'mock-1',
        });
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toStrictEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'organization_already_exists',
            message: 'Organization already exists',
            statusCode: 400,
          }),
        );
        expect(nockData.isDone()).toEqual(false);
      });

      it('Should throw error when keys are not provided', async () => {
        nock('https://example.com')
          .get('/.well-known/did.json')
          .reply(200, expectedDidWebDoc);

        const payload = {
          profile: orgProfile,
          byoDid: expectedDidWebDoc.id,
          keys: [],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toStrictEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'Keys are required for BYO DID',
            statusCode: 400,
          }),
        );
      });

      it('Should throw error when DLT_TRANSACTION key is not provided', async () => {
        nock('https://example.com')
          .get('/.well-known/did.json')
          .reply(200, expectedDidWebDoc);

        const payload = {
          profile: orgProfile,
          byoDid: expectedDidWebDoc.id,
          keys: [
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[0].id,
              ),
              purposes: ['some-other-purpose'],
            },
          ],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toStrictEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'Keys must include DLT_TRANSACTIONS purpose',
            statusCode: 400,
          }),
        );
      });

      it('Should throw error when did does not resolved', async () => {
        const payload = {
          profile: orgProfile,
          byoDid: expectedDidWebDoc.id,
          keys: [
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[0].id,
              ),
              purposes: ['DLT_TRANSACTIONS'],
            },
          ],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toStrictEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'did_resolution_failed',
            message: 'Could not resolve did:web:example.com',
            statusCode: 400,
          }),
        );
      });

      it('Should throw error when no service in did document', async () => {
        const nockData = nock('https://example.com')
          .get('/.well-known/did.json')
          .reply(200, {
            ...expectedDidWebDoc,
            service: undefined,
          });
        const payload = {
          profile: orgProfile,
          byoDid: expectedDidWebDoc.id,
          keys: [
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[0].id,
              ),
              purposes: ['DLT_TRANSACTIONS'],
            },
          ],
          serviceEndpoints: [
            {
              id: '#acme-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toStrictEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'Service with ID #acme-1 does not exist',
            statusCode: 400,
          }),
        );
        expect(nockData.isDone()).toEqual(true);
      });

      it('Should throw error when resolved did does not have DTL_TRANSACTIONS key', async () => {
        const nockData = nock('https://example.com')
          .get('/.well-known/did.json')
          .reply(200, {
            ...expectedDidWebDoc,
            verificationMethod: [],
            publicKey: [],
            assertionMethod: [],
          });
        const payload = {
          profile: orgProfile,
          byoDid: expectedDidWebDoc.id,
          keys: [
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[0].id,
              ),
              purposes: ['DLT_TRANSACTIONS'],
            },
          ],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toStrictEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'Key not found in BYO DID',
            statusCode: 400,
          }),
        );
        expect(nockData.isDone()).toEqual(true);
      });

      it('Should throw error when some of key is custodial', async () => {
        nock('https://example.com')
          .get('/.well-known/did.json')
          .reply(200, expectedDidWebDoc);
        const payload = {
          profile: orgProfile,
          serviceEndpoints: [],
          byoDid: expectedDidWebDoc.id,
          keys: [
            {
              kidFragment: toRelativeKeyId(
                expectedDidWebDoc.verificationMethod[0].id,
              ),
              purposes: [KeyPurposes.DLT_TRANSACTIONS],
              custodial: true,
            },
          ],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: fullUrl,
          payload,
          headers: {
            'x-auto-activate': '1',
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toStrictEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'Keys must be non-custodial',
            statusCode: 400,
          }),
        );
      });
    });

    describe('DID:WEB get full organizations', () => {
      it('should return did:web organization', async () => {
        const services = [
          {
            id: '#service-1',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://example1.com',
          },
          {
            id: '#service-2',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://example2.com',
            logoUrl: 'https://example.com/logo.jpg',
          },
        ];

        const organization = await persistOrganization({
          service: services,
          name: 'Did web org',
          didDocId: expectedDidWebDoc.id,
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: fullUrl,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            buildFullOrganizationResponse({
              organization,
              services: buildPublicServices(services),
            }),
          ],
        });
      });
    });
  });

  const blockchainContractExpectations = (organization, dbKeys) => {
    expect(mockInitPermission.mock.callCount()).toEqual(3);
    expect(mockInitPermission.mock.calls[0].arguments).toEqual([
      {
        contractAddress: fastify.config.permissionsContractAddress,
        privateKey: fastify.config.rootPrivateKey,
        rpcProvider: expect.any(Object),
      },
      expect.any(Object),
    ]);
    expect(mockInitPermission.mock.calls[1].arguments).toEqual([
      {
        contractAddress: fastify.config.permissionsContractAddress,
        privateKey: expect.any(String),
        rpcProvider: expect.any(Object),
      },
      expect.any(Object),
    ]);
    expect(mockAddPrimary.mock.callCount()).toEqual(1);
    const permissioningKey = findKeyByPurpose(
      KeyPurposes.PERMISSIONING,
      dbKeys,
    );
    expect(
      mockAddPrimary.mock.calls.map((call) => call.arguments),
    ).toContainEqual([
      {
        primary: organization.ids.ethereumAccount,
        permissioning: toEthereumAddress(
          hexFromJwk(permissioningKey.publicKey, false),
        ),
        rotation: toEthereumAddress(
          hexFromJwk(
            findKeyByPurpose(KeyPurposes.ROTATION, dbKeys).publicKey,
            false,
          ),
        ),
      },
    ]);
    expect(mockAddOperator.mock.callCount()).toEqual(1);
    expect(
      mockAddOperator.mock.calls.map((call) => call.arguments),
    ).toContainEqual([
      {
        operator: toEthereumAddress(
          hexFromJwk(
            findKeyByPurpose(KeyPurposes.DLT_TRANSACTIONS, dbKeys).publicKey,
            false,
          ),
        ),
        primary: organization.ids.ethereumAccount,
      },
    ]);
  };
});

const expectedServices = (services, invitation) => {
  return flow(
    castArray,
    compact,
    map((s) => {
      const result = {
        ...s,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };
      if (invitation != null) {
        result.invitationId = new ObjectId(invitation._id);
      }
      return result;
    }),
  )(services);
};

// eslint-disable-next-line complexity
const expectedOrganization = (did, profile, services = [], overrides = {}) => {
  const didNotCustodied = overrides.didNotCustodied ?? false;
  const result = {
    _id: expect.any(ObjectId),
    profile: {
      ...profile,
      permittedVelocityServiceCategory: flow(
        map((service) => ServiceTypeToCategoryMap[service.type]),
        uniq,
      )(services),
      ...(overrides.profile ?? {}),
    },
    didDoc: didNotCustodied ? { id: did } : expectedDidDoc(did, services),
    didNotCustodied,
    ids: idsMatcher({ did, services, includeMongoId: true }),
    normalizedProfileName: expect.any(String),
    services: expectedServices(services, overrides.invitation),
    activatedServiceIds: map('id', services),
    authClients: map((obj) => {
      const authClient = omit(['clientSecret'], obj);
      if (overrides.activatedServiceIds == null && !isEmpty(services)) {
        authClient.clientGrantIds = [expect.any(String)];
      }
      return authClient;
    }, overrides.authClients ?? []),
    signedProfileVcJwt: {
      credentialId: expect.stringMatching(UUID_FORMAT),
      signedCredential: expect.any(String),
    },
    verifiableCredentialJwt: expect.any(String),
    invitationId: overrides.invitation?._id
      ? new ObjectId(overrides.invitation._id)
      : undefined,
    updatedAt: expect.any(Date),
    createdAt: expect.any(Date),
    ...omit(['authClients', 'profile', 'invitation'], overrides),
  };
  return result;
};

const expectedCreateFullOrganizationResponse = (
  did,
  profile,
  services = [],
  overrides = {},
) => ({
  id: did,
  profile: {
    ...profile,
    id: did,
    verifiableCredentialJwt: expect.any(String),
    createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    permittedVelocityServiceCategory: flow(
      map((service) => ServiceTypeToCategoryMap[service.type]),
      uniq,
    )(services),
    ...(overrides.profile ?? {}),
  },
  keys: [
    ...(isEmpty(overrides.keys)
      ? [
          generateOrganizationKeyMatcher({
            kid: '#vc-signing-key-1',
            purpose: KeyPurposes.ISSUING_METADATA,
            type: 'EcdsaSecp256k1VerificationKey2019',
            custodied: true,
            withPrivateKey: true,
            withKidFragment: true,
          }),
          generateOrganizationKeyMatcher({
            kid: '#eth-account-key-1',
            purpose: KeyPurposes.DLT_TRANSACTIONS,
            type: 'EcdsaSecp256k1VerificationKey2019',
            custodied: true,
            withPrivateKey: true,
            withKidFragment: true,
          }),
          generateOrganizationKeyMatcher({
            kid: '#exchange-key-1',
            purpose: KeyPurposes.EXCHANGES,
            type: 'EcdsaSecp256k1VerificationKey2019',
            custodied: true,
            withPrivateKey: true,
            withKidFragment: true,
          }),
        ]
      : map(
          (key) =>
            generateOrganizationKeyMatcher({
              kid: key.kidFragment,
              purposes: key.purposes,
              withPrivateKey: false,
              withKidFragment: true,
              publicKey: true,
            }),
          overrides.keys,
        )),
    generateOrganizationKeyMatcher({
      kid: expect.stringMatching(/^#vnf-permissioning-[0-9]+$/),
      purpose: KeyPurposes.PERMISSIONING,
      type: 'EcdsaSecp256k1VerificationKey2019',
      withKidFragment: true,
      withPrivateKey: true,
      custodied: true,
    }),
    generateOrganizationKeyMatcher({
      kid: expect.stringMatching(/^#vnf-rotation-[0-9]+$/),
      purpose: KeyPurposes.ROTATION,
      type: 'EcdsaSecp256k1VerificationKey2019',
      withKidFragment: true,
      withPrivateKey: true,
      custodied: true,
    }),
  ],
  didDoc: isEmpty(overrides.keys) ? expectedDidDoc(did, services) : { id: did },
  custodied: isEmpty(overrides.keys),
  authClients: [],
  activatedServiceIds: map('id', services),
  services,
  ids: idsMatcher({ did, services }),
  ...omit(['profile', 'keys'], overrides),
});

const expectedDidDoc = (did, services) => ({
  '@context': expect.any(Object),
  id: did,
  service: map(pick(didDocServiceFields), services),
  assertionMethod: [
    '#vc-signing-key-1',
    '#eth-account-key-1',
    '#exchange-key-1',
  ],
  verificationMethod: [
    {
      controller: did,
      id: '#vc-signing-key-1',
      publicKeyJwk: {
        crv: 'secp256k1',
        kty: 'EC',
        x: expect.any(String),
        y: expect.any(String),
      },
      type: 'EcdsaSecp256k1VerificationKey2019',
    },
    {
      controller: did,
      id: '#eth-account-key-1',
      publicKeyJwk: {
        crv: 'secp256k1',
        kty: 'EC',
        x: expect.any(String),
        y: expect.any(String),
      },
      type: 'EcdsaSecp256k1VerificationKey2019',
    },
    {
      controller: did,
      id: '#exchange-key-1',
      publicKeyJwk: {
        crv: 'secp256k1',
        kty: 'EC',
        x: expect.any(String),
        y: expect.any(String),
      },
      type: 'EcdsaSecp256k1VerificationKey2019',
    },
  ],
});

const expectedConsents = (organization, services, user) =>
  map(
    (service) => ({
      _id: expect.any(ObjectId),
      consentId: expect.any(String),
      organizationId: organization._id,
      serviceId: service.id,
      type: getServiceConsentType(service),
      version: 1,
      userId: user.sub,
      createdAt: expect.any(Date),
    }),
    services,
  );

const expectedAuth0ScopeChanges = (address, scopesToAdd = []) => ({
  address,
  scopesToRemove: without(scopesToAdd, [
    'transactions:write',
    'credential:identityissue',
    'credential:contactissue',
    'credential:revoke',
    'credential:inspect',
    'credential:issue',
  ]),
  scopesToAdd,
});
