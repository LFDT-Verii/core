const newError = require('http-errors');
const {
  verifyAuthorizedWriteUsers,
  verifyAuthorizedReadUsers,
} = require('../../plugins/authorization');
const {
  RegistrarScopes,
  UserErrorMessages,
  initCreateAuth0User,
  initUserManagement,
  initUserRegistrarEmails,
} = require('../../entities');

const userController = async (fastify) => {
  const createAuth0User = initCreateAuth0User(fastify);
  const { getUserWithRoles, softDeleteUser } = initUserManagement(
    fastify.config
  );

  const { emailToUserForUserInvite } = initUserRegistrarEmails(fastify.config);

  fastify.post(
    '/',
    {
      onRequest: fastify.verifyAccessToken([
        RegistrarScopes.AdminUsers,
        RegistrarScopes.WriteUsers,
      ]),
      preHandler: verifyAuthorizedWriteUsers,
      schema: fastify.autoSchema({
        security: [
          {
            RegistrarOAuth2: [
              RegistrarScopes.AdminUsers,
              RegistrarScopes.WriteUsers,
            ],
          },
        ],
        body: {
          $ref: 'https://velocitycareerlabs.io/modify-user.schema.json#',
        },
        response: {
          201: {
            $ref: 'https://velocitycareerlabs.io/user.schema.json#',
          },
          ...fastify.NotFoundResponse,
        },
      }),
    },
    async (req, reply) => {
      const { body, log, user: creatingUser, sendError } = req;
      const { registrarRole, tokenWalletRole, groupId: bodyGroupId } = body;

      const groupId = await computeGroupId(creatingUser, bodyGroupId, req);

      const createUserPayload = {
        ...body,
        groupId,
      };
      const { user, ticket } = await createAuth0User(
        {
          userPayload: createUserPayload,
          registrarRole,
          tokenWalletRole,
          groupId,
        },
        req
      );

      const organizations = await getOrganizationsByGroupId(
        { groupId, tokenWalletRole },
        req
      );

      try {
        await sendInvitationEmailToUser({
          user,
          ticket,
          organizations,
          registrarRole,
          tokenWalletRole,
        });
      } catch (error) {
        const message = 'Unable to send invitation email to user';
        const messageContext = { err: error, user };
        log.error(messageContext, message);
        sendError(error, { ...messageContext, message });
      }

      reply.code(201);
      return { ...user, registrarRole, tokenWalletRole, groupId };
    }
  );

  fastify.get(
    '/:id',
    {
      onRequest: fastify.verifyAccessToken([
        RegistrarScopes.AdminUsers,
        RegistrarScopes.ReadUsers,
      ]),
      preHandler: verifyAuthorizedReadUsers,
      schema: fastify.autoSchema({
        security: [
          {
            RegistrarOAuth2: [
              RegistrarScopes.AdminUsers,
              RegistrarScopes.ReadUsers,
            ],
          },
        ],
        params: {
          type: 'object',
          properties: { id: { type: 'string', description: 'the user id' } },
        },
        response: {
          200: {
            $ref: 'https://velocitycareerlabs.io/user.schema.json#',
          },
        },
      }),
    },
    async (req) => {
      const { log, params, scope, user: agent } = req;
      const user = await getUserWithRoles({ id: params.id }, req);
      if (scope?.groupId != null && user.groupId !== scope.groupId) {
        log.warn(
          `${agent.sub} (group ${scope.groupId} does not have access to user ${user.id} with group ${user.groupId}`
        );
        throw newError.NotFound('User Not Found');
      }
      return user;
    }
  );

  fastify.delete(
    '/:id',
    {
      onRequest: fastify.verifyAccessToken([
        RegistrarScopes.AdminUsers,
        RegistrarScopes.WriteUsers,
      ]),
      preHandler: verifyAuthorizedWriteUsers,
      schema: fastify.autoSchema({
        security: [
          {
            RegistrarOAuth2: [
              RegistrarScopes.AdminUsers,
              RegistrarScopes.WriteUsers,
            ],
          },
        ],
        params: {
          type: 'object',
          properties: { id: { type: 'string', description: 'the user id' } },
        },
        response: {
          204: {
            type: 'null',
          },
        },
      }),
    },
    async (req, reply) => {
      await softDeleteUser({ id: req.params.id }, req);
      return reply.status(204).send();
    }
  );

  const computeGroupId = async (user, bodyGroupId, { scope, log, repos }) => {
    if (scope?.groupId != null) {
      if (bodyGroupId !== scope.groupId) {
        log.error(
          `User scope.groupId is "${scope.groupId}" doesnt matching requested groupId "${bodyGroupId}"`
        );
        throw newError.Forbidden(
          bodyGroupId === 'new'
            ? UserErrorMessages.USER_MUST_SPECIFY_GROUP_ID
            : UserErrorMessages.USER_CANNOT_SPECIFY_GROUP_ID
        );
      }
    } else if (bodyGroupId !== 'new') {
      // when no authenticated scope, then validate that the requested group exists
      await repos.groups.findGroupByGroupId(bodyGroupId);
    }

    return bodyGroupId === 'new' ? undefined : bodyGroupId;
  };

  const sendInvitationEmailToUser = async ({
    user,
    ticket,
    organizations,
    registrarRole,
    tokenWalletRole,
  }) => {
    await fastify.sendEmail(
      emailToUserForUserInvite({
        user,
        ticket,
        organizations,
        registrarRole,
        tokenWalletRole,
      })
    );
  };
  const getOrganizationsByGroupId = async (
    { groupId, tokenWalletRole },
    context
  ) => {
    if (!groupId || !tokenWalletRole) return [];

    const { repos } = context;
    const group = await repos.groups.findGroupByGroupId(groupId);
    return repos.organizations.find({
      filter: { 'didDoc.id': { $in: group.dids } },
    });
  };
};

module.exports = userController;
