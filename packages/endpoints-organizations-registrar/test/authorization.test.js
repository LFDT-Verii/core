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

const mockInitSendError = mock.fn(() => ({
  sendError: (err) => {
    console.log(`fake capturing exception: ${err.message}`);
  },
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

const { omit } = require('lodash/fp');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const {
  testIAMSuperUser,
  testWriteIAMUser,
  testReadIAMUser,
  testReadOrganizationsUser,
  testRegistrarSuperUser,
  testWriteOrganizationsUser,
  mongoify,
} = require('@verii/tests-helpers');

const console = require('console');
const { nanoid } = require('nanoid');
const initGroupsFactory = require('../src/entities/groups/factories/groups-factory');
const buildFastify = require('./helpers/build-fastify');
const groupsRepoPlugin = require('../src/entities/groups/repo');
const {
  RegistrarScopes,
  GroupErrorMessages,
  UserErrorMessages,
  RoleNames,
  VNF_GROUP_ID_CLAIM,
} = require('../src/entities');

const {
  verifyUserOrganizationWriteAuthorized,
  verifyUserOrganizationReadAuthorized,
  verifyAuthorizedWriteUsers,
  verifyAuthorizedReadUsers,
} = require('../src/plugins/authorization');

describe('Authorization Test suite', () => {
  let fastify;
  let persistGroup;
  let groupsRepo;
  let contextWithRepos;
  const testNoScopeUser = {
    sub: `auth0|${nanoid()}`,
    scope: '',
  };

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();

    ({ persistGroup } = initGroupsFactory(fastify));

    groupsRepo = groupsRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });
    contextWithRepos = {
      config: fastify.config,
      log: fastify.log,
      sendError: fastify.sendError,
      repos: {
        groups: groupsRepo,
      },
    };
  });

  beforeEach(async () => {
    await mongoDb().collection('groups').deleteMany({});
  });

  after(async () => {
    await fastify.close();
    mock.reset();
  });

  describe('verifyUserOrganizationWriteAuthorized test suite', () => {
    it('should return true when user has admin organization scope', async () => {
      const ctx = {
        params: {
          did: 'some-did',
        },
        user: testRegistrarSuperUser,
      };

      const result = await verifyUserOrganizationWriteAuthorized(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toBeUndefined();
    });

    it('should return true when there is no "params.did" and method is POST', async () => {
      const did = testWriteOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        params: {},
        method: 'POST',
        user: testWriteOrganizationsUser,
      };

      await persistGroup({
        groupId: did,
        clientAdminIds: [testWriteOrganizationsUser.sub],
      });

      const result = await verifyUserOrganizationWriteAuthorized(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: ['new'],
        groupId: did,
      });
    });

    it('should return true when there is no "params.did" and method is not POST', async () => {
      const did = testWriteOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        params: {},
        user: testWriteOrganizationsUser,
      };

      const group = await persistGroup({
        groupId: did,
        clientAdminIds: [testWriteOrganizationsUser.sub],
      });

      const result = await verifyUserOrganizationWriteAuthorized(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({ dids: group.dids, groupId: did });
    });

    it('should return true when user has the group claim of the leader organization', async () => {
      const did = testWriteOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        params: {
          did,
        },
        user: testWriteOrganizationsUser,
      };

      const group = await persistGroup({
        groupId: did,
        clientAdminIds: [
          `auth0|${nanoid()}`,
          testWriteOrganizationsUser.sub,
          `auth0|${nanoid()}`,
        ],
      });
      const result = await verifyUserOrganizationWriteAuthorized(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: [group.groupId],
        groupId: group.groupId,
      });
    });

    it('should return true when user has the group claim of a member organization', async () => {
      const leaderDid = testWriteOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const memberDid = `did:test:${nanoid()}`;
      const ctx = {
        ...contextWithRepos,
        params: {
          did: memberDid,
        },
        user: testWriteOrganizationsUser,
      };

      const group = await persistGroup({
        groupId: leaderDid,
        dids: [memberDid],
        clientAdminIds: [
          `auth0|${nanoid()}`,
          testWriteOrganizationsUser.sub,
          `auth0|${nanoid()}`,
        ],
      });
      const result = await verifyUserOrganizationWriteAuthorized(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: [memberDid],
        groupId: group.groupId,
      });
    });

    it('should automatically sync group clientAdminIds if user is missing if params.did exists', async () => {
      const did = testWriteOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        params: {
          did,
        },
        user: testWriteOrganizationsUser,
      };

      const group = await persistGroup({
        groupId: did,
        clientAdminIds: [`auth0|${nanoid()}`, `auth0|${nanoid()}`],
      });
      const result = await verifyUserOrganizationWriteAuthorized(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: [did],
        groupId: group.groupId,
      });
      expect(await groupsRepo.findGroupByGroupId(did)).toEqual(
        mongoify({
          ...group,
          clientAdminIds: expect.arrayContaining(
            group.clientAdminIds.concat([testWriteOrganizationsUser.sub])
          ),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should automatically sync group clientAdminIds if user is missing if params.did does not exist', async () => {
      const did = testWriteOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        user: testWriteOrganizationsUser,
      };

      const group = await persistGroup({
        groupId: did,
        clientAdminIds: [],
      });
      const result = await verifyUserOrganizationWriteAuthorized(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: group.dids,
        groupId: group.groupId,
      });
      expect(await groupsRepo.findGroupByGroupId(did)).toEqual(
        mongoify({
          ...group,
          clientAdminIds: [testWriteOrganizationsUser.sub],
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should throw when there is a "params.did" but no org group', async () => {
      const did = testWriteOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        params: {
          did,
        },
        user: testWriteOrganizationsUser,
      };

      await expect(() =>
        verifyUserOrganizationWriteAuthorized(ctx)
      ).rejects.toThrow(
        GroupErrorMessages.ORGANIZATION_GROUP_NOT_FOUND({ did })
      );
    });

    it('should throw when there is no "params.did" and user group claim doesnt exist', async () => {
      const ctx = {
        ...contextWithRepos,
        params: {},
        user: testWriteOrganizationsUser,
      };

      await expect(() =>
        verifyUserOrganizationWriteAuthorized(ctx)
      ).rejects.toThrow(
        UserErrorMessages.USER_INVALID_GROUP_CLAIM({
          user: testWriteOrganizationsUser,
        })
      );
    });

    it('should throw when user does not have any group claim', async () => {
      const didOfGroupUserBelongsTo =
        testReadOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const userWithNoGroupClaim = {
        sub: `auth0|${nanoid()}`,
        scope: RegistrarScopes.WriteOrganizations,
      };
      const ctx = {
        ...contextWithRepos,
        params: {
          did: didOfGroupUserBelongsTo,
        },
        user: userWithNoGroupClaim,
      };
      await persistGroup({
        groupId: didOfGroupUserBelongsTo,
        clientAdminIds: [testReadOrganizationsUser.sub],
      });

      await expect(() =>
        verifyUserOrganizationWriteAuthorized(ctx)
      ).rejects.toThrow(
        UserErrorMessages.USER_MUST_HAVE_GROUP_CLAIM({
          user: userWithNoGroupClaim,
        })
      );
    });

    it('should throw when user does not have the group claim of the leader org', async () => {
      const didOfGroupUserBelongsTo =
        testWriteOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const otherDid = 'did:other';
      const ctx = {
        ...contextWithRepos,
        params: {
          did: otherDid,
        },
        user: testWriteOrganizationsUser,
      };
      await persistGroup({
        groupId: didOfGroupUserBelongsTo,
        clientAdminIds: [testWriteOrganizationsUser.sub],
      });
      const orgGroup = await persistGroup({
        groupId: otherDid,
        clientAdminIds: [],
      });

      const func = async () => verifyUserOrganizationWriteAuthorized(ctx);
      await expect(func).rejects.toThrow(
        UserErrorMessages.USER_CANNOT_ACCESS_ORGANIZATION_GROUP({
          user: testWriteOrganizationsUser,
          group: orgGroup,
          did: otherDid,
        })
      );
    });

    it('should throw when user does not have the group claim of the member org', async () => {
      const didOfGroupUserBelongsTo =
        testWriteOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const otherDid = 'did:other';
      const ctx = {
        ...contextWithRepos,
        params: {
          did: otherDid,
        },
        user: testWriteOrganizationsUser,
      };

      await persistGroup({
        groupId: didOfGroupUserBelongsTo,
        clientAdminIds: [testWriteOrganizationsUser.sub],
      });
      const orgGroup = await persistGroup({
        groupId: `did:test:${nanoid()}`,
        dids: [otherDid],
        clientAdminIds: [],
      });

      const func = async () => verifyUserOrganizationWriteAuthorized(ctx);
      await expect(func).rejects.toThrow(
        UserErrorMessages.USER_CANNOT_ACCESS_ORGANIZATION_GROUP({
          user: testWriteOrganizationsUser,
          group: orgGroup,
          did: otherDid,
        })
      );
    });

    it('should throw when user does not have write or admin organization scope', async () => {
      const ctx = {
        params: {
          did: 'some-did',
        },
        user: testNoScopeUser,
      };
      const func = async () => verifyUserOrganizationWriteAuthorized(ctx);
      await expect(func).rejects.toThrow(
        UserErrorMessages.MISSING_REQUIRED_SCOPES_TEMPLATE({
          requiredScopes: [
            RegistrarScopes.WriteOrganizations,
            RegistrarScopes.AdminOrganizations,
          ],
        })
      );
    });
  });
  describe('verifyUserOrganizationReadAuthorized test suite', () => {
    it('should return true when user has admin organization scope', async () => {
      const ctx = {
        params: {
          did: 'some-did',
        },
        user: testRegistrarSuperUser,
      };

      const result = await verifyUserOrganizationReadAuthorized(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual(undefined);
    });

    it('should return true when there is no "params.did" on the context', async () => {
      const did = testReadOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        params: {},
        user: testReadOrganizationsUser,
      };

      const group = await persistGroup({
        groupId: did,
        did: [`did:test:${nanoid()}`],
        clientAdminIds: [testReadOrganizationsUser.sub],
      });
      const result = await verifyUserOrganizationReadAuthorized(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: group.dids,
        groupId: group.groupId,
      });
    });

    it('should return true when there are params.did and user has matching group claim', async () => {
      const did = testReadOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        params: {
          did,
        },
        user: testReadOrganizationsUser,
      };

      const group = await persistGroup({
        groupId: did,
        clientAdminIds: [testReadOrganizationsUser.sub],
      });
      const result = await verifyUserOrganizationReadAuthorized(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: [did],
        groupId: group.groupId,
      });
    });

    it('should automatically sync group clientAdminIds if user is missing if params.did exists', async () => {
      const did = testReadOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        params: {
          did,
        },
        user: testReadOrganizationsUser,
      };

      const group = await persistGroup({
        groupId: did,
        clientAdminIds: [`auth0|${nanoid()}`, `auth0|${nanoid()}`],
      });
      const result = await verifyUserOrganizationReadAuthorized(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: [did],
        groupId: group.groupId,
      });
      expect(await groupsRepo.findGroupByGroupId(did)).toEqual(
        mongoify({
          ...group,
          clientAdminIds: expect.arrayContaining(
            group.clientAdminIds.concat([testReadOrganizationsUser.sub])
          ),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should automatically sync group clientAdminIds if user is missing if params.did does not exist', async () => {
      const did = testReadOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        user: testReadOrganizationsUser,
      };

      const group = await persistGroup({
        groupId: did,
        clientAdminIds: [],
      });
      const result = await verifyUserOrganizationReadAuthorized(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: group.dids,
        groupId: group.groupId,
      });
      expect(await groupsRepo.findGroupByGroupId(did)).toEqual(
        mongoify({
          ...group,
          clientAdminIds: [testReadOrganizationsUser.sub],
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should throw when there is a "params.did" but no org group', async () => {
      const did = testReadOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        params: {
          did,
        },
        user: testReadOrganizationsUser,
      };

      await expect(() =>
        verifyUserOrganizationReadAuthorized(ctx)
      ).rejects.toThrow(
        GroupErrorMessages.ORGANIZATION_GROUP_NOT_FOUND({ did })
      );
    });

    it('should throw when there is no "params.did" and user group claim doesnt exist', async () => {
      const ctx = {
        ...contextWithRepos,
        params: {},
        user: testReadOrganizationsUser,
      };

      await expect(() =>
        verifyUserOrganizationReadAuthorized(ctx)
      ).rejects.toThrow(
        UserErrorMessages.USER_INVALID_GROUP_CLAIM({
          user: testReadOrganizationsUser,
        })
      );
    });

    it('should throw when user does not have any group claim when params.did set', async () => {
      const didOfGroupUserBelongsTo =
        testReadOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const userWithNoGroupClaim = {
        sub: `auth0|${nanoid()}`,
        scope: RegistrarScopes.ReadOrganizations,
      };
      const ctx = {
        ...contextWithRepos,
        params: {
          did: didOfGroupUserBelongsTo,
        },
        user: userWithNoGroupClaim,
      };
      await persistGroup({
        groupId: didOfGroupUserBelongsTo,
        clientAdminIds: [testReadOrganizationsUser.sub],
      });

      await expect(() =>
        verifyUserOrganizationReadAuthorized(ctx)
      ).rejects.toThrow(
        UserErrorMessages.USER_MUST_HAVE_GROUP_CLAIM({
          user: userWithNoGroupClaim,
        })
      );
    });

    it('should throw when user does not have any group claim when params.did is NOT set', async () => {
      const didOfGroupUserBelongsTo =
        testReadOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const userWithNoGroupClaim = {
        sub: `auth0|${nanoid()}`,
        scope: RegistrarScopes.ReadOrganizations,
      };
      const ctx = {
        ...contextWithRepos,
        user: userWithNoGroupClaim,
      };
      await persistGroup({
        groupId: didOfGroupUserBelongsTo,
        clientAdminIds: [testReadOrganizationsUser.sub],
      });

      await expect(() =>
        verifyUserOrganizationReadAuthorized(ctx)
      ).rejects.toThrow(
        UserErrorMessages.USER_MUST_HAVE_GROUP_CLAIM({
          user: userWithNoGroupClaim,
        })
      );
    });

    it('should throw when user does not have the group claim of the leader org they are requesting', async () => {
      const didOfGroupUserBelongsTo =
        testReadOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const otherDid = 'did:other';
      const ctx = {
        ...contextWithRepos,
        params: {
          did: otherDid,
        },
        user: testReadOrganizationsUser,
      };
      await persistGroup({
        groupId: didOfGroupUserBelongsTo,
        clientAdminIds: [testReadOrganizationsUser.sub],
      });
      const orgGroup = await persistGroup({
        groupId: otherDid,
        clientAdminIds: [],
      });
      const func = async () => verifyUserOrganizationReadAuthorized(ctx);
      await expect(func).rejects.toThrow(
        UserErrorMessages.USER_CANNOT_ACCESS_ORGANIZATION_GROUP({
          user: testReadOrganizationsUser,
          group: orgGroup,
          did: otherDid,
        })
      );
    });

    it('should throw when user does not have the group claim of the follower org they are requesting', async () => {
      const didOfGroupUserBelongsTo =
        testReadOrganizationsUser[VNF_GROUP_ID_CLAIM];
      const otherGroupId = 'GROUP_A';
      const otherDid = 'did:other';
      const ctx = {
        ...contextWithRepos,
        params: {
          did: otherDid,
        },
        user: testReadOrganizationsUser,
      };
      await persistGroup({
        groupId: didOfGroupUserBelongsTo,
        clientAdminIds: [testReadOrganizationsUser.sub],
      });
      const orgGroup = await persistGroup({
        groupId: otherGroupId,
        dids: [otherDid],
        clientAdminIds: [],
      });
      const func = async () => verifyUserOrganizationReadAuthorized(ctx);
      await expect(func).rejects.toThrow(
        UserErrorMessages.USER_CANNOT_ACCESS_ORGANIZATION_GROUP({
          user: testReadOrganizationsUser,
          group: orgGroup,
          did: otherDid,
        })
      );
    });

    it('should throw when user does not have read or admin organization scope', async () => {
      const ctx = {
        params: {
          did: 'some-did',
        },
        user: testNoScopeUser,
      };
      const func = async () => verifyUserOrganizationReadAuthorized(ctx);
      await expect(func).rejects.toThrow(
        UserErrorMessages.MISSING_REQUIRED_SCOPES_TEMPLATE({
          requiredScopes: [
            RegistrarScopes.ReadOrganizations,
            RegistrarScopes.AdminOrganizations,
          ],
        })
      );
    });
  });
  describe('verifyAuthorizedWriteUsers test suite', () => {
    it('should throw when user has write:users scope and is missing group claim', async () => {
      const did = testWriteIAMUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        body: {
          groupId: did,
          registrarRole: RoleNames.RegistrarClientAdmin,
        },
        user: omit([VNF_GROUP_ID_CLAIM], testWriteIAMUser),
      };

      const func = async () => verifyAuthorizedWriteUsers(ctx);
      await expect(func).rejects.toThrow(
        UserErrorMessages.USER_MUST_HAVE_GROUP_CLAIM({
          user: testWriteIAMUser,
        })
      );
    });

    it('should return true when user has admin users scope', async () => {
      const ctx = {
        params: {
          did: 'some-did',
        },
        user: testIAMSuperUser,
      };

      const result = await verifyAuthorizedWriteUsers(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toBeUndefined();
    });

    it('should return true when there is no "params.id"', async () => {
      const groupId = testWriteIAMUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        params: {},
        user: testWriteIAMUser,
      };

      const group = await persistGroup({
        groupId,
        clientAdminIds: [testWriteIAMUser.sub],
      });
      const result = await verifyAuthorizedWriteUsers(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: group.dids,
        groupId: group.groupId,
      });
    });

    it('should return true when method is POST and no "params.id"', async () => {
      const user = omit(['scope'], testWriteIAMUser);
      const groupId = user[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        params: {},
        user: testWriteIAMUser,
        method: 'POST',
      };

      const group = await persistGroup({
        groupId,
        clientAdminIds: [testWriteIAMUser.sub],
      });
      const result = await verifyAuthorizedWriteUsers(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: group.dids,
        groupId: group.groupId,
        userId: 'new',
      });
    });

    it("should return true when user is an admin of the user's group", async () => {
      const userId = 'foo';
      const ctx = {
        ...contextWithRepos,
        params: {
          id: userId,
        },
        user: testWriteIAMUser,
      };

      const group = await persistGroup({
        clientAdminIds: [testWriteIAMUser.sub, userId],
      });
      const result = await verifyAuthorizedWriteUsers(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: group.dids,
        groupId: group.groupId,
        userId,
      });
    });

    it('should return true wants to write themselves', async () => {
      const ctx = {
        ...contextWithRepos,
        params: {
          id: testWriteIAMUser.sub,
        },
        user: testWriteIAMUser,
      };

      await persistGroup({
        clientAdminIds: [testWriteIAMUser.sub],
      });
      const result = await verifyAuthorizedWriteUsers(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        userId: testWriteIAMUser.sub,
      });
    });

    it('should throw when params.id used but user group claim doesnt exist', async () => {
      const ctx = {
        ...contextWithRepos,
        params: { id: 'foo' },
        user: testWriteIAMUser,
      };

      await expect(() => verifyAuthorizedWriteUsers(ctx)).rejects.toThrow(
        UserErrorMessages.USER_INVALID_GROUP_CLAIM({
          user: testWriteIAMUser,
        })
      );
    });

    it('should throw when no params.id used but user group claim doesnt exist', async () => {
      const ctx = {
        ...contextWithRepos,
        params: {},
        user: testWriteIAMUser,
      };

      await expect(() => verifyAuthorizedWriteUsers(ctx)).rejects.toThrow(
        UserErrorMessages.USER_INVALID_GROUP_CLAIM({
          user: testWriteIAMUser,
        })
      );
    });

    it('should throw when user is not an admin of the target user group', async () => {
      const otherUserId = 'foo';
      const ctx = {
        ...contextWithRepos,
        params: {
          id: otherUserId,
        },
        user: testWriteIAMUser,
      };
      const group = await persistGroup({
        clientAdminIds: [],
      });
      const func = async () => verifyAuthorizedWriteUsers(ctx);
      await expect(func).rejects.toThrow(
        UserErrorMessages.USER_NOT_GROUP_CLIENT_ADMIN({
          user: testWriteIAMUser,
          group,
        })
      );
    });

    it('should throw when user does not have write or admin users scope', async () => {
      const ctx = {
        params: {
          id: 'foo',
        },
        user: testNoScopeUser,
      };
      const func = async () => verifyAuthorizedWriteUsers(ctx);
      await expect(func).rejects.toThrow(
        UserErrorMessages.MISSING_REQUIRED_SCOPES_TEMPLATE({
          requiredScopes: [
            RegistrarScopes.WriteUsers,
            RegistrarScopes.AdminUsers,
          ],
        })
      );
    });
  });
  describe('verifyAuthorizedReadUsers test suite', () => {
    it('should return true when user has admin users scope', async () => {
      const ctx = {
        params: {
          id: 'foo',
        },
        user: testIAMSuperUser,
      };

      const result = await verifyAuthorizedReadUsers(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toBeUndefined();
    });

    it('should return true when there is no "params.id" on the context', async () => {
      const groupId = testReadIAMUser[VNF_GROUP_ID_CLAIM];
      const ctx = {
        ...contextWithRepos,
        params: {},
        user: testReadIAMUser,
      };

      const groups = await Promise.all([
        persistGroup({
          groupId,
          clientAdminIds: [`auth0|${nanoid()}`, testReadIAMUser.sub],
        }),
        await persistGroup({
          groupId: nanoid(),
          clientAdminIds: [`auth0|${nanoid()}`, testReadIAMUser.sub],
        }),
      ]);
      const result = await verifyAuthorizedReadUsers(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        groupId,
        dids: groups[0].dids,
      });
    });

    it("should return true when there is params.id and user is an admin in the user's group", async () => {
      const groupId = testReadIAMUser[VNF_GROUP_ID_CLAIM];
      const userId = nanoid();
      const ctx = {
        ...contextWithRepos,
        params: {
          id: userId,
        },
        user: testReadIAMUser,
      };

      const group = await persistGroup({
        groupId,
        clientAdminIds: [testReadIAMUser.sub],
      });
      const result = await verifyAuthorizedReadUsers(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        groupId,
        userId,
        dids: group.dids,
      });
    });

    it('should return true when user reads themselves', async () => {
      await persistGroup({
        groupId: testReadIAMUser[VNF_GROUP_ID_CLAIM],
        clientAdminIds: [],
      });
      const ctx = {
        ...contextWithRepos,
        params: {
          id: testReadIAMUser.sub,
        },
        user: testReadIAMUser,
      };

      const result = await verifyAuthorizedReadUsers(ctx);
      expect(result).toEqual(true);
      expect(ctx.scope).toEqual({
        userId: testReadIAMUser.sub,
      });
    });

    it("should return true when user is not an admin in the user's group", async () => {
      const groupId = testReadIAMUser[VNF_GROUP_ID_CLAIM];
      const fooUserId = 'foo';
      const ctx = {
        ...contextWithRepos,
        params: {
          id: fooUserId,
        },
        user: testReadIAMUser,
      };

      const group = await persistGroup({
        groupId,
        dids: [],
        clientAdminIds: [],
      });
      await expect(await verifyAuthorizedReadUsers(ctx)).toEqual(true);
      expect(ctx.scope).toEqual({
        dids: group.dids,
        groupId: group.groupId,
        userId: 'foo',
      });
    });

    it('should throw when params.id used but user group claim doesnt exist', async () => {
      const ctx = {
        ...contextWithRepos,
        params: { id: 'foo' },
        user: testReadIAMUser,
      };

      await expect(() => verifyAuthorizedReadUsers(ctx)).rejects.toThrow(
        UserErrorMessages.USER_INVALID_GROUP_CLAIM({
          user: testReadIAMUser,
        })
      );
    });

    it('should throw when no params.id used but user group claim doesnt exist', async () => {
      const ctx = {
        ...contextWithRepos,
        params: {},
        user: testReadIAMUser,
      };

      await expect(() => verifyAuthorizedReadUsers(ctx)).rejects.toThrow(
        UserErrorMessages.USER_INVALID_GROUP_CLAIM({
          user: testReadIAMUser,
        })
      );
    });

    it('should throw when user does not have read or admin users scope', async () => {
      const ctx = {
        params: {
          id: 'foo',
        },
        user: testNoScopeUser,
      };
      const func = async () => verifyAuthorizedReadUsers(ctx);
      await expect(func).rejects.toThrow(
        UserErrorMessages.MISSING_REQUIRED_SCOPES_TEMPLATE({
          requiredScopes: [
            RegistrarScopes.ReadUsers,
            RegistrarScopes.AdminUsers,
          ],
        })
      );
    });
  });
});
