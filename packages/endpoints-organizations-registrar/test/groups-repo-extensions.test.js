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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { testRegistrarUser, mongoify } = require('@verii/tests-helpers');

const initGroupsFactory = require('../src/entities/groups/factories/groups-factory');
const buildFastify = require('./helpers/build-fastify');
const groupsRepoPlugin = require('../src/entities/groups/repo');

const { VNF_GROUP_ID_CLAIM } = require('../src/entities');

describe('Organizations Group related functions test suite', () => {
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
    await mongoDb().collection('groups').deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });

  describe('createUserGroup test suite', () => {
    it('should create a group', async () => {
      const groupId = 'fake-group-id';
      const userId = 'fake-user-id';
      const group = {
        groupId,
        dids: [groupId],
        clientAdminIds: [userId],
      };

      await groupsRepo.createGroup(groupId, userId);
      const findGroupResult = await groupsRepo.findGroupByGroupId(groupId);
      expect(findGroupResult).toMatchObject(group);
    });
  });
  describe('findGroupByUserIdAndDid test suite', () => {
    it("should not find a group when userId isn't present", async () => {
      const groupId = testRegistrarUser[VNF_GROUP_ID_CLAIM];
      const did = testRegistrarUser[VNF_GROUP_ID_CLAIM];
      const userId = testRegistrarUser.sub;

      await persistGroup({
        groupId,
        dids: [did],
        clientAdminIds: ['some-other-user-id'],
      });
      const group = await groupsRepo.findGroupByUserIdAndDid(userId, did);
      expect(group).toBeNull();
    });

    it("should not find a group when did isn't present in group", async () => {
      const groupId = testRegistrarUser[VNF_GROUP_ID_CLAIM];
      const did = testRegistrarUser[VNF_GROUP_ID_CLAIM];
      const userId = testRegistrarUser.sub;

      await persistGroup({
        groupId,
        dids: ['some-other-did'],
        clientAdminIds: [userId],
      });
      const group = await groupsRepo.findGroupByUserIdAndDid(userId, did);
      expect(group).toBeNull();
    });
    it('should find a matching group', async () => {
      const groupId = testRegistrarUser[VNF_GROUP_ID_CLAIM];
      const did = testRegistrarUser[VNF_GROUP_ID_CLAIM];
      const userId = testRegistrarUser.sub;

      const persistedGroup = await persistGroup({
        groupId,
        dids: [did],
        clientAdminIds: [userId],
      });
      const group = await groupsRepo.findGroupByUserIdAndDid(userId, did);
      expect(group).toEqual(mongoify(persistedGroup));
    });
  });
  describe('findGroupByDid test suite', () => {
    it("should find a group when userId isn't present", async () => {
      const groupId = testRegistrarUser[VNF_GROUP_ID_CLAIM];
      const did = testRegistrarUser[VNF_GROUP_ID_CLAIM];

      await persistGroup({
        groupId,
        dids: [did],
        clientAdminIds: ['some-other-user-id'],
      });
      const findGroupResult = await groupsRepo.findGroupByGroupId(groupId);
      const group = await groupsRepo.findGroupByDid(did);

      expect(findGroupResult).toEqual(
        mongoify({
          ...group,
          dids: [did],
        })
      );
    });

    it("should not find a group when did isn't present in group", async () => {
      const groupId = testRegistrarUser[VNF_GROUP_ID_CLAIM];
      const did = testRegistrarUser[VNF_GROUP_ID_CLAIM];
      const userId = testRegistrarUser.sub;

      await persistGroup({
        groupId,
        dids: ['some-other-did'],
        clientAdminIds: [userId],
      });
      const group = await groupsRepo.findGroupByDid(did);
      expect(group).toBeNull();
    });
    it('should find a matching group', async () => {
      const groupId = testRegistrarUser[VNF_GROUP_ID_CLAIM];
      const did = testRegistrarUser[VNF_GROUP_ID_CLAIM];
      const userId = testRegistrarUser.sub;

      const persistedGroup = await persistGroup({
        groupId,
        dids: [did],
        clientAdminIds: [userId],
      });
      const group = await groupsRepo.findGroupByDid(did);
      expect(group).toEqual(mongoify(persistedGroup));
    });
  });
  describe('addOrganizationToGroupOfUser test suite', () => {
    it('should add an organization to group of user properly', async () => {
      const groupId = 'fake-group-id';
      const userId = 'fake-user-id';

      const group = await persistGroup({
        groupId,
        dids: [groupId],
        clientAdminIds: [userId],
      });

      const did = 'new-did';
      await groupsRepo.addDidToGroupOfUser(userId, did);
      const findGroupResult = await groupsRepo.findGroupByGroupId(groupId);
      expect(findGroupResult).toEqual(
        mongoify({
          ...group,
          dids: [groupId, did],
          updatedAt: expect.any(Date),
        })
      );

      expect(new Date(findGroupResult.updatedAt).getTime()).toBeGreaterThan(
        new Date(group.updatedAt).getTime()
      );
    });
  });
  describe('addNewDidOfUser test suite', () => {
    it('should add an organization to group of user if user group already exists', async () => {
      const groupId = 'fake-group-id';
      const userId = 'fake-user-id';

      const group = await persistGroup({
        groupId,
        dids: [groupId],
        clientAdminIds: [userId],
      });

      const did = 'new-did';
      await groupsRepo.addNewDidOfUser(did, userId);
      const findGroupResult = await groupsRepo.findGroupByGroupId(groupId);
      expect(findGroupResult).toEqual(
        mongoify({
          ...group,
          dids: [groupId, did],
          updatedAt: expect.any(Date),
        })
      );

      expect(new Date(findGroupResult.updatedAt).getTime()).toBeGreaterThan(
        new Date(group.updatedAt).getTime()
      );
    });
    it('should create a new group for the user if no group is found', async () => {
      const userId = 'fake-user-id';

      const did = 'new-did';
      await groupsRepo.addNewDidOfUser(did, userId);
      const findGroupResult = await groupsRepo.findGroupByGroupId(did);
      expect(findGroupResult).toMatchObject({
        groupId: did,
        clientAdminIds: [userId],
        dids: [did],
      });
    });
  });
  describe('addUserToGroupClientAdmins test suite', () => {
    it('should add user to group if user does not exist in the group', async () => {
      const groupId = 'fake-group-id';
      const userId = 'fake-user-id';

      const group = await persistGroup({
        groupId,
        clientAdminIds: [],
      });

      await groupsRepo.addUserToGroupClientAdmins(groupId, userId);
      const findGroupResult = await groupsRepo.findGroupByGroupId(groupId);
      expect(findGroupResult).toEqual(
        mongoify({
          ...group,
          clientAdminIds: [userId],
          updatedAt: expect.any(Date),
        })
      );

      expect(new Date(findGroupResult.updatedAt).getTime()).toBeGreaterThan(
        new Date(group.updatedAt).getTime()
      );
    });
    it('should not add user and not error if user already exists in the group', async () => {
      const groupId = 'fake-group-id';
      const userId = 'fake-user-id';

      const group = await persistGroup({
        groupId,
        clientAdminIds: [userId],
      });

      await groupsRepo.addUserToGroupClientAdmins(groupId, userId);
      const findGroupResult = await groupsRepo.findGroupByGroupId(groupId);
      expect(findGroupResult).toEqual(
        mongoify({
          ...group,
          clientAdminIds: [userId],
        })
      );
    });
  });
});
