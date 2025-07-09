const newError = require('http-errors');

const { RegistrarScopes, VNF_GROUP_ID_CLAIM } = require('../../entities');

const groupsController = async (fastify) => {
  fastify
    .autoSchemaPreset({
      security: [{ RegistrarOAuth2: [RegistrarScopes.ReadOrganizations] }],
    })
    .get(
      '/',
      {
        onRequest: [
          fastify.verifyAccessToken([RegistrarScopes.ReadOrganizations]),
        ],
        schema: fastify.autoSchema({
          response: {
            200: {
              type: 'array',
              items: {
                $ref: 'https://velocitycareerlabs.io/group.schema.json',
              },
            },
          },
        }),
      },
      async ({ repos, user }) => {
        return user?.[VNF_GROUP_ID_CLAIM]
          ? [await repos.groups.findGroupByGroupId(user[VNF_GROUP_ID_CLAIM])]
          : repos.groups.find();
      }
    );

  fastify
    .autoSchemaPreset({
      security: [{ RegistrarOAuth2: [RegistrarScopes.AdminOrganizations] }],
    })
    .get(
      '/:groupId',
      {
        onRequest: [
          fastify.verifyAccessToken([RegistrarScopes.AdminOrganizations]),
        ],
        schema: fastify.autoSchema({
          params: {
            type: 'object',
            properties: {
              groupId: { type: 'string' },
            },
          },
          response: {
            200: {
              $ref: 'https://velocitycareerlabs.io/group.schema.json',
            },
          },
        }),
      },
      async (req) => {
        const { params, repos } = req;
        const { groupId } = params;
        return repos.groups.findGroupByGroupId(groupId);
      }
    )
    .post(
      '/',
      {
        onRequest: fastify.verifyAccessToken([
          RegistrarScopes.AdminOrganizations,
        ]),
        schema: fastify.autoSchema({
          body: {
            $ref: 'https://velocitycareerlabs.io/group.schema.json',
          },
          response: {
            201: {
              $ref: 'https://velocitycareerlabs.io/group.schema.json',
            },
            409: { $ref: 'error#' },
          },
        }),
      },
      async (req, reply) => {
        const { body, repos } = req;

        await validateGroupId(body.groupId, req);

        const group = await repos.groups.insert(body);
        reply.code(201);
        return group;
      }
    )
    .put(
      '/:groupId',
      {
        onRequest: fastify.verifyAccessToken([
          RegistrarScopes.AdminOrganizations,
        ]),
        schema: fastify.autoSchema({
          params: {
            type: 'object',
            properties: {
              groupId: { type: 'string' },
            },
          },
          body: {
            $ref: 'https://velocitycareerlabs.io/modify-group.schema.json',
          },
          response: {
            200: {
              $ref: 'https://velocitycareerlabs.io/group.schema.json',
            },
          },
        }),
      },
      async (req) => {
        const {
          body,
          repos,
          params: { groupId },
        } = req;
        const { _id } = await repos.groups.findGroupByGroupId(groupId);
        return repos.groups.update(_id, body);
      }
    )
    .delete(
      '/:groupId',
      {
        onRequest: fastify.verifyAccessToken([
          RegistrarScopes.AdminOrganizations,
        ]),
        schema: fastify.autoSchema({
          params: {
            type: 'object',
            properties: {
              groupId: { type: 'string' },
            },
          },
          response: {
            204: {
              type: 'null',
            },
          },
        }),
      },
      async (req, reply) => {
        const {
          repos,
          params: { groupId },
        } = req;
        const { _id } = await repos.groups.findGroupByGroupId(groupId);
        await repos.groups.del(_id);
        return reply.status(204).send(undefined);
      }
    );

  const validateGroupId = async (groupId, ctx) => {
    const { repos } = ctx;
    const group = await repos.groups.findOne({
      filter: {
        groupId,
      },
    });

    if (group) {
      throw new newError.Conflict(
        'Group with the same group id already exist.'
      );
    }
  };
};

module.exports = groupsController;
