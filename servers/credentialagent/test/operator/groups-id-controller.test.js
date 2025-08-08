const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { omit } = require('lodash/fp');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const { initGroupsFactory, groupRepoPlugin } = require('../../src/entities');

const groupUrl = '/groups/';

const groupMatcher = (group) => ({
  ...omit(['_id'], group),
  did: group._id.toString(),
  id: group._id.toString(),
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
});

describe('Groups controller test suite', () => {
  let fastify;
  let persistGroup;
  let groupRepo;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();

    ({ persistGroup } = initGroupsFactory(fastify));

    groupRepo = groupRepoPlugin({})(fastify);
  });

  beforeEach(async () => {
    await mongoDb().collection('groups').deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });

  describe('GET /groups/:id', () => {
    it('should throw error if a group not found', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `${groupUrl}123`,
      });
      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'group_does_not_exist',
          message: 'Group does not exist',
          statusCode: 404,
        })
      );
    });
    it('should return a group', async () => {
      const group = await persistGroup({
        slug: 'test-group',
        did: 'did:example:123',
      });
      const response = await fastify.inject({
        method: 'GET',
        url: `${groupUrl}${group._id.toString()}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json()).toEqual({
        group: groupMatcher(group),
      });
    });
  });
  describe('PUT /groups/:id', () => {
    it('should throw error if a group not found', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: `${groupUrl}123`,
        body: {
          slug: 'new-slug',
          did: 'did:example:123',
        },
      });
      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'group_does_not_exist',
          message: 'Group does not exist',
          statusCode: 404,
        })
      );
    });
    it('should throw error if a slug already exists', async () => {
      await persistGroup({
        slug: 'new-test-group',
      });
      const group = await persistGroup({
        slug: 'test-group',
        _id: 'did:example:123',
      });
      const response = await fastify.inject({
        method: 'PUT',
        url: `${groupUrl}${group._id.toString()}`,
        body: {
          ...group,
          slug: 'new-test-group',
        },
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'slug_already_exist',
          message: 'Group with the given SLUG already exists',
          statusCode: 400,
        })
      );
    });
    it('should update a group', async () => {
      const group = await persistGroup({
        slug: 'test-group',
        _id: 'did:example:123',
      });
      const response = await fastify.inject({
        method: 'PUT',
        url: `${groupUrl}${group._id.toString()}`,
        payload: {
          slug: 'new-slug',
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json()).toEqual({
        group: groupMatcher({ ...group, slug: 'new-slug' }),
      });

      const groupDb = await groupRepo.findById(group._id);
      expect(groupDb).toEqual({
        ...group,
        slug: 'new-slug',
        _id: expect.anything(),
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      });
    });
  });
  describe('DELETE /groups/:id', () => {
    it('should throw error if a group not found', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: `${groupUrl}123`,
      });
      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'group_does_not_exist',
          message: 'Group does not exist',
          statusCode: 404,
        })
      );
    });
    it('should throw error if a group has tenants', async () => {
      const group = await persistGroup({
        slug: 'test-group',
        _id: 'did:example:123',
        dids: ['did:example:456'],
      });
      const response = await fastify.inject({
        method: 'DELETE',
        url: `${groupUrl}${group._id}`,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'group_has_tenants',
          message: 'Group has tenants associated with it',
          statusCode: 400,
        })
      );
    });
    it('should delete a group', async () => {
      const group = await persistGroup({
        slug: 'test-group',
        _id: 'did:example:123',
      });
      const response = await fastify.inject({
        method: 'DELETE',
        url: `${groupUrl}${group._id}`,
      });
      expect(response.statusCode).toEqual(204);

      const groupDb = await groupRepo.findOne({
        filter: {
          _id: group._id,
        },
      });
      expect(groupDb).toBeNull();
    });
  });

  describe('POST /groups/:id/add-did', () => {
    it('should throw error if a group not found', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `${groupUrl}123/add-did`,
        body: {
          did: 'did:example:123',
        },
      });
      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'group_does_not_exist',
          message: 'Group does not exist',
          statusCode: 404,
        })
      );
      const groupDb = await groupRepo.count({ filter: {} });
      expect(groupDb).toBe(0);
    });
    it('should throw error if a did already linked', async () => {
      await persistGroup({
        dids: ['did:linked:123'],
      });
      const group = await persistGroup({
        _id: 'did:example:123',
      });
      const response = await fastify.inject({
        method: 'POST',
        url: `${groupUrl}${group._id.toString()}/add-did`,
        body: {
          did: 'did:linked:123',
        },
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'did_already_in_group',
          message: 'Did already linked to a group',
          statusCode: 400,
        })
      );
    });
    it('should add a did to a group if a did already linked to the same group', async () => {
      const group = await persistGroup({
        dids: ['did:linked:123', 'did:linked:124', 'did:linked:125'],
      });
      const response = await fastify.inject({
        method: 'POST',
        url: `${groupUrl}${group._id.toString()}/add-did`,
        body: {
          did: 'did:linked:124',
        },
      });
      expect(response.statusCode).toEqual(204);
      const groupDb = await groupRepo.findById(group._id);
      expect(groupDb).toEqual({
        ...group,
        _id: expect.anything(),
        dids: ['did:linked:123', 'did:linked:124', 'did:linked:125'],
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      });
    });
    it('should add a did to a group', async () => {
      const group = await persistGroup({
        _id: 'did:example:123',
      });
      const response = await fastify.inject({
        method: 'POST',
        url: `${groupUrl}${group._id.toString()}/add-did`,
        payload: {
          did: 'did:linked:123',
        },
      });
      expect(response.statusCode).toEqual(204);
      const groupDb = await groupRepo.findById(group._id);
      expect(groupDb).toEqual({
        ...group,
        _id: expect.anything(),
        dids: ['did:linked:123'],
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      });
    });
  });
});
