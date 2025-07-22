const {
  normalizeFormSchemaName,
} = require('@verii/common-functions');
const path = require('path');
const newError = require('http-errors');
const { isEmpty } = require('lodash/fp');
const {
  getLanguageCode,
  loadLocalizableFormSchemaFile,
} = require('../../../entities');
const { CachingConstants } = require('../../../helpers');

const formSchemasRoutes = async (fastify) => {
  fastify.get(
    '/*',
    {
      schema: fastify.autoSchema({
        description: 'Get Credential Type Form Schema',
        response: {
          200: {
            description: 'The form schema',
            type: 'object',
            additionalProperties: true,
          },
          404: { $ref: 'error#' },
        },
        tags: ['registrar_credential_types'],
      }),
    },
    async (req, reply) => {
      const { repos } = req;

      const name = normalizeFormSchemaName(path.basename(req.url));
      const credentialTypeMetadata = await repos.credentialSchemas.findOne({
        filter: {
          $or: [{ credentialType: name }, { schemaName: name }],
        },
      });

      if (isEmpty(credentialTypeMetadata?.formSchemaUrls)) {
        throw newError.NotFound('File not found');
      }

      const locale = getLanguageCode('form-schemas', req.url);
      const json = await loadLocalizableFormSchemaFile(
        {
          credentialType: credentialTypeMetadata,
          locale,
        },
        req
      );
      return reply
        .header(
          CachingConstants.CACHE_CONTROL_HEADER,
          CachingConstants.MAX_AGE_CACHE_CONTROL
        )
        .code(200)
        .type('application/json; charset=utf-8')
        .send(json, { override: true });
    }
  );
};

// eslint-disable-next-line better-mutation/no-mutation
formSchemasRoutes.prefixOverride = '/form-schemas';

module.exports = formSchemasRoutes;
