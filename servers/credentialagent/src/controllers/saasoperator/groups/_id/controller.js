const newError = require('http-errors');
const { isEmpty } = require('lodash/fp');
const {
  formatGroup,
  validateGroup,
  findGroupOrError,
  validateDid,
} = require('../../../../entities');
const { groupSchema } = require('../schemas');

const controller = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
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
      const { params } = req;
      const group = await findGroupOrError(params.id, req);
      return { group: formatGroup(group) };
    }
  );

  fastify.delete(
    '/',
    {
      schema: fastify.autoSchema({
        response: {
          204: { type: 'null' },
          400: { $ref: 'error#' },
        },
      }),
    },
    async (req, rep) => {
      const { params, repos } = req;

      const group = await findGroupOrError(params.id, req);
      if (!isEmpty(group.dids)) {
        throw newError(400, 'Group has tenants associated with it', {
          errorCode: 'group_has_tenants',
        });
      }
      await repos.groups.del(params.id);
      rep.code(204);
    }
  );

  fastify.put(
    '/',
    {
      schema: fastify.autoSchema({
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            slug: { type: 'string', minLength: 1, pattern: '^[a-z0-9_-]*' },
          },
          required: ['slug'],
        },
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
      const { repos, body, params } = req;
      await validateGroup(body, req);
      const updatedGroup = await repos.groups.updateOrError(params.id, {
        $set: { slug: body.slug },
      });
      return { group: formatGroup(updatedGroup) };
    }
  );

  fastify.post(
    '/add-did',
    {
      schema: fastify.autoSchema({
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            did: { type: 'string' },
          },
          required: ['did'],
        },
        response: {
          204: { type: 'null' },
        },
      }),
    },
    async (req, rep) => {
      const { repos, body, params } = req;
      const { id } = params;
      const { did } = body;
      await validateDid(id, did, req);
      await repos.groups.updateOrError(id, {
        $addToSet: { dids: did },
      });
      rep.code(204).send();
    }
  );
};

module.exports = controller;
