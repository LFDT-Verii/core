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

const { testRegistrarUser } = require('@verii/tests-helpers');
const {
  VNF_GROUP_ID_CLAIM,
  // eslint-disable-next-line import/order
} = require('../src/entities/oauth/domain/constants');

const mockAuth0CreateUser = mock.fn(async () => {
  const id = nanoid();
  return { data: { user_id: id } };
});
const mockUser = {
  id: 'auth0|1',
  email: 'foo@foo.test',
  givenName: 'foo',
  familyName: 'bar',
  app_metadata: { groupId: testRegistrarUser[VNF_GROUP_ID_CLAIM] },
};

const mockAuth0AddRoleToUser = mock.fn(() =>
  Promise.resolve({ data: { undefined } })
);
const mockAuth0GetUser = mock.fn(() => Promise.resolve({ data: mockUser }));
const mockAuth0UpdateUser = mock.fn(async ({ id }, obj) => ({
  data: {
    user_id: id,
    ...obj,
  },
}));

const mockAuth0GetUserRoles = mock.fn(() =>
  Promise.resolve({ data: [{ id: 'rol_sQZLrbwBEblVBNDj' }] })
);

const mockAuth0CreatePasswordChangeTicket = mock.fn(() =>
  Promise.resolve({
    data: {
      ticket: 'http://localhost/ticket',
    },
  })
);

class ManagementClient {
  constructor() {
    this.users = {
      create: mockAuth0CreateUser,
      assignRoles: mockAuth0AddRoleToUser,
      update: mockAuth0UpdateUser,
      get: mockAuth0GetUser,
      getRoles: mockAuth0GetUserRoles,
    };
    this.tickets = {
      changePassword: mockAuth0CreatePasswordChangeTicket,
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

const { nanoid } = require('nanoid');
const { last, omit } = require('lodash/fp');
const newError = require('http-errors');

const {
  testIAMSuperUser,
  testWriteIAMUser,
  testRegistrarSuperUser,
  mongoify,
  errorResponseMatcher,
} = require('@verii/tests-helpers');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const initGroupsFactory = require('../src/entities/groups/factories/groups-factory');
const buildFastify = require('./helpers/build-fastify');

const groupsRepoPlugin = require('../src/entities/groups/repo');
const { RoleNames, initUserRegistrarEmails } = require('../src/entities');
const { UserErrorMessages } = require('../src');

const baseUrl = '/api/v0.6/users';
const idUrl = ({ id }) => `/api/v0.6/users/${id}`;

const baseCreateUserPayload = {
  email: 'user@localhost.com',
  givenName: 'john',
  familyName: 'smith',
  groupId: 'some-group-id',
};
describe('Users Registrar Test Suite', () => {
  let fastify;
  let persistGroup;
  let groupsRepo;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();

    ({ persistGroup } = initGroupsFactory(fastify));

    groupsRepo = groupsRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });
  });

  beforeEach(async () => {
    mockSESSendEmail.mock.resetCalls();
    mockAuth0GetUser.mock.resetCalls();
    mockAuth0CreateUser.mock.resetCalls();
    mockAuth0AddRoleToUser.mock.resetCalls();
    mockAuth0CreatePasswordChangeTicket.mock.resetCalls();

    await mongoDb().collection('groups').deleteMany({});
  });

  after(async () => {
    await fastify.close();
    mock.reset();
  });

