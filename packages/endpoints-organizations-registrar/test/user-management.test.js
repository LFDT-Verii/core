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

const console = require('console');
const { pick, omit, omitBy, isNil } = require('lodash/fp');
const { initUserManagement, RoleNames } = require('../src/entities');

const mockAuth0UpdateUser = jest
  .fn()
  .mockImplementation(async ({ id }, obj) => {
    console.log(`update auth0 user ${id}`);
    return { data: { user_id: id, ...obj } };
  });
const mockAuth0GetUserRoles = jest.fn().mockResolvedValue({ data: [] });

const mockAuth0GetUserByEmail = jest.fn().mockResolvedValue({ data: [] });

const auth0User = {
  user_id: 'auth0|1',
  given_name: 'Bob',
  family_name: 'foobar',
  phone: '+14323424324',
  app_metadata: { groupId: '456' },
  email: 'foo@example.com',
  logins_count: 1,
};
const mockAuth0GetUser = jest.fn().mockResolvedValue({ data: auth0User });
const testConfig = {
  auth0SuperuserRoleId: 'superuserRoleIdFoo',
  auth0ClientAdminRoleId: 'clientadminRoleIdFoo',
  auth0ClientFinanceAdminRoleId: 'clientfinanceadminFoo',
  auth0ClientSystemUserRoleId: 'clientsystemuserFoo',
};
jest.mock('auth0', () => ({
  ManagementClient: jest.fn().mockImplementation(() => ({
    users: {
      update: mockAuth0UpdateUser,
      get: mockAuth0GetUser,
      getRoles: mockAuth0GetUserRoles,
    },
    usersByEmail: {
      getByEmail: mockAuth0GetUserByEmail,
    },
  })),
}));

