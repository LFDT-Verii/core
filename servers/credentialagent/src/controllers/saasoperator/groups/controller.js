const { map, omit } = require('lodash/fp');
const { newGroupSchema, groupSchema } = require('./schemas');
const { formatGroup } = require('../../../entities');
const { validateGroup } = require('../../../entities/groups/orchestrators');

const controller = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
        response: {
          200: {
            type: 'object',
            properties: {
              groups: {
                type: 'array',
                items: groupSchema,
              },
            },
            required: ['groups'],
          },
        },
      }),
    },
    async (req) => {
      const { repos } = req;
      const groups = await repos.groups.find();
      return {
        groups: map(formatGroup, groups),
      };
    }
  );

  fastify.post(
    '/',
    {
      schema: fastify.autoSchema({
        body: newGroupSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              group: groupSchema,
            },
            required: ['group'],
          },
        },
      }),
    },
    async (req) => {
      const { body, repos } = req;
      await validateGroup(body, req);

      const newGroup = await repos.groups.insert({
        ...omit(['did'], body),
        _id: body.did,
      });
      return {
        group: formatGroup(newGroup),
      };
    }
  );
};

module.exports = controller;
