const { find, forEach, isEmpty } = require('lodash/fp');
const { addSeconds } = require('date-fns/fp');
const newError = require('http-errors');
const { nanoid } = require('nanoid/non-secure');
const { initTransformToFinder } = require('@verii/rest-queries');
const { tableRegistry } = require('@spencejs/spence-mongo-repos');
const {
  verifyUserOrganizationWriteAuthorized,
} = require('../../../../plugins/authorization');
const { initGetOrCreateAuth0User } = require('../../../../entities/users');
const {
  RegistrarScopes,
  initSendEmailInvitee,
  invitationResponseItemBodySchema,
  isCaoService,
  addInvitationBodySchema,
  buildInvitationUrl,
  validateInviteeEmail,
  validateInviteeService,
  buildReferenceCaoServices,
  extractCaoServiceRefs,
} = require('../../../../entities');
const { registeredCredentialTypesPreHandler } = require('../../plugins');

const invitationsController = async (fastify) => {
  const transformToFinder = initTransformToFinder(
    await tableRegistry.invitations(),
  );

  const getOrCreateAuth0User = await initGetOrCreateAuth0User(fastify);
  const sendEmailToInvitee = initSendEmailInvitee(fastify);

  fastify.post(
    '/',
    {
      onRequest: fastify.verifyAccessToken([
        RegistrarScopes.WriteOrganizations,
        RegistrarScopes.AdminOrganizations,
      ]),
      preHandler: [
        verifyUserOrganizationWriteAuthorized,
        registeredCredentialTypesPreHandler,
      ],
      schema: fastify.autoSchema({
        security: [
          {
            RegistrarOAuth2: [
              RegistrarScopes.WriteOrganizations,
              RegistrarScopes.AdminOrganizations,
            ],
          },
        ],
        body: addInvitationBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              invitation: invitationResponseItemBodySchema,
              messageCode: { type: 'string' },
            },
            required: ['invitation'],
          },
        },
      }),
    },
    async (req) => {
      const {
        params: { did },
        body,
        repos,
        config: { registrarInvitationTtl },
        user,
      } = req;
      const { inviteeEmail, inviteeService, inviteeProfile, keyIndividuals } =
        body;

      // validate inviter
      const inviterOrganization = await repos.organizations.findOneByDid(did);
      const caoService = find(isCaoService, inviterOrganization.services);
      if (isEmpty(caoService)) {
        throw newError(400, 'CAO service does not exist', {
          errorCode: 'invitations_not_supported',
        });
      }

      // validate invitation details
      validateInviteeEmail(inviteeEmail);

      const caoServiceRefs = await buildReferenceCaoServices({
        caoServiceIds: extractCaoServiceRefs(inviteeService),
        caoOrganizations: [inviterOrganization],
      });

      forEach(
        (service) => validateInviteeService(service, caoServiceRefs, req),
        inviteeService,
      );

      // create auth0 user
      const { ticket } = await getOrCreateAuth0User(
        inviteeEmail,
        keyIndividuals.adminGivenName,
        keyIndividuals.adminFamilyName,
        req,
      );

      // send invitation to user
      const code = nanoid(16);
      const expiresAt = addSeconds(registrarInvitationTtl, new Date());
      const invitation = await repos.invitations.insert({
        invitationUrl: buildInvitationUrl({ code }, req),
        inviterDid: did,
        inviteeEmail,
        inviteeService,
        inviteeProfile,
        keyIndividuals,
        code,
        expiresAt,
        createdBy: user.sub,
        updatedBy: user.sub,
      });

      const messageCode = await sendEmailToInvitee(
        {
          inviteeEmail,
          inviterOrganization,
          ticket,
          code,
        },
        req,
      );
      return {
        invitation,
        messageCode,
      };
    },
  );

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
        querystring: {
          $ref: 'https://velocitynetwork.foundation/schemas/page-query.schema.json#',
        },
        response: {
          200: {
            type: 'object',
            properties: {
              invitations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: invitationResponseItemBodySchema.properties,
                  required: invitationResponseItemBodySchema.required,
                },
              },
            },
            required: ['invitations'],
          },
        },
      }),
    },
    async (req) => {
      const {
        params: { did },
        query: { page, sort = [] },
        repos,
      } = req;
      await repos.organizations.findOneByDid(did, { _id: 1 });
      const filter = transformToFinder({
        filter: { inviterDid: did },
        page,
        sort,
      });
      const invitations = await repos.invitations.find(filter);
      return {
        invitations,
      };
    },
  );
};

module.exports = invitationsController;
