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
const {
  mongoify,
  errorResponseMatcher,
  testRegistrarUser,
} = require('@verii/tests-helpers');

const initGroupsFactory = require('../src/entities/groups/factories/groups-factory');
const buildFastify = require('./helpers/build-fastify');
const { VNF_GROUP_ID_CLAIM } = require('../src/entities');
const groupsRepoPlugin = require('../src/entities/groups/repo');

const baseUrl = '/api/v0.6/groups';

describe('Groups Test Suite', () => {
  let fastify;
  let newGroup;
  let persistGroup;
  let groupsRepo;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();

    ({ newGroup, persistGroup } = initGroupsFactory(fastify));

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

  describe('Groups CRUD Test Suite', () => {
    describe('Group Creation', () => {
      it('Should 400 if no groupId is specified', async () => {
        const did = 'did:123';
        const groupToCreate = {
          dids: [did],
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}`,
          payload: groupToCreate,
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
        const count = await groupsRepo.count({});
        expect(count).toEqual(0);
      });
      it('Should 400 if "groupId" is not a string', async () => {
        const did = 'did:123';
        const groupToCreate = {
          groupId: { foo: 'bar' },
          dids: [did],
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}`,
          payload: groupToCreate,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/groupId must be string',
          })
        );
        const count = await groupsRepo.count({});
        expect(count).toEqual(0);
      });
      it('Should 400 if "dids" is missing', async () => {
        const did = 'did:123';
        const groupToCreate = {
          groupId: did,
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}`,
          payload: groupToCreate,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: "body must have required property 'dids'",
          })
        );
        const count = await groupsRepo.count({});
        expect(count).toEqual(0);
      });
      it('Should 400 if "dids" array is empty', async () => {
        const did = 'did:123';
        const groupToCreate = {
          groupId: did,
          dids: [],
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}`,
          payload: groupToCreate,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/dids must NOT have fewer than 1 items',
          })
        );
        const count = await groupsRepo.count({});
        expect(count).toEqual(0);
      });
      it('Should 400 if "dids" is not an array', async () => {
        const did = 'did:123';
        const groupToCreate = {
          groupId: did,
          dids: { did },
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}`,
          payload: groupToCreate,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/dids must be array',
          })
        );
        const count = await groupsRepo.count({});
        expect(count).toEqual(0);
      });
      it('Should 400 if value in "dids" array is not a string', async () => {
        const did = 'did:123';
        const groupToCreate = {
          groupId: did,
          dids: [{ did }],
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}`,
          payload: groupToCreate,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/dids/0 must be string',
          })
        );
        const count = await groupsRepo.count({});
        expect(count).toEqual(0);
      });
      it('Should 400 if "clientAdminIds" is missing', async () => {
        const did = 'did:123';
        const groupToCreate = {
          groupId: did,
          dids: [did],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}`,
          payload: groupToCreate,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: "body must have required property 'clientAdminIds'",
          })
        );
        const count = await groupsRepo.count({});
        expect(count).toEqual(0);
      });
      it('Should 400 if "clientAdminIds" is not an array', async () => {
        const did = 'did:123';
        const groupToCreate = {
          groupId: did,
          dids: [did],
          clientAdminIds: {},
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}`,
          payload: groupToCreate,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/clientAdminIds must be array',
          })
        );
        const count = await groupsRepo.count({});
        expect(count).toEqual(0);
      });
      it('Should 400 if value in "clientAdminIds" array is not a string', async () => {
        const did = 'did:123';
        const groupToCreate = {
          groupId: did,
          dids: [did],
          clientAdminIds: [{}],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}`,
          payload: groupToCreate,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/clientAdminIds/0 must be string',
          })
        );
        const count = await groupsRepo.count({});
        expect(count).toEqual(0);
      });
      it('Should 409 if "groupId" already exist in db', async () => {
        const group = await persistGroup();

        const groupToCreate = {
          groupId: group.groupId,
          dids: [group.dids[0]],
          clientAdminIds: [],
        };

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}`,
          payload: groupToCreate,
        });

        expect(response.statusCode).toEqual(409);
        expect(response.json).toEqual(
          errorResponseMatcher({
            statusCode: 409,
            error: 'Conflict',
            message: 'Group with the same group id already exist.',
          })
        );
      });
      it('Should create a group', async () => {
        const did = 'did:123';
        const groupToCreate = {
          groupId: did,
          dids: [did],
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${baseUrl}`,
          payload: groupToCreate,
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual(groupToCreate);
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toMatchObject(groupToCreate);
      });
    });
    describe('Group Updates', () => {
      it('Should 404 when trying to update a group that does not exist', async () => {
        const did = 'did:123';
        const group = await persistGroup({
          groupId: did,
          dids: [did],
          clientAdminIds: [],
        });
        const missingDid = 'did:missing';
        const updatePayload = {
          dids: [missingDid, 'did:additional-did'],
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${missingDid}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'missing_error_code',
            statusCode: 404,
            error: 'Not Found',
            message: `Group ${missingDid} not found`,
          })
        );
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toEqual(mongoify(group));
      });
      it('Should 400 if "dids" array is missing', async () => {
        const did = 'did:123';
        const group = await persistGroup({
          groupId: did,
          dids: [did],
          clientAdminIds: [],
        });
        const updatePayload = {
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${did}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: "body must have required property 'dids'",
          })
        );
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toEqual(mongoify(group));
      });
      it('Should 400 if "dids" array is empty', async () => {
        const did = 'did:123';
        const group = await persistGroup({
          groupId: did,
          dids: [did],
          clientAdminIds: [],
        });
        const updatePayload = {
          dids: [],
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${did}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/dids must NOT have fewer than 1 items',
          })
        );
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toEqual(mongoify(group));
      });
      it('Should 400 if "dids" is not an array', async () => {
        const did = 'did:123';
        const group = await persistGroup({
          groupId: did,
          dids: [did],
          clientAdminIds: [],
        });
        const updatePayload = {
          dids: { did },
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${did}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/dids must be array',
          })
        );
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toEqual(mongoify(group));
      });
      it('Should 400 if value in "dids" array is not a string', async () => {
        const did = 'did:123';
        const group = await persistGroup({
          groupId: did,
          dids: [did],
          clientAdminIds: [],
        });
        const updatePayload = {
          dids: [{ did }],
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${did}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/dids/0 must be string',
          })
        );
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toEqual(mongoify(group));
      });
      it('Should 400 if "clientAdminIds" is missing', async () => {
        const did = 'did:123';
        const group = await persistGroup({
          groupId: did,
          dids: [did],
          clientAdminIds: [],
        });
        const updatePayload = {
          dids: [did],
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${did}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: "body must have required property 'clientAdminIds'",
          })
        );
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toEqual(mongoify(group));
      });
      it('Should 400 if "clientAdminIds" is not an array', async () => {
        const did = 'did:123';
        const group = await persistGroup({
          groupId: did,
          dids: [did],
          clientAdminIds: [],
        });
        const updatePayload = {
          dids: [did],
          clientAdminIds: {},
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${did}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/clientAdminIds must be array',
          })
        );
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toEqual(mongoify(group));
      });
      it('Should 400 if value in "clientAdminIds" array is not a string', async () => {
        const did = 'did:123';
        const group = await persistGroup({
          groupId: did,
          dids: [did],
          clientAdminIds: [],
        });
        const updatePayload = {
          dids: [did],
          clientAdminIds: [{}],
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${did}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/clientAdminIds/0 must be string',
          })
        );
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toEqual(mongoify(group));
      });
      it('Should update a group', async () => {
        const did = 'did:123';
        await persistGroup({
          groupId: did,
          dids: [did],
          clientAdminIds: [],
        });
        const updatePayload = {
          dids: [did, 'did:additional-did'],
          clientAdminIds: [],
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/${did}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          ...updatePayload,
          groupId: did,
        });
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toMatchObject(updatePayload);
      });
    });
    describe('Groups retrieval', () => {
      it('Should retrieve an empty array if there are no groups', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual([]);
      });

      it('Should retrieve multiple groups', async () => {
        const did1 = 'did:123';
        const did2 = 'did:456';
        const group1 = await newGroup({
          groupId: did1,
          dids: [did1],
          clientAdminIds: [],
        });
        await persistGroup(group1);
        const group2 = await newGroup({
          groupId: did2,
          dids: [did2],
          clientAdminIds: [],
        });
        await persistGroup(group2);

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(expect.arrayContaining([group1, group2]));
        expect(response.json).toHaveLength(2);
      });
    });
    describe('Group retrieval', () => {
      it('Should retrieve a particular group only of user when not superuser', async () => {
        const did = testRegistrarUser[VNF_GROUP_ID_CLAIM];

        const response2 = await prepareGroupForExpectation({
          groupId: 'different did',
          dids: [did],
          clientAdminIds: [did],
        });
        expect(response2.statusCode).toEqual(404);

        const group = await newGroup({
          groupId: did,
          dids: [did],
          clientAdminIds: [did],
        });
        const response1 = await prepareGroupForExpectation(group);
        expect(response1.statusCode).toEqual(200);
        expect(response1.json).toEqual([group]);
      });

      const prepareGroupForExpectation = async (group) => {
        await persistGroup(group);

        return fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarUser),
          },
        });
      };

      it('Should retrieve a single group', async () => {
        const did = 'did:123';
        const group = await newGroup({
          groupId: did,
          dids: [did],
          clientAdminIds: [],
        });
        await persistGroup(group);
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${did}`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(group);
      });

      it('Should 404 when trying to retrieve a group that does not exist', async () => {
        const did = 'did:123';
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${did}`,
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'missing_error_code',
            statusCode: 404,
            error: 'Not Found',
            message: `Group ${did} not found`,
          })
        );
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toBeNull();
      });
    });
    describe('Groups deletion', () => {
      it('Should delete a group', async () => {
        const did = 'did:123';
        const group = await newGroup({
          groupId: did,
          dids: [did],
          clientAdminIds: [],
        });
        await persistGroup(group);
        const response = await fastify.injectJson({
          method: 'DELETE',
          url: `${baseUrl}/${did}`,
        });

        expect(response.statusCode).toEqual(204);
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toBeNull();
      });

      it('Should 404 when trying to delete a group that does not exist', async () => {
        const did = 'did:123';
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${did}`,
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'missing_error_code',
            statusCode: 404,
            error: 'Not Found',
            message: `Group ${did} not found`,
          })
        );
        const groupFromDb = await groupsRepo.findOne();
        expect(groupFromDb).toBeNull();
      });
    });
  });
});
