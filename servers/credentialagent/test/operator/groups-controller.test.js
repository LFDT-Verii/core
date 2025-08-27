const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { omit } = require('lodash/fp');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const { initGroupsFactory } = require('../../src/entities');

const groupUrl = '/groups/';

const groupMatcher = (group) => ({
  ...omit(['_id'], group),
  did: group._id,
  id: group._id,
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
});

describe('Groups controller test suite', () => {
  let fastify;
  let persistGroup;

  before(async () => {
    fastify = buildFastify({
      clientSecret: 'abc',
    });
    await fastify.ready();

    ({ persistGroup } = initGroupsFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('groups').deleteMany({});
  });

  after(async () => {
    await fastify.close();
  });

  describe('GET /groups', () => {
    it('should return all groups', async () => {
      const group1 = await persistGroup();
      const group2 = await persistGroup();

      const response = await fastify.inject({
        method: 'GET',
        url: groupUrl,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        groups: [groupMatcher(group2), groupMatcher(group1)],
      });
    });

    it('should return empty response', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: groupUrl,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        groups: [],
      });
    });
  });
  describe('POST /groups', () => {
    it('should create a group', async () => {
      const group = {
        slug: 'test-group',
        did: 'did:example:123',
      };

      const response = await fastify.inject({
        method: 'POST',
        url: groupUrl,
        payload: group,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        group: {
          id: group.did,
          did: group.did,
          slug: group.slug,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
    });

    it('should return error if slug already exists', async () => {
      const group = {
        slug: 'test-group',
        did: 'did:example:123',
      };

      await persistGroup(group);

      const response = await fastify.inject({
        method: 'POST',
        url: groupUrl,
        payload: group,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'slug_already_exist',
          message: 'Group with the given SLUG already exists',
          statusCode: 400,
        })
      );
    });

    it('should return error if did already exists', async () => {
      const did = 'did:example:123';
      const group = {
        slug: 'test-group',
        did,
      };

      await persistGroup({ ...group, _id: did });

      const response = await fastify.inject({
        method: 'POST',
        url: groupUrl,
        payload: {
          ...group,
          slug: 'test-group-2',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'did_already_exist',
          message: 'Group with the given DID already exists',
          statusCode: 400,
        })
      );
    });
  });
});
