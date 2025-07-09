const { isEmpty } = require('lodash/fp');
const newError = require('http-errors');
const { nanoid } = require('nanoid/non-secure');
const { addSeconds } = require('date-fns/fp');
const {
  verifyUserOrganizationWriteAuthorized,
} = require('../../../../../plugins/authorization');
const { initGetOrCreateAuth0User } = require('../../../../../entities/users');
const {
  RegistrarScopes,
  getInvitationResponseBodySchema,
  buildInvitationUrl,
  initSendEmailInvitee,
  validateInviteeEmail,
} = require('../../../../../entities');

const invitationController = async (fastify) => {
  const sendEmailToInvitee = initSendEmailInvitee(fastify);

  const getOrCreateAuth0User = initGetOrCreateAuth0User(fastify);

  fastify.get(
    '/',
    {
      onRequest: fastify.verifyAccessToken([
        RegistrarScopes.ReadOrganizations,
        RegistrarScopes.AdminOrganizations,
      ]),
      preHandler: [verifyUserOrganizationWriteAuthorized],
      schema: fastify.autoSchema({
        security: [
          {
            RegistrarOAuth2: [
              RegistrarScopes.ReadOrganizations,
              RegistrarScopes.AdminOrganizations,
            ],
          },
        ],
        response: {
          200: getInvitationResponseBodySchema,
        },
      }),
    },
    async (req) => {
      const {
        params: { did, invitationId },
        repos,
      } = req;
      await repos.organizations.findOneByDid(did, {
        _id: 1,
      });
      const invitation = await repos.invitations.findOne({
        filter: {
          _id: invitationId,
          inviterDid: did,
        },
      });

      if (isEmpty(invitation)) {
        throw newError(404, 'Invitation not found', {
          errorCode: 'invitation_not_found',
        });
      }

      return {
        invitation,
      };
    }
  );

  fastify.put(
    '/',
    {
      onRequest: fastify.verifyAccessToken([
        RegistrarScopes.WriteOrganizations,
        RegistrarScopes.AdminOrganizations,
      ]),
      preHandler: [verifyUserOrganizationWriteAuthorized],
      schema: fastify.autoSchema({
        security: [
          {
            RegistrarOAuth2: [
              RegistrarScopes.WriteOrganizations,
              RegistrarScopes.AdminOrganizations,
            ],
          },
        ],
        body: {
          type: 'object',
          properties: {
            inviteeEmail: {
              type: 'string',
            },
          },
          required: ['inviteeEmail'],
        },
        response: {
          200: getInvitationResponseBodySchema,
        },
      }),
    },
    async (req) => {
      const {
        body: { inviteeEmail },
        params: { did, invitationId },
        config: { registrarResendInvitationTtl },
        repos,
      } = req;
      const inviterOrganization = await repos.organizations.findOneByDid(did);
      validateInviteeEmail(inviteeEmail);

      const code = nanoid(16);
      const expiresAt = addSeconds(registrarResendInvitationTtl, new Date());
      const invitationUrl = buildInvitationUrl({ code }, req);

      const invitation = await repos.invitations.findOne({
        filter: {
          _id: invitationId,
          inviterDid: did,
        },
      });

      if (isEmpty(invitation)) {
        throw newError(404, 'Invitation not found', {
          errorCode: 'invitation_not_found',
        });
      }

      const { ticket } = await getOrCreateAuth0User(
        inviteeEmail,
        invitation.keyIndividuals.adminGivenName,
        invitation.keyIndividuals.adminFamilyName,
        req
      );

      await repos.invitations.update(invitation._id, {
        code,
        inviteeEmail,
        invitationUrl,
        expiresAt,
      });

      const messageCode = await sendEmailToInvitee(
        {
          inviteeEmail,
          inviterOrganization,
          ticket,
          code,
        },
        req
      );
      return {
        invitation: {
          ...invitation,
          code,
          expiresAt,
          invitationUrl,
          inviteeEmail,
        },
        messageCode,
      };
    }
  );

  fastify.delete(
    '/',
    {
      onRequest: fastify.verifyAccessToken([
        RegistrarScopes.WriteOrganizations,
        RegistrarScopes.AdminOrganizations,
      ]),
      preHandler: [verifyUserOrganizationWriteAuthorized],
      schema: fastify.autoSchema({
        security: [
          {
            RegistrarOAuth2: [
              RegistrarScopes.WriteOrganizations,
              RegistrarScopes.AdminOrganizations,
            ],
          },
        ],
        response: {
          204: { type: 'null' },
        },
      }),
    },
    async (req, rep) => {
      const {
        params: { did, invitationId },
        repos,
        user,
      } = req;
      await repos.organizations.findOneByDid(did, { _id: 1 });
      const deletedAt = new Date();
      const invitation = await repos.invitations.findOne({
        filter: {
          _id: invitationId,
          inviterDid: did,
        },
      });

      if (isEmpty(invitation)) {
        throw newError(404, 'Invitation not found', {
          errorCode: 'invitation_not_found',
        });
      }

      await repos.invitations.update(invitation._id, {
        deletedAt,
        deletedBy: user.sub,
      });
      return rep.status(204).send();
    }
  );
};

module.exports = invitationController;
