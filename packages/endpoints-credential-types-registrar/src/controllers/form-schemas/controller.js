const { isEmpty } = require('lodash/fp');
const newError = require('http-errors');
const { loadLocalizableFormSchemaFile } = require('../../entities');

const сontroller = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
        tags: ['registrar_credential_types'],
        query: {
          type: 'object',
          properties: {
            credentialType: { type: 'string' },
            locale: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: true,
          },
          404: { $ref: 'error#' },
        },
      }),
    },
    async (req, reply) => {
      const {
        query: { credentialType, locale },
        repos,
      } = req;
      const credentialTypeMetadata = await repos.credentialSchemas.findOne({
        filter: { credentialType },
      });
      const json = await loadLocalizableFormSchemaFile(
        {
          credentialType: credentialTypeMetadata,
          locale,
        },
        req
      );
      if (isEmpty(json)) {
        throw newError(404, 'Form schemas not found', {
          errorCode: 'form_schemas_not_found',
        });
      }
      return reply.type('application/json; charset=utf-8').send(json);
    }
  );
};

module.exports = сontroller;