describe('user management test suite', () => {
  let userManagementClient;
  beforeAll(async () => {
    userManagementClient = initUserManagement(testConfig);
  });
  beforeEach(async () => {
    jest.clearAllMocks();
  });
  describe('user soft delete test suite', () => {
    it('soft delete user not permitted from wrong scope', async () => {
      const { softDeleteUser } = userManagementClient;
      const func = () =>
        softDeleteUser(
          { id: 'foo' },
          { scope: { userId: 'otherUser', groupId: 'otherGroup' } }
        );
      await expect(func()).resolves.toEqual(undefined);
      expect(mockAuth0UpdateUser).toHaveBeenCalledTimes(0);
    });
    it('soft delete user permitted for superuser', async () => {
      const { softDeleteUser } = userManagementClient;
      const func = () => softDeleteUser({ id: 'foo' }, {});
      await expect(func()).resolves.toEqual(undefined);
      expect(mockAuth0UpdateUser).toHaveBeenLastCalledWith(
        { id: 'foo' },
        { blocked: true }
      );
      expect(mockAuth0UpdateUser).toHaveBeenCalledTimes(1);
    });

    it('soft delete user permitted for group admin', async () => {
      const { softDeleteUser } = userManagementClient;
      const func = () =>
        softDeleteUser(
          { id: 'foo' },
          {
            scope: {
              userId: 'otherUser',
              groupId: auth0User.app_metadata.groupId,
            },
          }
        );
      await expect(func()).resolves.toEqual(undefined);
      expect(mockAuth0UpdateUser).toHaveBeenLastCalledWith(
        { id: 'foo' },
        { blocked: true }
      );
      expect(mockAuth0UpdateUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('user get test suite', () => {
    it('get user', async () => {
      mockAuth0GetUserRoles.mockResolvedValue([
        { id: testConfig.auth0ClientAdminRoleId },
        { id: testConfig.auth0ClientFinanceAdminRoleId },
      ]);
      const { getUser } = userManagementClient;
      const func = () => getUser({ id: 'foo' });
      await expect(func()).resolves.toEqual({
        id: auth0User.user_id,
        email: auth0User.email,
        givenName: auth0User.given_name,
        familyName: auth0User.family_name,
        isRegistered: true,
      });
      expect(mockAuth0GetUser).toHaveBeenLastCalledWith({ id: 'foo' });
      expect(mockAuth0GetUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('get user with roles test suite', () => {
    it('get user with roles', async () => {
      mockAuth0GetUserRoles.mockResolvedValue({
        data: [
          { id: testConfig.auth0ClientAdminRoleId },
          { id: testConfig.auth0ClientFinanceAdminRoleId },
        ],
      });
      const { getUserWithRoles } = userManagementClient;
      expect(await getUserWithRoles({ id: 'foo' }, {})).toEqual(
        expectedUser(auth0User, {
          registrarRole: RoleNames.RegistrarClientAdmin,
          tokenWalletRole: RoleNames.TokenWalletClientFinanceAdmin,
        })
      );
      expect(mockAuth0GetUser).toHaveBeenLastCalledWith({ id: 'foo' });
      expect(mockAuth0GetUser).toHaveBeenCalledTimes(1);
      expect(mockAuth0GetUserRoles).toHaveBeenLastCalledWith(
        {
          id: 'foo',
        },
        {
          page: 0,
          per_page: 10,
        }
      );
      expect(mockAuth0GetUserRoles).toHaveBeenCalledTimes(1);
    });
    it('get user with superuser role', async () => {
      mockAuth0GetUserRoles.mockResolvedValue({
        data: [{ id: testConfig.auth0SuperuserRoleId }],
      });
      const { getUserWithRoles } = userManagementClient;
      expect(await getUserWithRoles({ id: 'foo' }, {})).toEqual(
        expectedUser(auth0User, {
          registrarRole: RoleNames.Superuser,
        })
      );
    });
    it('get user with clientsystemuser role', async () => {
      mockAuth0GetUserRoles.mockResolvedValue({
        data: [{ id: testConfig.auth0ClientSystemUserRoleId }],
      });
      const { getUserWithRoles } = userManagementClient;
      expect(await getUserWithRoles({ id: 'foo' }, {})).toEqual(
        expectedUser(auth0User, {
          tokenWalletRole: RoleNames.TokenWalletClientSystemUser,
        })
      );
    });
  });

  describe('user get by email test suite', () => {
    let minimalAuth0User;
    beforeAll(() => {
      minimalAuth0User = omit(['given_name', 'logins_count'], auth0User);
      mockAuth0GetUserByEmail.mockResolvedValue({ data: [minimalAuth0User] });
    });
    it('get user by email for same user', async () => {
      const { getUserByEmail } = userManagementClient;
      expect(
        await getUserByEmail('test@email.com', {
          scope: { userId: auth0User.user_id },
        })
      ).toEqual([expectedUser(minimalAuth0User)]);
      expect(mockAuth0GetUserByEmail).toHaveBeenLastCalledWith({
        email: 'test@email.com',
      });
      expect(mockAuth0GetUserByEmail).toHaveBeenCalledTimes(1);
    });

    it('get user by email for same group', async () => {
      const { getUserByEmail } = userManagementClient;
      expect(
        await getUserByEmail('test@email.com', {
          scope: { groupId: auth0User.app_metadata.groupId },
        })
      ).toEqual([expectedUser(minimalAuth0User)]);
      expect(mockAuth0GetUserByEmail).toHaveBeenLastCalledWith({
        email: 'test@email.com',
      });
      expect(mockAuth0GetUserByEmail).toHaveBeenCalledTimes(1);
    });

    it('get user public information by email', async () => {
      const { getUserByEmail } = userManagementClient;
      expect(await getUserByEmail('test@email.com')).toEqual([
        expectedUser(
          pick(['user_id', 'family_name', 'email'], minimalAuth0User)
        ),
      ]);
      expect(mockAuth0GetUserByEmail).toHaveBeenLastCalledWith({
        email: 'test@email.com',
      });
      expect(mockAuth0GetUserByEmail).toHaveBeenCalledTimes(1);
    });
  });
});

const expectedUser = (user, otherProps) =>
  omitBy(isNil, {
    id: user.user_id,
    groupId: user?.app_metadata?.groupId,
    givenName: user.given_name ?? '',
    familyName: user.family_name ?? '',
    phone: user.phone,
    email: user.email,
    loginsCount: user.logins_count,
    isRegistered: user.logins_count > 0,
    ...otherProps,
  });
