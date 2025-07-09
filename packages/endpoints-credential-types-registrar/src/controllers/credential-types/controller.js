const newError = require('http-errors');
const { initHasMatchingScope } = require('@verii/auth');
const { isArray } = require('lodash/fp');
const {
  VNF_GROUP_ID_CLAIM,
  CredentialTypeScopes,
  validateCredentialTypeMetadata,
} = require('../../entities');

const credentialTypesController = async (fastify) => {
  fastify
    .post(
      '/',
      {
        onRequest: fastify.verifyAccessToken([
          CredentialTypeScopes.AdminCredentialTypes,
          CredentialTypeScopes.WriteCredentialTypes,
        ]),
        schema: fastify.autoSchema({
          security: [
            {
              RegistrarOAuth2: [
                CredentialTypeScopes.AdminCredentialTypes,
                CredentialTypeScopes.WriteCredentialTypes,
              ],
            },
          ],
          body: { $ref: 'new-credential-type#' },
          response: {
            201: { $ref: 'credential-type#' },
          },
        }),
      },
      async (req, reply) => {
        const { repos, body } = req;
        await validateCredentialTypeMetadata(body, req);
        const result = await repos.credentialSchemas.insert({ ...body });
        return reply.code(201).send(result);
      }
    )
    .get(
      '/',
      {
        schema: fastify.autoSchema({
          querystring: {
            type: 'object',
            properties: {
              credentialType: {
                type: ['string', 'array'],
                items: { type: 'string' },
              },
            },
          },
          response: {
            200: {
              type: 'array',
              items: { $ref: 'credential-type#' },
            },
          },
        }),
      },
      async ({ repos, query: { credentialType } }) => {
        const filter = {};

        if (isArray(credentialType)) {
          filter.credentialType = { $in: credentialType };
        } else if (credentialType != null) {
          filter.credentialType = credentialType;
        }

        return repos.credentialSchemas.find({
          filter,
        });
      }
    );

  fastify
    .autoSchemaPreset({
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'credential type id' },
        },
      },
    })
    .put(
      '/:id',
      {
        onRequest: fastify.verifyAccessToken([
          CredentialTypeScopes.AdminCredentialTypes,
          CredentialTypeScopes.WriteCredentialTypes,
        ]),
        schema: fastify.autoSchema({
          security: [
            {
              RegistrarOAuth2: [
                CredentialTypeScopes.AdminCredentialTypes,
                CredentialTypeScopes.WriteCredentialTypes,
              ],
            },
          ],
          body: { $ref: 'new-credential-type#' },
          response: {
            200: { $ref: 'credential-type#' },
          },
        }),
      },
      async (req, reply) => {
        const { repos, body } = req;
        await verifyGroupAndCredentialType(req);
        await validateCredentialTypeMetadata(body, req);
        const result = await repos.credentialSchemas.update(
          req.params.id,
          body
        );
        return reply.code(200).send(result);
      }
    )
    .get(
      '/:id',
      {
        schema: fastify.autoSchema({
          response: { 200: { $ref: 'credential-type#' } },
        }),
      },
      (req) => req.repos.credentialSchemas.findById(req.params.id)
    )
    .delete(
      '/:id',
      {
        onRequest: fastify.verifyAccessToken([
          CredentialTypeScopes.AdminCredentialTypes,
          CredentialTypeScopes.WriteCredentialTypes,
        ]),
        schema: fastify.autoSchema({
          security: [
            {
              RegistrarOAuth2: [
                CredentialTypeScopes.AdminCredentialTypes,
                CredentialTypeScopes.WriteCredentialTypes,
              ],
            },
          ],
          response: {
            204: { type: 'null' },
          },
        }),
      },
      async (req, reply) => {
        const { repos } = req;
        await verifyGroupAndCredentialType(req);
        await repos.credentialSchemas.del(req.params.id);
        reply.code(204);
      }
    );
};

const verifyGroupAndCredentialType = async (context) => {
  const {
    user,
    repos,
    params: { id },
  } = context;
  const credentialType = await repos.credentialSchemas.findById(id);

  if (!credentialType) {
    throw newError(404, 'Credential type not found', {
      errorCode: 'credential_type_not_found',
    });
  }

  if (hasAdminCredentialTypes(user)) {
    return;
  }

  if (credentialType.createdByGroup !== user[VNF_GROUP_ID_CLAIM]) {
    throw newError(403, 'You have no rights to modify credential type', {
      errorCode: 'forbidden',
    });
  }
};

const hasAdminCredentialTypes = initHasMatchingScope([
  CredentialTypeScopes.AdminCredentialTypes,
]);

module.exports = credentialTypesController;