  describe('User CRUD', () => {
    const userId = 'foo';
    let authUserGroup;
    beforeEach(async () => {
      authUserGroup = await persistGroup({
        groupId: testWriteIAMUser[VNF_GROUP_ID_CLAIM],
        clientAdminIds: [testWriteIAMUser.sub],
      });
    });
    describe('User Creation', () => {
      it('Should 400 with invalid email', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload: {
            ...baseCreateUserPayload,
            email: 'invalid email',
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: expect.stringContaining('body/email must match pattern'),
          })
        );
      });

      it('Should 400 with invalid registrarRole', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload: {
            ...baseCreateUserPayload,
            registrarRole: 'invalid',
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message:
              'body/registrarRole must be equal to one of the allowed values',
          })
        );
      });

      it('Should 403 with invalid tokenWalletRole', async () => {
        const payload = {
          ...baseCreateUserPayload,
          tokenWalletRole: 'incorrect-role',
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message:
              'body/tokenWalletRole must be equal to one of the allowed values',
          })
        );
      });

      it('Should 400 when trying to create a superuser', async () => {
        const payload = {
          ...baseCreateUserPayload,
          registrarRole: RoleNames.Superuser,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteIAMUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message:
              'body/registrarRole must be equal to one of the allowed values',
          })
        );
      });

      it('Should 403 unprivileged user creating superuser', async () => {
        const payload = { ...baseCreateUserPayload, groupId: 'new' };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('Should 404 superuser creating clientadmin with non-existant "groupId" provided', async () => {
        const payload = {
          ...baseCreateUserPayload,
          registrarRole: RoleNames.RegistrarClientAdmin,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
          },
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'missing_error_code',
            error: 'Not Found',
            message: 'Group some-group-id not found',
            statusCode: 404,
          })
        );

        expect(mockAuth0CreateUser.mock.callCount()).toEqual(0);
        expect(mockAuth0AddRoleToUser.mock.callCount()).toEqual(0);
        expect(mockAuth0CreatePasswordChangeTicket.mock.callCount()).toEqual(0);
        expect(mockSESSendEmail.mock.callCount()).toEqual(0);
      });

      it('Should 403 clientadmin creating clientadmin in different group', async () => {
        const payload = {
          ...baseCreateUserPayload,
          registrarRole: RoleNames.RegistrarClientAdmin,
          groupId: 'did:test:12345',
        };
        await persistGroup({ groupId: payload.groupId });

        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteIAMUser),
          },
        });
        expect(response.statusCode).toEqual(403);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'missing_error_code',
            statusCode: 403,
            error: 'Forbidden',
            message: UserErrorMessages.USER_CANNOT_SPECIFY_GROUP_ID,
          })
        );
      });

      it('Should 403 clientadmin creating clientadmin and "new" groupId', async () => {
        const payload = {
          ...baseCreateUserPayload,
          registrarRole: RoleNames.RegistrarClientAdmin,
          groupId: 'new',
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteIAMUser),
          },
        });
        expect(response.statusCode).toEqual(403);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'missing_error_code',
            statusCode: 403,
            error: 'Forbidden',
            message: UserErrorMessages.USER_MUST_SPECIFY_GROUP_ID,
          })
        );
      });

      it('Should 403 when creating superuser', async () => {
        const payload = {
          ...baseCreateUserPayload,
          registrarRole: RoleNames.Superuser,
          groupId: 'new',
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteIAMUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message:
              'body/registrarRole must be equal to one of the allowed values',
          })
        );
      });

      it('Should 400 when add user without groupId', async () => {
        const payload = {
          ...omit(['groupId'], baseCreateUserPayload),
          registrarRole: RoleNames.RegistrarClientAdmin,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: "body must have required property 'groupId'",
          })
        );
      });

      it('Should 201 superuser creating clientadmin with groupId="new" provided', async () => {
        const payload = {
          ...baseCreateUserPayload,
          groupId: 'new',
          registrarRole: RoleNames.RegistrarClientAdmin,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
          },
        });
        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...omit(['groupId'], payload),
          id: expect.any(String),
        });
      });

      it('Should 201 superuser creating clientadmin with existing "groupId" provided', async () => {
        await persistGroup({
          groupId: baseCreateUserPayload.groupId,
          dids: [],
          clientAdminIds: [],
        });
        const payload = {
          ...baseCreateUserPayload,
          registrarRole: RoleNames.RegistrarClientAdmin,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          id: expect.any(String),
        });

        const group = await groupsRepo.findOne();
        expect(group).toMatchObject({
          groupId: baseCreateUserPayload.groupId,
          dids: [],
          clientAdminIds: [response.json.id],
        });
        expect(mockAuth0CreateUser.mock.callCount()).toEqual(1);
        expect(mockAuth0AddRoleToUser.mock.callCount()).toEqual(1);
        expect(mockAuth0CreatePasswordChangeTicket.mock.callCount()).toEqual(1);
        expect(
          last(mockAuth0CreatePasswordChangeTicket.mock.calls).arguments
        ).toEqual([
          {
            user_id: response.json.id,
            result_url: 'https://ui.example.com',
            mark_email_as_verified: true,
            ttl_sec: 604800,
          },
        ]);
        expect(mockSESSendEmail.mock.callCount()).toEqual(1);
      });

      it('createdAt of group should be updated', async () => {
        const { updatedAt: updatedAtInitial } = await persistGroup({
          groupId: baseCreateUserPayload.groupId,
          dids: [],
          clientAdminIds: [],
        });

        const payload = {
          ...baseCreateUserPayload,
          registrarRole: RoleNames.RegistrarClientAdmin,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
          },
        });

        expect(response.statusCode).toEqual(201);

        const group = await groupsRepo.findOne();

        expect(new Date(group.updatedAt).getTime()).toBeGreaterThan(
          new Date(updatedAtInitial).getTime()
        );
      });

      it('Should 201 superuser creating clientfinanceadmin with "groupId" provided', async () => {
        const group = await persistGroup({
          groupId: baseCreateUserPayload.groupId,
          dids: [],
          clientAdminIds: [],
        });

        const payload = {
          ...baseCreateUserPayload,
          tokenWalletRole: RoleNames.TokenWalletClientFinanceAdmin,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          id: expect.any(String),
        });
        const dbGroup = await groupsRepo.findOne();
        expect(dbGroup).toEqual(mongoify(group));
        expect(mockAuth0CreateUser.mock.callCount()).toEqual(1);
        expect(mockAuth0AddRoleToUser.mock.callCount()).toEqual(1);
        expect(mockAuth0CreatePasswordChangeTicket.mock.callCount()).toEqual(1);
        expect(
          last(mockAuth0CreatePasswordChangeTicket.mock.calls).arguments
        ).toEqual([
          {
            user_id: response.json.id,
            result_url: 'https://tokenwallet.example.com',
            mark_email_as_verified: true,
            ttl_sec: 604800,
          },
        ]);
        expect(mockSESSendEmail.mock.callCount()).toEqual(1);
      });

      it('Should 201 clientadmin creating clientfinanceadmin with the same group', async () => {
        const payload = {
          ...baseCreateUserPayload,
          groupId: testWriteIAMUser[VNF_GROUP_ID_CLAIM],
          tokenWalletRole: RoleNames.TokenWalletClientFinanceAdmin,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteIAMUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          groupId: testWriteIAMUser[VNF_GROUP_ID_CLAIM],
          id: expect.any(String),
        });
        const group = await groupsRepo.findOne();
        expect(group).toEqual(mongoify(authUserGroup));
        expect(mockAuth0CreateUser.mock.callCount()).toEqual(1);
        expect(mockAuth0AddRoleToUser.mock.callCount()).toEqual(1);
        expect(mockAuth0CreatePasswordChangeTicket.mock.callCount()).toEqual(1);
        expect(
          last(mockAuth0CreatePasswordChangeTicket.mock.calls).arguments
        ).toEqual([
          {
            user_id: response.json.id,
            result_url: 'https://tokenwallet.example.com',
            mark_email_as_verified: true,
            ttl_sec: 604800,
          },
        ]);
        expect(mockSESSendEmail.mock.callCount()).toEqual(1);
      });

      it('Should 201 clientadmin creating clientsystemuser with the same group', async () => {
        const payload = {
          ...baseCreateUserPayload,
          groupId: testWriteIAMUser[VNF_GROUP_ID_CLAIM],
          tokenWalletRole: RoleNames.TokenWalletClientSystemUser,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteIAMUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          groupId: testWriteIAMUser[VNF_GROUP_ID_CLAIM],
          id: expect.any(String),
        });
        const group = await groupsRepo.findOne();
        expect(group).toEqual(mongoify(authUserGroup));
        expect(mockAuth0CreateUser.mock.callCount()).toEqual(1);
        expect(mockAuth0AddRoleToUser.mock.callCount()).toEqual(1);
        expect(mockAuth0CreatePasswordChangeTicket.mock.callCount()).toEqual(1);
        expect(
          last(mockAuth0CreatePasswordChangeTicket.mock.calls).arguments
        ).toEqual([
          {
            user_id: response.json.id,
            result_url: 'https://tokenwallet.example.com',
            mark_email_as_verified: true,
            ttl_sec: 604800,
          },
        ]);
        expect(mockSESSendEmail.mock.callCount()).toEqual(1);
      });

      it('Should 201 and sanitize body when extra property is in payload', async () => {
        await persistGroup({
          groupId: baseCreateUserPayload.groupId,
          dids: [],
          clientAdminIds: [testIAMSuperUser.sub],
        });
        const payload = {
          ...baseCreateUserPayload,
          foo: 'bar',
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
          },
        });
        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...omit(['foo'], payload),
          id: expect.any(String),
        });
      });

      it('Should 201 even when email notification to user fails', async () => {
        mockSESSendEmail.mock.mockImplementationOnce(() =>
          Promise.reject(new Error('mock error'))
        );
        const payload = {
          ...baseCreateUserPayload,
          groupId: 'new',
          registrarRole: RoleNames.RegistrarClientAdmin,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
          },
        });
        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...omit(['groupId'], payload),
          id: expect.any(String),
        });
        expect(mockAuth0CreateUser.mock.callCount()).toEqual(1);
        expect(mockAuth0AddRoleToUser.mock.callCount()).toEqual(1);
        expect(mockAuth0CreatePasswordChangeTicket.mock.callCount()).toEqual(1);
        expect(
          last(mockAuth0CreatePasswordChangeTicket.mock.calls).arguments
        ).toEqual([
          {
            user_id: response.json.id,
            result_url: 'https://ui.example.com',
            mark_email_as_verified: true,
            ttl_sec: 604800,
          },
        ]);
        expect(mockSESSendEmail.mock.callCount()).toEqual(1);
      });

      it('Should 201 superuser creating clientfinanceadmin with "new" groupId provided', async () => {
        const payload = {
          ...baseCreateUserPayload,
          groupId: 'new',
          registrarRole: RoleNames.RegistrarClientAdmin,
          tokenWalletRole: RoleNames.TokenWalletClientFinanceAdmin,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: baseUrl,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...omit(['groupId'], payload),
          id: expect.any(String),
        });
        const groups = await groupsRepo.find();
        expect(groups).toEqual([mongoify(authUserGroup)]);
        expect(mockAuth0CreateUser.mock.callCount()).toEqual(1);
        expect(mockAuth0AddRoleToUser.mock.callCount()).toEqual(2);
        expect(mockAuth0CreatePasswordChangeTicket.mock.callCount()).toEqual(1);
        expect(
          last(mockAuth0CreatePasswordChangeTicket.mock.calls).arguments
        ).toEqual([
          {
            user_id: response.json.id,
            result_url: 'https://ui.example.com',
            mark_email_as_verified: true,
            ttl_sec: 604800,
          },
        ]);
        expect(mockSESSendEmail.mock.callCount()).toEqual(1);
      });
    });

    describe('User Delete', () => {
      it('Should 404 if user does not exist', async () => {
        mockAuth0GetUser.mock.mockImplementationOnce(() => {
          throw new newError.NotFound('User not found');
        });

        const response = await fastify.injectJson({
          method: 'DELETE',
          url: idUrl({ id: userId }),
          headers: {
            'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
          },
        });
        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'missing_error_code',
            message: 'User not found',
            error: 'Not Found',
            statusCode: 404,
          })
        );
        expect(mockAuth0GetUser.mock.callCount()).toEqual(1);
        expect(last(mockAuth0GetUser.mock.calls).arguments).toEqual([
          {
            id: userId,
          },
        ]);
      });
      it('Should 204 upon successful soft deletion', async () => {
        const response = await fastify.injectJson({
          method: 'DELETE',
          url: idUrl({ id: userId }),
          headers: {
            'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
          },
        });
        expect(response.statusCode).toEqual(204);
        expect(mockAuth0GetUser.mock.callCount()).toEqual(1);
        expect(last(mockAuth0GetUser.mock.calls).arguments).toEqual([
          {
            id: userId,
          },
        ]);
      });
    });

    describe('Get Single User', () => {
      it('Should 404 if user does not exist', async () => {
        mockAuth0GetUser.mock.mockImplementationOnce(async () => {
          throw new newError.NotFound('User not found');
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: idUrl({ id: userId }),
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarUser),
          },
        });
        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'missing_error_code',
            message: 'User not found',
            error: 'Not Found',
            statusCode: 404,
          })
        );
        expect(mockAuth0GetUser.mock.callCount()).toEqual(1);
        expect(last(mockAuth0GetUser.mock.calls).arguments).toEqual([
          {
            id: userId,
          },
        ]);
      });

      it("Should 404 if user does not exist in user's group", async () => {
        mockAuth0GetUser.mock.mockImplementationOnce(async () => ({
          data: {
            ...mockUser,
            groupId: 'otherGroup',
          },
        }));
        const response = await fastify.injectJson({
          method: 'GET',
          url: idUrl({ id: userId }),
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarUser),
          },
        });
        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'missing_error_code',
            message: 'User Not Found',
            error: 'Not Found',
            statusCode: 404,
          })
        );
        expect(mockAuth0GetUser.mock.callCount()).toEqual(1);
        expect(last(mockAuth0GetUser.mock.calls).arguments).toEqual([
          {
            id: userId,
          },
        ]);
      });
      it("Should 200 and return user that isn't associated with a group", async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: idUrl({ id: userId }),
          headers: {
            'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(userJsonResponse(mockUser));
        expect(mockAuth0GetUser.mock.callCount()).toEqual(1);
        expect(last(mockAuth0GetUser.mock.calls).arguments).toEqual([
          {
            id: userId,
          },
        ]);
      });
      it('Should 200 and return user that is associated with a group', async () => {
        await persistGroup({
          groupId: 'fake',
          clientAdminIds: [userId],
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: idUrl({ id: userId }),
          headers: {
            'x-override-oauth-user': JSON.stringify(testIAMSuperUser),
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(userJsonResponse(mockUser));
        expect(mockAuth0GetUser.mock.callCount()).toEqual(1);
        expect(last(mockAuth0GetUser.mock.calls).arguments).toEqual([
          {
            id: userId,
          },
        ]);
      });
    });

    describe('User email test', () => {
      it('should generate emailToUserForUserInvite', async () => {
        const { emailToUserForUserInvite } = initUserRegistrarEmails(
          fastify.config
        );
        const user = {
          givenName: 'givenName',
          familyName: 'familyName',
          email: 'email',
        };
        const ticket = 'mockTicket';
        const organizations = [
          {
            profile: { name: 'org1' },
            didDoc: { id: 'didDodId1' },
          },
          {
            profile: { name: 'org1' },
            didDoc: { id: 'didDodId2' },
          },
        ];

        const expected = emailToUserForUserInvite({
          user,
          ticket,
          organizations,
          tokenWalletRole: [RoleNames.TokenWalletClientSystemUser],
        });

        expect(expected).toStrictEqual({
          subject: 'Velocity Network Registrar Invitation',
          message:
            // eslint-disable-next-line max-len
            "givenName familyName,\nWelcome to the Velocity Network Registrar.<br><br>\nPlease accept your invite and set your password at <a href='mockTicket'>mockTicket</a>\n<br>\n<br>\nTo access the Payment and Rewards Hub, please follow the link(s) below and use the credentials you just created to login.<br>\nPLEASE NOTE - Access to the Payment and Rewards Hub will only be possible once your services are activated.<br>\n<a href='https://tokenwallet.example.com/o/didDodId1'>org1</a> <br><a href='https://tokenwallet.example.com/o/didDodId2'>org1</a> <br>\n<br>\nRegards,\n<br>\n<br>\nThe Velocity Network Registrar\n",
          recipients: ['email'],
          sender: 'testvnfregistrar@gmail.com',
          replyTo: 'no-reply@velocitynetwork.foundation',
          html: true,
        });
      });

      it('should generate emailToUserForUserInvite without token wallet role', async () => {
        const { emailToUserForUserInvite } = initUserRegistrarEmails(
          fastify.config
        );
        const user = {
          givenName: 'givenName',
          familyName: 'familyName',
          email: 'email',
        };
        const ticket = 'mockTicket';
        const organizations = [];

        const expected = emailToUserForUserInvite({
          user,
          ticket,
          organizations,
        });

        expect(expected).toStrictEqual({
          subject: 'Velocity Network Registrar Invitation',
          message:
            // eslint-disable-next-line max-len
            "givenName familyName,\nWelcome to the Velocity Network Registrar.<br><br>\nPlease accept your invite and set your password at <a href='mockTicket'>mockTicket</a>\n<br>\n<br>\n\n<br>\nRegards,\n<br>\n<br>\nThe Velocity Network Registrar\n",
          recipients: ['email'],
          sender: 'testvnfregistrar@gmail.com',
          replyTo: 'no-reply@velocitynetwork.foundation',
          html: true,
        });
      });

      it('should generate emailToUserForUserInvite with token wallet role', async () => {
        const { emailToUserForUserInvite } = initUserRegistrarEmails(
          fastify.config
        );
        const user = {
          givenName: 'givenName',
          familyName: 'familyName',
          email: 'email',
        };
        const ticket = 'mockTicket';
        const organizations = [
          {
            profile: { name: 'org1' },
            didDoc: { id: 'didDodId1' },
          },
          {
            profile: { name: 'org1' },
            didDoc: { id: 'didDodId2' },
          },
        ];

        const expected = emailToUserForUserInvite({
          user,
          ticket,
          organizations,
          tokenWalletRole: [RoleNames.TokenWalletClientSystemUser],
        });

        expect(expected).toStrictEqual({
          subject: 'Velocity Network Registrar Invitation',
          message:
            // eslint-disable-next-line max-len
            "givenName familyName,\nWelcome to the Velocity Network Registrar.<br><br>\nPlease accept your invite and set your password at <a href='mockTicket'>mockTicket</a>\n<br>\n<br>\nTo access the Payment and Rewards Hub, please follow the link(s) below and use the credentials you just created to login.<br>\nPLEASE NOTE - Access to the Payment and Rewards Hub will only be possible once your services are activated.<br>\n<a href='https://tokenwallet.example.com/o/didDodId1'>org1</a> <br><a href='https://tokenwallet.example.com/o/didDodId2'>org1</a> <br>\n<br>\nRegards,\n<br>\n<br>\nThe Velocity Network Registrar\n",
          recipients: ['email'],
          sender: 'testvnfregistrar@gmail.com',
          replyTo: 'no-reply@velocitynetwork.foundation',
          html: true,
        });
      });
    });
  });
});

const userJsonResponse = (user) => ({
  ...omit('app_metadata', user),
  groupId: user.app_metadata.groupId,
  registrarRole: 'clientadmin',
});
