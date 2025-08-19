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

// eslint-disable-next-line max-classes-per-file
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const mockSendError = mock.fn(() => undefined);
const mockInitSendError = mock.fn(() => ({
  sendError: mockSendError,
  startProfiling: () => {
    console.log('fake start sentry profiling');
  },
  finishProfiling: () => {
    console.log('fake finish sentry profiling');
  },
}));

mock.module('@verii/error-aggregation', {
  namedExports: {
    initSendError: mockInitSendError,
  },
});

const mockAuth0UserCreate = mock.fn(async (obj) => {
  return { data: { user_id: 'user_id_123', ...obj } };
});
const mockAuth0UserGetByEmail = mock.fn(async () => {
  return { data: [] };
});
const mockAuth0TicketChange = mock.fn(async () => {
  return {
    data: { ticket: undefined },
  };
});
const mockAuth0ClientAssignRole = mock.fn(async (obj) => {
  return { data: { id: nanoid(), ...obj } };
});
class ManagementClient {
  constructor() {
    this.users = {
      create: mockAuth0UserCreate,
      assignRoles: mockAuth0ClientAssignRole,
    };
    this.tickets = { changePassword: mockAuth0TicketChange };
    this.usersByEmail = {
      getByEmail: mockAuth0UserGetByEmail,
    };
  }
}
mock.module('auth0', {
  namedExports: {
    ManagementClient,
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

const { ObjectId } = require('mongodb');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { omit } = require('lodash/fp');
const { ServiceTypes } = require('@verii/organizations-registry');
const { nanoid } = require('nanoid');
const {
  mongoify,
  DEFAULT_GROUP_ID,
  testRegistrarUser,
  testRegistrarSuperUser,
  errorResponseMatcher,
} = require('@verii/tests-helpers');
const console = require('console');
const { NANO_ID_FORMAT } = require('@verii/test-regexes/src/regexes');
const buildFastify = require('./helpers/build-fastify');
const { expectedInvitationSentEmail } = require('./helpers/email-matchers');
const initGroupsFactory = require('../src/entities/groups/factories/groups-factory');
const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');
const initInvitationsFactory = require('../src/entities/invitations/factories/invitations-factory');
const initCredentialSchemaFactory = require('../../endpoints-credential-types-registrar/test/factories/credential-schema-factory');
const { invitationsRepoPlugin } = require('../src/entities/invitations');

const invitationUrl = (did) => `/api/v0.6/organizations/${did}/invitations`;

const mapPayloadToInvitation = (payload, inviter) => ({
  ...payload,
  id: expect.anything(),
  code: expect.any(String),
  createdAt: expect.any(String),
  createdBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
  expiresAt: expect.any(String),
  invitationUrl: expect.any(String),
  inviterDid: inviter.didDoc.id,
  updatedAt: expect.any(String),
  updatedBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
});

const keyIndividuals = {
  adminGivenName: 'A-given-name',
  adminFamilyName: 'A-family-name',
  adminTitle: 'A-title',
  adminEmail: 'admin@email.com',
  signatoryGivenName: 'S-given-name',
  signatoryFamilyName: 'S-family-name',
  signatoryTitle: 'S-title',
  signatoryEmail: 'signatory@email.com',
};

const minKeyIndvidiuals = {
  adminGivenName: 'A-given-name',
  adminFamilyName: 'A-family-name',
  adminEmail: 'admin@email.com',
};

const inviteeProfile = {
  name: 'fooName',
  linkedInProfile: 'https://www.linkedin.com/in/test-profile',
  physicalAddress: {
    line1: '123 Main St',
    line2: 'Suite 123',
    line3: 'New York',
  },
};

describe('Organization invitations test suites', () => {
  let fastify;
  let invitationsRepo;
  let persistOrganization;
  let newOrganization;
  let persistInvitation;
  let persistCredentialSchema;
  let persistGroup;
  let inviterOrganization;

  const clearDb = async () => {
    await mongoDb().collection('organizations').deleteMany({});
    await mongoDb().collection('invitations').deleteMany({});
    await mongoDb().collection('groups').deleteMany({});
    await mongoDb().collection('credentialSchemas').deleteMany({});
  };

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistOrganization, newOrganization } =
      initOrganizationFactory(fastify));
    ({ persistInvitation } = initInvitationsFactory(fastify));
    ({ persistCredentialSchema } = initCredentialSchemaFactory(fastify));
    ({ persistGroup } = initGroupsFactory(fastify));
    invitationsRepo = invitationsRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });
  });

  beforeEach(async () => {
    mockAuth0UserCreate.mock.resetCalls();
    mockAuth0UserGetByEmail.mock.resetCalls();
    mockAuth0ClientAssignRole.mock.resetCalls();
    mockAuth0TicketChange.mock.resetCalls();
    mockSESSendEmail.mock.resetCalls();
    await clearDb();
    inviterOrganization = await persistOrganization({
      service: [
        {
          id: '#caoid',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://www.caoendpoint.com',
        },
      ],
    });
    await persistGroup({
      groupId: DEFAULT_GROUP_ID,
      clientAdminIds: [testRegistrarUser.sub],
      dids: [inviterOrganization.didDoc.id],
    });
  });

  after(async () => {
    await fastify.close();
    mock.reset();
  });

  describe('Create Invitation Test Suite', () => {
    it('should return 404 if did does not exist', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl('did:test:notfound'),
        payload: {
          inviteeEmail: 'test@email.com',
          inviteeService: [],
          inviteeProfile,
          keyIndividuals,
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

    it('should return 400 and invitations_not_supported if did does not have a CAO service', async () => {
      const orgWithoutCAO = await persistOrganization();

      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(orgWithoutCAO.didDoc.id),
        payload: {
          inviteeEmail: 'test@email.com',
          inviteeService: [],
          inviteeProfile,
          keyIndividuals,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'invitations_not_supported',
          message: 'CAO service does not exist',
          statusCode: 400,
        })
      );
    });

    it('should return 400 if keyIndividuals is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: {
          inviteeEmail: 'test@email.com',
          inviteeProfile,
          inviteeService: [],
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: "body must have required property 'keyIndividuals'",
          statusCode: 400,
        })
      );
    });

    it('should return 400 if keyIndividuals.adminGivenName is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: {
          inviteeEmail: 'test@email.com',
          inviteeProfile,
          inviteeService: [],
          keyIndividuals: omit(['adminFamilyName'], keyIndividuals),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            "body/keyIndividuals must have required property 'adminFamilyName'",
          statusCode: 400,
        })
      );
    });

    it('should return 400 if keyIndividuals.adminEmail is badly formatted', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: {
          inviteeEmail: 'test@email.com',
          inviteeProfile,
          inviteeService: [],
          keyIndividuals: { ...minKeyIndvidiuals, adminEmail: 'not-an-email' },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: 'body/keyIndividuals/adminEmail must match format "email"',
          statusCode: 400,
        })
      );
    });

    it('should return 400 if name is missing', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: {
          inviteeEmail: 'test@email.com',
          inviteeService: [],
          inviteeProfile: {},
          keyIndividuals,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: "body/inviteeProfile must have required property 'name'",
          statusCode: 400,
        })
      );
    });

    it('should return 400 if service type is CAO', async () => {
      const service = {
        id: 'did:123#cao',
        type: 'VlcCredentialAgentOperator_v1',
        serviceEndpoint: 'https://one.com',
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: {
          inviteeEmail: 'test@email.com',
          inviteeService: [service],
          inviteeProfile,
          keyIndividuals,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            'body/inviteeService/0/type must be equal to one of the allowed values',
          statusCode: 400,
        })
      );
    });

    it('should return 400 if service endpoint is invalid', async () => {
      const service = {
        id: 'issuer-1',
        type: 'VlcCareerIssuer_v1',
        serviceEndpoint: 'not-valid',
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: {
          inviteeEmail: 'test@email.com',
          inviteeService: [service],
          inviteeProfile,
          keyIndividuals,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'service_endpoint_must_be_ref',
          message: 'serviceEndpoint must be a did service reference',
          statusCode: 400,
        })
      );
    });

    it('should return 400 if service credentialTypes is invalid', async () => {
      const service = {
        id: 'issuer-1',
        type: 'VlcCareerIssuer_v1',
        serviceEndpoint: 'did:123:mock#caoid',
        credentialTypes: ['NOT_SUPPORTED'],
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: {
          inviteeEmail: 'test@email.com',
          inviteeService: [service],
          inviteeProfile,
          keyIndividuals,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'invitee_service_invalid',
          message:
            'Cannot add issuer that issues unsupported credential types NOT_SUPPORTED',
          statusCode: 400,
        })
      );
    });

    it('should return 400 if email is invalid', async () => {
      const service = {
        id: 'issuer-1',
        type: 'VlcCareerIssuer_v1',
        serviceEndpoint: 'did:123:mock#caoid',
      };
      const payload = {
        inviteeEmail: 'email@test.m',
        inviteeService: [service],
        inviteeProfile,
        keyIndividuals,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: { ...payload, inviteeEmail: '?@gmail.com' },
      });
      const response1 = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'bad_invitee_email',
          message:
            'The email address is invalid and the invitation was not sent',
          statusCode: 400,
        })
      );

      expect(response1.statusCode).toEqual(400);
      expect(response1.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'bad_invitee_email',
          message:
            'The email address is invalid and the invitation was not sent',
          statusCode: 400,
        })
      );
    });

    it('should return 400 credential type for service is invalid', async () => {
      await persistCredentialSchema();
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: {
          inviteeEmail: 'test@email.com',
          inviteeService: [
            {
              id: 'issuer-1',
              type: ServiceTypes.CareerIssuerType,
              serviceEndpoint: 'did:123:mock#caoid',
              credentialTypes: ['WrongType'],
            },
          ],
          inviteeProfile: {
            ...inviteeProfile,
            name: 'Given',
          },
          keyIndividuals,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'invitee_service_invalid',
          message:
            'Cannot add issuer that issues unsupported credential types WrongType',
          statusCode: 400,
        })
      );
    });

    describe('Create invitation for Wallet Provider service Test Suite', () => {
      it('Should add organization service type HolderAppProvider', async () => {
        const payload = {
          inviteeEmail: 'test@email.com',
          inviteeService: [
            {
              id: '#holder-1',
              type: ServiceTypes.HolderAppProviderType,
              serviceEndpoint: 'https://example.com',
            },
          ],
          inviteeProfile: {
            ...inviteeProfile,
            name: 'Given',
          },
          keyIndividuals,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: invitationUrl(inviterOrganization.didDoc.id),
          payload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          invitation: {
            id: expect.any(String),
            ...payload,
            code: expect.stringMatching(NANO_ID_FORMAT),
            inviterDid: inviterOrganization.didDoc.id,
            invitationUrl: expect.stringMatching(
              /http:\/\/localhost.test\/invitations\/[_a-zA-Z0-9]+/
            ),
            expiresAt: expect.any(String),
            createdAt: expect.any(String),
            createdBy: testRegistrarSuperUser.sub,
            updatedAt: expect.any(String),
            updatedBy: testRegistrarSuperUser.sub,
          },
          messageCode: 'invitation_sent',
        });
      });
      it('Should add organization service type WebWalletProvider', async () => {
        const payload = {
          inviteeEmail: 'test@email.com',
          inviteeService: [
            {
              id: '#holder-1',
              type: ServiceTypes.WebWalletProviderType,
              serviceEndpoint: 'https://example.com',
            },
          ],
          inviteeProfile: {
            ...inviteeProfile,
            name: 'Given',
          },
          keyIndividuals,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: invitationUrl(inviterOrganization.didDoc.id),
          payload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          invitation: {
            id: expect.any(String),
            ...payload,
            code: expect.stringMatching(NANO_ID_FORMAT),
            inviterDid: inviterOrganization.didDoc.id,
            invitationUrl: expect.stringMatching(
              /http:\/\/localhost.test\/invitations\/[a-zA-Z0-9]+/
            ),
            expiresAt: expect.any(String),
            createdAt: expect.any(String),
            createdBy: testRegistrarSuperUser.sub,
            updatedAt: expect.any(String),
            updatedBy: testRegistrarSuperUser.sub,
          },
          messageCode: 'invitation_sent',
        });
      });
    });

    it('should create invitation with correct service with credential types', async () => {
      const credentialType = await persistCredentialSchema();
      const payload = {
        inviteeEmail: 'test@email.com',
        inviteeService: [
          {
            id: 'issuer-1',
            type: ServiceTypes.CareerIssuerType,
            serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            credentialTypes: [credentialType.credentialType],
          },
        ],
        inviteeProfile: {
          ...inviteeProfile,
          name: 'Given',
        },
        keyIndividuals: minKeyIndvidiuals,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitation: {
          id: expect.any(String),
          ...payload,
          code: expect.stringMatching(NANO_ID_FORMAT),
          inviterDid: inviterOrganization.didDoc.id,
          invitationUrl: expect.stringMatching(
            /http:\/\/localhost.test\/invitations\/[a-zA-Z0-9_-]+/
          ),
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
          createdBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
          updatedAt: expect.any(String),
          updatedBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
        },
        messageCode: 'invitation_sent',
      });
    });

    it('should create invitation with Holder app provider service type', async () => {
      const payload = {
        inviteeEmail: 'test@email.com',
        inviteeService: [
          {
            id: '#holder-1',
            type: ServiceTypes.CareerIssuerType,
            serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
          },
        ],
        inviteeProfile: {
          ...inviteeProfile,
          name: 'Given',
        },
        keyIndividuals: minKeyIndvidiuals,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitation: {
          id: expect.any(String),
          ...payload,
          code: expect.stringMatching(NANO_ID_FORMAT),
          inviterDid: inviterOrganization.didDoc.id,
          invitationUrl: expect.stringMatching(
            /http:\/\/localhost.test\/invitations\/[a-zA-Z0-9_-]+/
          ),
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
          createdBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
          updatedAt: expect.any(String),
          updatedBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
        },
        messageCode: 'invitation_sent',
      });
    });

    it('should send error if send email failed', async () => {
      mockSESSendEmail.mock.mockImplementationOnce(() =>
        // eslint-disable-next-line prefer-promise-reject-errors
        Promise.reject('mocked error')
      );
      const service = {
        id: 'issuer-1',
        type: 'VlcCareerIssuer_v1',
        serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
      };
      const payload = {
        inviteeEmail: 'test@email.com',
        inviteeService: [service],
        inviteeProfile: {
          ...inviteeProfile,
          name: 'Given Family',
        },
        keyIndividuals: minKeyIndvidiuals,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitation: mapPayloadToInvitation(payload, inviterOrganization),
        messageCode: 'invitation_not_sent',
      });

      const invitesFromDb = await invitationsRepo.find();
      expect(invitesFromDb).toEqual([
        {
          _id: expect.anything(),
          code: expect.any(String),
          createdAt: expect.any(Date),
          createdBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
          expiresAt: expect.any(Date),
          invitationUrl: `http://localhost.test/invitations/${invitesFromDb[0].code}`,
          ...payload,
          inviterDid: inviterOrganization.didDoc.id,
          updatedAt: expect.any(Date),
          updatedBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
        },
      ]);

      expect(mockAuth0UserGetByEmail.mock.callCount()).toEqual(1);
      expect(mockAuth0UserCreate.mock.callCount()).toEqual(1);
      expect(mockAuth0TicketChange.mock.callCount()).toEqual(1);

      expect(
        mockAuth0UserGetByEmail.mock.calls.map((call) => call.arguments)
      ).toContainEqual([{ email: 'test@email.com' }]);
      expect(
        mockAuth0UserCreate.mock.calls.map((call) => call.arguments)
      ).toContainEqual([
        {
          app_metadata: { groupId: undefined },
          connection: undefined,
          email: 'test@email.com',
          email_verified: false,
          family_name: 'A-family-name',
          given_name: 'A-given-name',
          password: expect.anything(),
          verify_email: false,
        },
      ]);
      expect(
        mockAuth0ClientAssignRole.mock.calls.map((call) => call.arguments)
      ).toEqual([
        [{ id: 'user_id_123' }, { roles: ['rol_sQZLrbwBEblVBNDj'] }],
        [{ id: 'user_id_123' }, { roles: ['rol_xxx'] }],
      ]);
      expect(
        mockAuth0TicketChange.mock.calls.map((call) => call.arguments)
      ).toContainEqual([
        {
          mark_email_as_verified: true,
          result_url: 'https://ui.example.com',
          ttl_sec: 604800,
          user_id: 'user_id_123',
        },
      ]);

      expect(
        mockSendError.mock.calls.map((call) => call.arguments)
      ).toContainEqual([
        'mocked error',
        {
          err: 'mocked error',
          message: 'Unable to send invitation email to user',
          email: 'test@email.com',
        },
      ]);
    });

    it('should create a profile with only name and one service, return 200, and ensure auth0 user is created & email sent', async () => {
      const service = {
        id: 'issuer-1',
        type: 'VlcCareerIssuer_v1',
        serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
      };
      const payload = {
        inviteeEmail: 'test@email.com',
        inviteeService: [service],
        inviteeProfile: {
          ...inviteeProfile,
          name: 'Given Family',
        },
        keyIndividuals: minKeyIndvidiuals,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitation: mapPayloadToInvitation(payload, inviterOrganization),
        messageCode: 'invitation_sent',
      });

      const invitesFromDb = await invitationsRepo.find();
      expect(invitesFromDb).toEqual([
        {
          _id: expect.anything(),
          code: expect.any(String),
          createdAt: expect.any(Date),
          createdBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
          expiresAt: expect.any(Date),
          invitationUrl: `http://localhost.test/invitations/${invitesFromDb[0].code}`,
          ...payload,
          inviterDid: inviterOrganization.didDoc.id,
          updatedAt: expect.any(Date),
          updatedBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
        },
      ]);

      expect(mockAuth0UserGetByEmail.mock.callCount()).toEqual(1);
      expect(mockAuth0UserCreate.mock.callCount()).toEqual(1);
      expect(mockAuth0TicketChange.mock.callCount()).toEqual(1);

      expect(
        mockAuth0UserGetByEmail.mock.calls.map((call) => call.arguments)
      ).toContainEqual([{ email: 'test@email.com' }]);
      expect(
        mockAuth0UserCreate.mock.calls.map((call) => call.arguments)
      ).toContainEqual([
        {
          app_metadata: { groupId: undefined },
          connection: undefined,
          email: 'test@email.com',
          email_verified: false,
          family_name: 'A-family-name',
          given_name: 'A-given-name',
          password: expect.anything(),
          verify_email: false,
        },
      ]);
      expect(
        mockAuth0ClientAssignRole.mock.calls.map((call) => call.arguments)
      ).toEqual([
        [{ id: 'user_id_123' }, { roles: ['rol_sQZLrbwBEblVBNDj'] }],
        [{ id: 'user_id_123' }, { roles: ['rol_xxx'] }],
      ]);
      expect(
        mockAuth0TicketChange.mock.calls.map((call) => call.arguments)
      ).toContainEqual([
        {
          mark_email_as_verified: true,
          result_url: 'https://ui.example.com',
          ttl_sec: 604800,
          user_id: 'user_id_123',
        },
      ]);
      expect(mockSESSendEmail.mock.calls[0].arguments[0]).toEqual(
        expectedInvitationSentEmail(response.json.invitation.code)
      );
    });

    it('should create a profile with profile.name which can not be split', async () => {
      const service = {
        id: 'issuer-1',
        type: 'VlcCareerIssuer_v1',
        serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
      };
      const payload = {
        inviteeEmail: 'test@email.com',
        inviteeService: [service],
        inviteeProfile: {
          ...inviteeProfile,
          name: 'Given',
        },
        keyIndividuals: minKeyIndvidiuals,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitation: mapPayloadToInvitation(payload, inviterOrganization),
        messageCode: 'invitation_sent',
      });

      const invitesFromDb = await invitationsRepo.find();
      expect(invitesFromDb).toEqual([
        {
          _id: expect.anything(),
          code: expect.any(String),
          createdAt: expect.any(Date),
          createdBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
          expiresAt: expect.any(Date),
          invitationUrl: `http://localhost.test/invitations/${invitesFromDb[0].code}`,
          inviterDid: inviterOrganization.didDoc.id,
          ...payload,
          updatedAt: expect.any(Date),
          updatedBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
        },
      ]);

      expect(mockAuth0UserGetByEmail.mock.callCount()).toEqual(1);
      expect(mockAuth0UserCreate.mock.callCount()).toEqual(1);
      expect(mockAuth0TicketChange.mock.callCount()).toEqual(1);

      expect(
        mockAuth0UserGetByEmail.mock.calls.map((call) => call.arguments)
      ).toContainEqual([{ email: 'test@email.com' }]);
      expect(
        mockAuth0UserCreate.mock.calls.map((call) => call.arguments)
      ).toContainEqual([
        {
          app_metadata: { groupId: undefined },
          connection: undefined,
          email: 'test@email.com',
          email_verified: false,
          family_name: 'A-family-name',
          given_name: 'A-given-name',
          password: expect.anything(),
          verify_email: false,
        },
      ]);
      expect(
        mockAuth0ClientAssignRole.mock.calls.map((call) => call.arguments)
      ).toEqual([
        [{ id: 'user_id_123' }, { roles: ['rol_sQZLrbwBEblVBNDj'] }],
        [{ id: 'user_id_123' }, { roles: ['rol_xxx'] }],
      ]);
      expect(
        mockAuth0TicketChange.mock.calls.map((call) => call.arguments)
      ).toContainEqual([
        {
          mark_email_as_verified: true,
          result_url: 'https://ui.example.com',
          ttl_sec: 604800,
          user_id: 'user_id_123',
        },
      ]);

      expect(mockSESSendEmail.mock.calls[0].arguments[0]).toEqual(
        expectedInvitationSentEmail(response.json.invitation.code)
      );
    });

    it('should create invitation with correct service types', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: {
          inviteeEmail: 'test@email.com',
          keyIndividuals: minKeyIndvidiuals,
          inviteeService: [
            {
              id: 'issuer-1',
              type: ServiceTypes.CareerIssuerType,
              serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            },
            {
              id: 'issuer-1',
              type: ServiceTypes.IdDocumentIssuerType,
              serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            },
            {
              id: 'issuer-1',
              type: ServiceTypes.NotaryIssuerType,
              serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            },
            {
              id: 'issuer-1',
              type: ServiceTypes.InspectionType,
              serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            },
          ],
          inviteeProfile: {
            ...inviteeProfile,
            name: 'Given',
          },
        },
      });

      expect(response.statusCode).toEqual(200);
    });

    it('should create invitation with key individuals', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: {
          inviteeEmail: 'test@email.com',
          inviteeService: [
            {
              id: 'issuer-1',
              type: ServiceTypes.CareerIssuerType,
              serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            },
            {
              id: 'issuer-1',
              type: ServiceTypes.IdDocumentIssuerType,
              serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            },
            {
              id: 'issuer-1',
              type: ServiceTypes.NotaryIssuerType,
              serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            },
            {
              id: 'issuer-1',
              type: ServiceTypes.InspectionType,
              serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
            },
          ],
          inviteeProfile: {
            ...inviteeProfile,
            name: 'Given',
          },
          keyIndividuals,
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json.invitation.keyIndividuals).toEqual(keyIndividuals);
    });
    it('should reuse a an existing user if they have already signed up', async () => {
      mockAuth0UserGetByEmail.mock.mockImplementationOnce(async (email) => {
        return { data: [{ user_id: 'user_id_123', logins_count: 1, email }] };
      });
      const payload = {
        inviteeEmail: 'test@email.com',
        inviteeService: [
          {
            id: 'issuer-1',
            type: 'VlcCareerIssuer_v1',
            serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
          },
        ],
        inviteeProfile: {
          ...inviteeProfile,
          name: 'Given Family',
        },
        keyIndividuals: minKeyIndvidiuals,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload,
        headers: {
          'x-override-oauth-user': JSON.stringify(testRegistrarUser),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitation: mapPayloadToInvitation(payload, inviterOrganization),
        messageCode: 'invitation_sent',
      });
      const invitesFromDb = await invitationsRepo.find();
      expect(invitesFromDb).toEqual([
        {
          ...payload,
          invitationUrl: `http://localhost.test/invitations/${invitesFromDb[0].code}`,
          inviterDid: inviterOrganization.didDoc.id,
          _id: expect.anything(),
          code: expect.any(String),
          createdAt: expect.any(Date),
          createdBy: testRegistrarUser.sub,
          expiresAt: expect.any(Date),
          updatedAt: expect.any(Date),
          updatedBy: testRegistrarUser.sub,
        },
      ]);
      expect(mockAuth0UserGetByEmail.mock.callCount()).toEqual(1);
      expect(mockAuth0UserCreate.mock.callCount()).toEqual(0);
      expect(mockAuth0ClientAssignRole.mock.callCount()).toEqual(0);
      expect(mockAuth0TicketChange.mock.callCount()).toEqual(0);
      expect(mockSESSendEmail.mock.calls[0].arguments[0]).toEqual(
        expectedInvitationSentEmail(response.json.invitation.code)
      );
    });

    // eslint-disable-next-line max-len
    it('should create two profiles for different organizations with the same auth0 user, ensure only one version of the user is created, and send two emails', async () => {
      const ticket = 'https://ticket.com?pass=123';
      mockAuth0TicketChange.mock.mockImplementationOnce(async () => {
        return {
          data: {
            ticket,
          },
        };
      });
      mockAuth0UserGetByEmail.mock.mockImplementationOnce(async () => {
        return { data: [] };
      });
      mockAuth0UserGetByEmail.mock.mockImplementationOnce(async () => {
        return { data: [{ user_id: 'user_id_123' }] };
      });

      const payload1 = {
        inviteeEmail: 'test@email.com',
        inviteeService: [
          {
            id: 'issuer-1',
            type: 'VlcCareerIssuer_v1',
            serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
          },
        ],
        inviteeProfile: {
          ...inviteeProfile,
          name: 'Given Family',
        },
        keyIndividuals: minKeyIndvidiuals,
      };
      const payload2 = {
        inviteeEmail: 'test@email.com',
        inviteeService: [
          {
            id: 'issuer-2',
            type: 'VlcCareerIssuer_v1',
            serviceEndpoint: `${inviterOrganization.didDoc.id}#caoid`,
          },
        ],
        inviteeProfile: {
          ...inviteeProfile,
          name: 'Given Family',
        },
        keyIndividuals: minKeyIndvidiuals,
      };
      const response1 = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: payload1,
      });

      const response2 = await fastify.injectJson({
        method: 'POST',
        url: invitationUrl(inviterOrganization.didDoc.id),
        payload: payload2,
      });

      expect(response1.statusCode).toEqual(200);
      expect(response1.json).toEqual({
        invitation: mapPayloadToInvitation(payload1, inviterOrganization),
        messageCode: 'invitation_sent',
      });
      expect(response2.statusCode).toEqual(200);
      expect(response2.json).toEqual({
        invitation: mapPayloadToInvitation(payload2, inviterOrganization),
        messageCode: 'invitation_sent',
      });

      const invitesFromDb = await invitationsRepo.find();
      expect(invitesFromDb).toEqual([
        {
          ...payload2,
          invitationUrl: `http://localhost.test/invitations/${invitesFromDb[0].code}`,
          inviterDid: inviterOrganization.didDoc.id,
          _id: expect.anything(),
          code: expect.any(String),
          createdAt: expect.any(Date),
          createdBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
          expiresAt: expect.any(Date),
          updatedAt: expect.any(Date),
          updatedBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
        },
        {
          ...payload1,
          invitationUrl: `http://localhost.test/invitations/${invitesFromDb[1].code}`,
          inviterDid: inviterOrganization.didDoc.id,
          _id: expect.anything(),
          code: expect.any(String),
          createdAt: expect.any(Date),
          createdBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
          expiresAt: expect.any(Date),
          updatedAt: expect.any(Date),
          updatedBy: expect.stringMatching(/auth0|[A-Za-z0-9_-]+/),
        },
      ]);

      expect(mockAuth0UserGetByEmail.mock.callCount()).toEqual(2);
      expect(mockAuth0UserCreate.mock.callCount()).toEqual(1);
      expect(mockAuth0TicketChange.mock.callCount()).toEqual(2);

      expect(mockAuth0UserGetByEmail.mock.calls[0].arguments[0]).toEqual({
        email: 'test@email.com',
      });
      expect(mockAuth0UserGetByEmail.mock.calls[1].arguments[0]).toEqual({
        email: 'test@email.com',
      });
      expect(
        mockAuth0UserCreate.mock.calls.map((call) => call.arguments)
      ).toContainEqual([
        {
          app_metadata: { groupId: undefined },
          connection: undefined,
          email: 'test@email.com',
          email_verified: false,
          family_name: 'A-family-name',
          given_name: 'A-given-name',
          password: expect.anything(),
          verify_email: false,
        },
      ]);
      expect(
        mockAuth0ClientAssignRole.mock.calls.map((call) => call.arguments)
      ).toEqual([
        [{ id: 'user_id_123' }, { roles: ['rol_sQZLrbwBEblVBNDj'] }],
        [{ id: 'user_id_123' }, { roles: ['rol_xxx'] }],
      ]);
      expect(mockAuth0TicketChange.mock.callCount()).toEqual(2);
      expect(
        mockAuth0TicketChange.mock.calls.map((call) => call.arguments)
      ).toContainEqual([
        {
          mark_email_as_verified: true,
          result_url: 'https://ui.example.com',
          ttl_sec: 604800,
          user_id: 'user_id_123',
        },
      ]);

      expect(mockSESSendEmail.mock.calls[0].arguments[0]).toEqual(
        expectedInvitationSentEmail(
          `${response1.json.invitation.code}?signup_url=${encodeURIComponent(
            ticket
          )}`
        )
      );
      expect(mockSESSendEmail.mock.calls[1].arguments[0]).toEqual(
        expectedInvitationSentEmail(response2.json.invitation.code)
      );
    });
  });

  describe('Get Invitations Test Suite', () => {
    it('should return 404 if did does not exist', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: invitationUrl('did:test:not-found'),
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

    it('should return empty array if no invitations', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: invitationUrl(inviterOrganization.didDoc.id),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitations: [],
      });
    });

    it('should return paginated array of invitations', async () => {
      const inviterDid = inviterOrganization.didDoc.id;
      const inviteeOrganization = await newOrganization({
        service: [
          {
            id: '#foo',
            type: 'VlcCareerIssuer_v1',
            serviceEndpoint: 'did:mocked:1123#bar',
          },
        ],
      });
      const [invitation5, invitation6, invitation1, invitation4] =
        await Promise.all([
          persistInvitation({
            inviterOrganization,
            inviteeOrganization,
            inviteeEmail: 'em-5@email.com',
            keyIndividuals: minKeyIndvidiuals,
          }),
          persistInvitation({
            inviterOrganization,
            inviteeOrganization,
            inviteeEmail: 'em-6@email.com',
            keyIndividuals: minKeyIndvidiuals,
          }),
          persistInvitation({
            inviterOrganization,
            inviteeOrganization,
            inviteeEmail: 'em-1@email.com',
            keyIndividuals,
          }),
          persistInvitation({
            inviterOrganization,
            inviteeOrganization,
            inviteeEmail: 'em-4@email.com',
            keyIndividuals: minKeyIndvidiuals,
            inviteeService: [
              {
                id: '#foo',
                type: 'foo',
                serviceEndpoint: 'https://foo#bar',
              },
            ],
          }),
        ]);

      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${inviterDid}/invitations?page.size=2&page.skip=0&sort[0]=inviteeEmail,DESC`,
      });
      const response1 = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${inviterDid}/invitations?page.size=2&page.skip=1&sort[0]=inviteeEmail,DESC`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitations: [
          invitationResponseExpectation(invitation6),
          invitationResponseExpectation(invitation5),
        ],
      });

      expect(response1.statusCode).toEqual(200);
      expect(response1.json).toEqual({
        invitations: [
          invitationResponseExpectation(invitation4, {
            inviteeService: [
              {
                id: '#foo',
                type: 'foo',
                serviceEndpoint: 'https://foo#bar',
              },
            ],
          }),
          invitationResponseExpectation(invitation1, {
            keyIndividuals,
          }),
        ],
      });
    });
  });

  describe('Delete Invitation Test Suite', () => {
    beforeEach(async () => {
      inviterOrganization = await persistOrganization();
    });

    it('should delete an invitation', async () => {
      const invitation = await persistInvitation({
        inviterOrganization,
      });

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v0.6/organizations/${
          inviterOrganization.didDoc.id
        }/invitations/${invitation._id.toString()}`,
      });

      expect(response.statusCode).toEqual(204);
      const deletedInvitation = await invitationsRepo.findOne({
        filter: {
          _id: invitation._id.toString(),
        },
      });
      expect(deletedInvitation).toBeNull();
    });

    it('should return 404 if invitation id is not object id', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v0.6/organizations/${inviterOrganization.didDoc.id}/invitations/foo`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'invitation_not_found',
          message: 'Invitation not found',
          statusCode: 404,
        })
      );
    });

    it('3should return 404 if invitation does not exist in db', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v0.6/organizations/${inviterOrganization.didDoc.id}/invitations/5f4d2e1e9f9b7f0b8c5b7f4c`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'invitation_not_found',
          message: 'Invitation not found',
          statusCode: 404,
        })
      );
    });
  });

  describe('Get Invitation Test Suite', () => {
    beforeEach(async () => {
      inviterOrganization = await persistOrganization();
    });

    it('should return 404 if invitation does not exist', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v0.6/organizations/${inviterOrganization.didDoc.id}/invitations/5f4d2e1e9f9b7f0b8c5b7f4c`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'invitation_not_found',
          message: 'Invitation not found',
          statusCode: 404,
        })
      );
    });

    it('should return 404 if invitation has deletedAt', async () => {
      const invitation = await persistInvitation({
        inviterOrganization,
        code: 'fooCode',
        inviteeDid: 'fooInviteeDid',
        inviteeProfile: {
          ...inviteeProfile,
          name: 'fooName',
          description: 'fooDescription',
        },
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'foo#bar',
          },
        ],
        invitationUrl: 'http://foo,invitation',
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
        deletedBy: 'fooUser1',
        deletedAt: new Date(),
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v0.6/organizations/${
          inviterOrganization.didDoc.id
        }/invitations/${invitation._id.toString()}`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'invitation_not_found',
          message: 'Invitation not found',
          statusCode: 404,
        })
      );

      const invitationFromDb = await invitationsRepo
        .collection()
        .find()
        .toArray();
      expect(invitationFromDb).toEqual([
        {
          _id: new ObjectId(invitation._id),
          inviterDid: inviterOrganization.didDoc.id,
          inviteeDid: 'fooInviteeDid',
          inviteeEmail: 'foo@example.com',
          inviteeProfile: {
            ...inviteeProfile,
            name: 'fooName',
            description: 'fooDescription',
          },
          inviteeService: [
            {
              id: '#foo',
              type: 'foo',
              serviceEndpoint: 'foo#bar',
            },
          ],
          invitationUrl: 'http://foo,invitation',
          code: 'fooCode',
          createdBy: 'fooUser1',
          updatedBy: 'fooUser1',
          deletedBy: 'fooUser1',
          expiresAt: expect.any(Date),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deletedAt: expect.any(Date),
        },
      ]);
    });

    it('should return an invitation', async () => {
      const invitation = await persistInvitation({
        inviterOrganization,
        code: 'fooCode',
        inviteeDid: 'fooInviteeDid',
        inviteeProfile: {
          name: 'Some Name',
          contactEmail: 'contact@betacorp.com',
          description: 'Invitee org 1 for tesing 4268',
          founded: '2023',
          closed: '2024',
          location: {
            countryCode: 'BY',
          },
          logo: 'https://betacorp.com/logo.png',
          technicalEmail: 'support@betacorp.com',
          type: 'company',
          website: 'http://betacorp.com',
          linkedInProfile: 'https://www.linkedin.com/in/test-profile',
          physicalAddress: {
            line1: '123 Main St',
            line2: 'Suite 123',
            line3: 'New York',
          },
        },
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'foo#bar',
          },
        ],
        invitationUrl: 'http://foo,invitation',
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
        keyIndividuals,
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v0.6/organizations/${
          inviterOrganization.didDoc.id
        }/invitations/${invitation._id.toString()}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json()).toEqual({
        invitation: {
          id: invitation._id.toString(),
          inviterDid: inviterOrganization.didDoc.id,
          inviteeDid: 'fooInviteeDid',
          inviteeEmail: 'foo@example.com',
          inviteeProfile: invitation.inviteeProfile,
          inviteeService: [
            {
              id: '#foo',
              type: 'foo',
              serviceEndpoint: 'foo#bar',
            },
          ],
          invitationUrl: 'http://foo,invitation',
          code: 'fooCode',
          createdBy: 'fooUser1',
          updatedBy: 'fooUser1',
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          keyIndividuals,
        },
      });
    });

    it('should return an invitation from did in alsoKnownAs', async () => {
      const alsoKnownAs = 'did:aka:foo';
      inviterOrganization = await persistOrganization({
        alsoKnownAs,
      });
      const invitation = await persistInvitation({
        inviterOrganization,
        inviterDid: alsoKnownAs,
        code: 'fooCode',
        inviteeDid: 'fooInviteeDid',
        inviteeProfile: {
          name: 'Some Name',
          contactEmail: 'contact@betacorp.com',
          description: 'Invitee org 1 for tesing 4268',
          founded: '2023',
          closed: '2024',
          location: {
            countryCode: 'BY',
          },
          logo: 'https://betacorp.com/logo.png',
          technicalEmail: 'support@betacorp.com',
          type: 'company',
          website: 'http://betacorp.com',
          linkedInProfile: 'https://www.linkedin.com/in/test-profile',
          physicalAddress: {
            line1: '123 Main St',
            line2: 'Suite 123',
            line3: 'New York',
          },
        },
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'foo#bar',
          },
        ],
        invitationUrl: 'http://foo,invitation',
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
        keyIndividuals,
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v0.6/organizations/${alsoKnownAs}/invitations/${invitation._id.toString()}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json()).toEqual({
        invitation: {
          id: invitation._id.toString(),
          inviterDid: alsoKnownAs,
          inviteeDid: 'fooInviteeDid',
          inviteeEmail: 'foo@example.com',
          inviteeProfile: invitation.inviteeProfile,
          inviteeService: [
            {
              id: '#foo',
              type: 'foo',
              serviceEndpoint: 'foo#bar',
            },
          ],
          invitationUrl: 'http://foo,invitation',
          code: 'fooCode',
          createdBy: 'fooUser1',
          updatedBy: 'fooUser1',
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          keyIndividuals,
        },
      });
    });
  });

  describe('Resend Invitation Test Suite', () => {
    beforeEach(async () => {
      inviterOrganization = await persistOrganization();
    });

    it('should return 404 if email ivalid', async () => {
      const payload = {
        inviteeEmail: '1@ti',
      };
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v0.6/organizations/${inviterOrganization.didDoc.id}/invitations/invitationId`,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'bad_invitee_email',
          message:
            'The email address is invalid and the invitation was not sent',
          statusCode: 400,
        })
      );
    });

    it('should return 404 if did not matched', async () => {
      const invitation = await persistInvitation({
        inviterOrganization,
        code: 'fooCode',
        inviteeDid: 'fooInviteeDid',
        inviteeProfile: {
          ...inviteeProfile,
          name: 'fooName',
        },
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'foo#bar',
          },
        ],
        invitationUrl: 'http://fooinvitation',
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
      });
      const notMatchedOrg = await persistOrganization();
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v0.6/organizations/${
          notMatchedOrg.didDoc.id
        }/invitations/${invitation._id.toString()}`,
        payload: {
          inviteeEmail: 'email@email.com',
        },
      });

      expect(mockAuth0TicketChange.mock.callCount()).toEqual(0);
      expect(mockAuth0UserGetByEmail.mock.callCount()).toEqual(0);
      expect(mockSESSendEmail.mock.callCount()).toEqual(0);
      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'invitation_not_found',
          message: 'Invitation not found',
          statusCode: 404,
        })
      );
    });

    it('should return 404 if invitation does not exist', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v0.6/organizations/${inviterOrganization.didDoc.id}/invitations/5f4d2e1e9f9b7f0b8c5b7f4c`,
        payload: {
          inviteeEmail: 'email@email.com',
        },
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'invitation_not_found',
          message: 'Invitation not found',
          statusCode: 404,
        })
      );
    });

    it('should return 404 if invitation has deletedAt', async () => {
      const invitation = await persistInvitation({
        inviterOrganization,
        code: 'fooCode',
        inviteeDid: 'fooInviteeDid',
        inviteeProfile: {
          ...inviteeProfile,
          name: 'fooName',
          description: 'fooDescription',
        },
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'foo#bar',
          },
        ],
        invitationUrl: 'http://foo,invitation',
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
        deletedBy: 'fooUser1',
        deletedAt: new Date(),
      });

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v0.6/organizations/${
          inviterOrganization.didDoc.id
        }/invitations/${invitation._id.toString()}`,
        payload: {
          inviteeEmail: 'email@email.com',
        },
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'invitation_not_found',
          message: 'Invitation not found',
          statusCode: 404,
        })
      );

      const invitationFromDb = await invitationsRepo
        .collection()
        .find()
        .toArray();
      expect(invitationFromDb).toEqual([
        {
          _id: new ObjectId(invitation._id),
          inviterDid: inviterOrganization.didDoc.id,
          inviteeDid: 'fooInviteeDid',
          inviteeEmail: 'foo@example.com',
          inviteeProfile: {
            ...inviteeProfile,
            name: 'fooName',
            description: 'fooDescription',
          },
          inviteeService: [
            {
              id: '#foo',
              type: 'foo',
              serviceEndpoint: 'foo#bar',
            },
          ],
          invitationUrl: 'http://foo,invitation',
          code: 'fooCode',
          createdBy: 'fooUser1',
          updatedBy: 'fooUser1',
          deletedBy: 'fooUser1',
          expiresAt: expect.any(Date),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deletedAt: expect.any(Date),
        },
      ]);
    });

    it('Should resend invitation', async () => {
      const ticket = 'https://ticket.com?pass=123';
      mockAuth0UserGetByEmail.mock.mockImplementationOnce(async () => {
        return { data: [] };
      });
      mockAuth0TicketChange.mock.mockImplementationOnce(async () => {
        return {
          data: {
            ticket,
          },
        };
      });
      const invitation = await persistInvitation({
        inviterOrganization,
        code: 'fooCode',
        inviteeDid: 'fooInviteeDid',
        inviteeProfile: {
          ...inviteeProfile,
          name: 'fooName',
        },
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'foo#bar',
          },
        ],
        keyIndividuals: minKeyIndvidiuals,
        invitationUrl: 'http://fooinvitation',
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `/api/v0.6/organizations/${
          inviterOrganization.didDoc.id
        }/invitations/${invitation._id.toString()}`,
        payload: {
          inviteeEmail: 'email123@email.com',
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitation: {
          id: invitation._id.toString(),
          inviterDid: inviterOrganization.didDoc.id,
          inviteeDid: 'fooInviteeDid',
          inviteeEmail: 'email123@email.com',
          inviteeProfile: {
            ...inviteeProfile,
            name: 'fooName',
          },
          inviteeService: [
            {
              id: '#foo',
              type: 'foo',
              serviceEndpoint: 'foo#bar',
            },
          ],
          keyIndividuals: minKeyIndvidiuals,
          invitationUrl: expect.stringMatching(
            /http:\/\/localhost.test\/invitations\/[a-zA-Z0-9_-]+/
          ),
          code: expect.stringMatching(NANO_ID_FORMAT),
          createdBy: 'fooUser1',
          updatedBy: 'fooUser1',
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        messageCode: 'invitation_sent',
      });

      const dbInvitation = await invitationsRepo.findOne(invitation._id);
      expect(dbInvitation).toEqual({
        _id: expect.anything(),
        inviterDid: inviterOrganization.didDoc.id,
        inviteeDid: 'fooInviteeDid',
        inviteeEmail: 'email123@email.com',
        inviteeProfile: {
          ...inviteeProfile,
          name: 'fooName',
        },
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'foo#bar',
          },
        ],
        keyIndividuals: minKeyIndvidiuals,
        invitationUrl: expect.stringMatching(
          /http:\/\/localhost.test\/invitations\/[a-zA-Z0-9_-]+/
        ),
        code: expect.stringMatching(NANO_ID_FORMAT),
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
        expiresAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(dbInvitation.expiresAt.getTime()).toBeGreaterThan(
        mongoify(invitation).updatedAt.getTime()
      );

      expect(mockAuth0UserGetByEmail.mock.callCount()).toEqual(1);
      expect(mockAuth0UserCreate.mock.callCount()).toEqual(1);
      expect(mockAuth0TicketChange.mock.callCount()).toEqual(1);

      expect(
        mockAuth0UserGetByEmail.mock.calls.map((call) => call.arguments)
      ).toContainEqual([{ email: 'email123@email.com' }]);
      expect(
        mockAuth0ClientAssignRole.mock.calls.map((call) => call.arguments)
      ).toEqual([
        [{ id: 'user_id_123' }, { roles: ['rol_sQZLrbwBEblVBNDj'] }],
        [{ id: 'user_id_123' }, { roles: ['rol_xxx'] }],
      ]);
      expect(
        mockAuth0TicketChange.mock.calls.map((call) => call.arguments)
      ).toContainEqual([
        {
          mark_email_as_verified: true,
          result_url: 'https://ui.example.com',
          ttl_sec: 604800,
          user_id: 'user_id_123',
        },
      ]);
      expect(mockSESSendEmail.mock.calls[0].arguments[0]).toEqual(
        expectedInvitationSentEmail(
          `${response.json.invitation.code}?signup_url=${encodeURIComponent(
            ticket
          )}`,
          'email123@email.com'
        )
      );
    });

    it('Should resend invitation without creating a user', async () => {
      mockAuth0UserGetByEmail.mock.mockImplementationOnce(async () => {
        return { data: [{ user_id: 'user_id_123' }] };
      });
      const ticket = 'https://ticket.com?pass=123';
      mockAuth0TicketChange.mock.mockImplementationOnce(async () => {
        return {
          data: {
            ticket,
          },
        };
      });
      const invitation = await persistInvitation({
        inviterOrganization,
        code: 'fooCode',
        inviteeDid: 'fooInviteeDid',
        inviteeProfile: {
          ...inviteeProfile,
          name: 'fooName',
        },
        keyIndividuals,
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'foo#bar',
          },
        ],
        invitationUrl: 'http://fooinvitation',
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `/api/v0.6/organizations/${
          inviterOrganization.didDoc.id
        }/invitations/${invitation._id.toString()}`,
        payload: {
          inviteeEmail: 'email123@email.com',
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitation: {
          id: invitation._id.toString(),
          inviterDid: inviterOrganization.didDoc.id,
          inviteeDid: 'fooInviteeDid',
          inviteeEmail: 'email123@email.com',
          inviteeProfile: {
            ...inviteeProfile,
            name: 'fooName',
          },
          inviteeService: [
            {
              id: '#foo',
              type: 'foo',
              serviceEndpoint: 'foo#bar',
            },
          ],
          keyIndividuals,
          invitationUrl: expect.stringMatching(
            /http:\/\/localhost.test\/invitations\/[a-zA-Z0-9_-]+/
          ),
          code: expect.stringMatching(NANO_ID_FORMAT),
          createdBy: 'fooUser1',
          updatedBy: 'fooUser1',
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        messageCode: 'invitation_sent',
      });

      const dbInvitation = await invitationsRepo.findOne(invitation._id);
      expect(dbInvitation).toEqual({
        _id: expect.anything(),
        inviterDid: inviterOrganization.didDoc.id,
        inviteeDid: 'fooInviteeDid',
        inviteeEmail: 'email123@email.com',
        inviteeProfile: {
          ...inviteeProfile,
          name: 'fooName',
        },
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'foo#bar',
          },
        ],
        keyIndividuals,
        invitationUrl: expect.stringMatching(
          /http:\/\/localhost.test\/invitations\/[a-zA-Z0-9_-]+/
        ),
        code: expect.stringMatching(NANO_ID_FORMAT),
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
        expiresAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(dbInvitation.expiresAt.getTime()).toBeGreaterThan(
        mongoify(invitation).updatedAt.getTime()
      );

      expect(mockAuth0UserGetByEmail.mock.callCount()).toEqual(1);
      expect(mockAuth0UserCreate.mock.callCount()).toEqual(0);
      expect(mockAuth0ClientAssignRole.mock.callCount()).toEqual(0);
      expect(mockAuth0TicketChange.mock.callCount()).toEqual(1);

      expect(
        mockAuth0UserGetByEmail.mock.calls.map((call) => call.arguments)
      ).toContainEqual([{ email: 'email123@email.com' }]);
      expect(mockSESSendEmail.mock.calls[0].arguments[0]).toEqual(
        expectedInvitationSentEmail(
          `${response.json.invitation.code}?signup_url=${encodeURIComponent(
            ticket
          )}`,
          'email123@email.com'
        )
      );
    });
  });
});

const invitationResponseExpectation = (invitation, overrides) => {
  return {
    ...omit(['_id'], invitation),
    id: invitation._id.toString(),
    inviteeProfile: omitOrgProfile(invitation.inviteeProfile),
    ...overrides,
  };
};

const omitOrgProfile = omit([
  'permittedVelocityServiceCategory',
  'adminGivenName',
  'adminFamilyName',
  'adminTitle',
  'adminEmail',
  'signatoryGivenName',
  'signatoryFamilyName',
  'signatoryTitle',
  'signatoryEmail',
]);
