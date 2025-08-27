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
const { before, beforeEach, describe, it, mock, after } = require('node:test');
const { expect } = require('expect');

const mockAuth0UpdateUser = mock.fn(({ id }, obj) =>
  Promise.resolve({ data: { user_id: id, ...obj } })
);
const mockAuth0GetUserRoles = mock.fn(() => Promise.resolve({ data: [] }));
const mockAuth0GetUserByEmail = mock.fn(() => Promise.resolve({ data: [] }));

const auth0User = {
  user_id: 'auth0|1',
  given_name: 'Bob',
  family_name: 'foobar',
  phone: '+14323424324',
  app_metadata: { groupId: '456' },
  email: 'foo@example.com',
  logins_count: 1,
};
const mockAuth0GetUser = mock.fn(() => Promise.resolve({ data: auth0User }));

class ManagementClient {
  constructor() {
    this.users = {
      update: mockAuth0UpdateUser,
      get: mockAuth0GetUser,
      getRoles: mockAuth0GetUserRoles,
    };
    this.usersByEmail = {
      getByEmail: mockAuth0GetUserByEmail,
    };
  }
}
mock.module('auth0', {
  namedExports: {
    ManagementClient,
  },
});

const { last, pick, omit, omitBy, isNil } = require('lodash/fp');
const { initUserManagement, RoleNames } = require('../src/entities');

const testConfig = {
  auth0SuperuserRoleId: 'superuserRoleIdFoo',
  auth0ClientAdminRoleId: 'clientadminRoleIdFoo',
  auth0ClientFinanceAdminRoleId: 'clientfinanceadminFoo',
  auth0ClientSystemUserRoleId: 'clientsystemuserFoo',
};

describe('user management test suite', () => {
  let userManagementClient;
  before(async () => {
    userManagementClient = await initUserManagement(testConfig);
  });
  beforeEach(async () => {
    mockAuth0UpdateUser.mock.resetCalls();
    mockAuth0GetUser.mock.resetCalls();
    mockAuth0GetUserRoles.mock.resetCalls();
    mockAuth0GetUserByEmail.mock.resetCalls();
  });
  after(() => {
    mock.reset();
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
      expect(mockAuth0UpdateUser.mock.callCount()).toEqual(0);
    });
    it('soft delete user permitted for superuser', async () => {
      const { softDeleteUser } = userManagementClient;
      const func = () => softDeleteUser({ id: 'foo' }, {});
      await expect(func()).resolves.toEqual(undefined);
      expect(last(mockAuth0UpdateUser.mock.calls).arguments).toEqual([
        { id: 'foo' },
        { blocked: true },
      ]);
      expect(mockAuth0UpdateUser.mock.callCount()).toEqual(1);
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
      expect(last(mockAuth0UpdateUser.mock.calls).arguments).toEqual([
        { id: 'foo' },
        { blocked: true },
      ]);
      expect(mockAuth0UpdateUser.mock.callCount()).toEqual(1);
    });
  });

  describe('user get test suite', () => {
    it('get user', async () => {
      mockAuth0GetUserRoles.mock.mockImplementation(() =>
        Promise.resolve([
          { id: testConfig.auth0ClientAdminRoleId },
          { id: testConfig.auth0ClientFinanceAdminRoleId },
        ])
      );
      const { getUser } = userManagementClient;
      const func = () => getUser({ id: 'foo' });
      await expect(func()).resolves.toEqual({
        id: auth0User.user_id,
        email: auth0User.email,
        givenName: auth0User.given_name,
        familyName: auth0User.family_name,
        isRegistered: true,
      });
      expect(last(mockAuth0GetUser.mock.calls).arguments).toEqual([
        {
          id: 'foo',
        },
      ]);
      expect(mockAuth0GetUser.mock.callCount()).toEqual(1);
    });
  });

  describe('get user with roles test suite', () => {
    it('get user with roles', async () => {
      mockAuth0GetUserRoles.mock.mockImplementation(() =>
        Promise.resolve({
          data: [
            { id: testConfig.auth0ClientAdminRoleId },
            { id: testConfig.auth0ClientFinanceAdminRoleId },
          ],
        })
      );
      const { getUserWithRoles } = userManagementClient;
      expect(await getUserWithRoles({ id: 'foo' }, {})).toEqual(
        expectedUser(auth0User, {
          registrarRole: RoleNames.RegistrarClientAdmin,
          tokenWalletRole: RoleNames.TokenWalletClientFinanceAdmin,
        })
      );
      expect(last(mockAuth0GetUser.mock.calls).arguments).toEqual([
        {
          id: 'foo',
        },
      ]);
      expect(mockAuth0GetUser.mock.callCount()).toEqual(1);
      expect(last(mockAuth0GetUserRoles.mock.calls).arguments).toEqual([
        {
          id: 'foo',
        },
        {
          page: 0,
          per_page: 10,
        },
      ]);
      expect(mockAuth0GetUserRoles.mock.callCount()).toEqual(1);
    });
    it('get user with superuser role', async () => {
      mockAuth0GetUserRoles.mock.mockImplementation(() =>
        Promise.resolve({ data: [{ id: testConfig.auth0SuperuserRoleId }] })
      );
      const { getUserWithRoles } = userManagementClient;
      expect(await getUserWithRoles({ id: 'foo' }, {})).toEqual(
        expectedUser(auth0User, {
          registrarRole: RoleNames.Superuser,
        })
      );
    });
    it('get user with clientsystemuser role', async () => {
      mockAuth0GetUserRoles.mock.mockImplementation(() =>
        Promise.resolve({
          data: [{ id: testConfig.auth0ClientSystemUserRoleId }],
        })
      );
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
    before(() => {
      minimalAuth0User = omit(['given_name', 'logins_count'], auth0User);
      mockAuth0GetUserByEmail.mock.mockImplementation(() =>
        Promise.resolve({ data: [minimalAuth0User] })
      );
    });
    it('get user by email for same user', async () => {
      const { getUserByEmail } = userManagementClient;
      expect(
        await getUserByEmail('test@email.com', {
          scope: { userId: auth0User.user_id },
        })
      ).toEqual([expectedUser(minimalAuth0User)]);
      expect(last(mockAuth0GetUserByEmail.mock.calls).arguments).toEqual([
        { email: 'test@email.com' },
      ]);
      expect(mockAuth0GetUserByEmail.mock.callCount()).toEqual(1);
    });

    it('get user by email for same group', async () => {
      const { getUserByEmail } = userManagementClient;
      expect(
        await getUserByEmail('test@email.com', {
          scope: { groupId: auth0User.app_metadata.groupId },
        })
      ).toEqual([expectedUser(minimalAuth0User)]);
      expect(last(mockAuth0GetUserByEmail.mock.calls).arguments).toEqual([
        { email: 'test@email.com' },
      ]);
      expect(mockAuth0GetUserByEmail.mock.callCount()).toEqual(1);
    });

    it('get user public information by email', async () => {
      const { getUserByEmail } = userManagementClient;
      expect(await getUserByEmail('test@email.com')).toEqual([
        expectedUser(
          pick(['user_id', 'family_name', 'email'], minimalAuth0User)
        ),
      ]);
      expect(last(mockAuth0GetUserByEmail.mock.calls).arguments).toEqual([
        { email: 'test@email.com' },
      ]);
      expect(mockAuth0GetUserByEmail.mock.callCount()).toEqual(1);
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
