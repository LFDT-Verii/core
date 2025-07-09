const newError = require('http-errors');
const { CachingConstants } = require('../../helpers');
const {
  CredentialTypeErrorMessages,
  loadLocalizableDisplayDescriptorFile,
} = require('../../entities');
const { credentialTypeDescriptorsSchema } = require('./schemas');

const credentialTypeDescriptorController = async (fastify) => {
  fastify.get(
    '/:credentialType',
    {
      schema: fastify.autoSchema({
        tags: ['registrar_credential_types'],
        params: {
          type: 'object',
          properties: {
            credentialType: {
              type: 'string',
            },
          },
          required: ['credentialType'],
        },
        query: {
          type: 'object',
          properties: {
            locale: {
              type: 'string',
              default: 'en',
            },
            includeDisplay: {
              type: 'boolean',
              default: false,
            },
          },
        },
        response: {
          200: credentialTypeDescriptorsSchema,
        },
      }),
    },
    async (req, reply) => {
      const {
        repos,
        params: { credentialType },
        query: { includeDisplay, locale },
      } = req;
      const credentialTypeMetadata = await repos.credentialSchemas.findOne({
        filter: { credentialType },
      });
      if (credentialTypeMetadata == null) {
        throw newError.NotFound(
          CredentialTypeErrorMessages.CREDENTIAL_TYPE_NOT_FOUND_TEMPLATE(
            credentialType
          )
        );
      }

      const response = {
        id: credentialType,
        name: credentialTypeMetadata.title,
        schema: [
          {
            uri: credentialTypeMetadata.schemaUrl,
          },
        ],
      };

      if (includeDisplay) {
        response.display = await loadLocalizableDisplayDescriptorFile(
          {
            credentialType: credentialTypeMetadata,
            locale,
          },
          req
        );
      }

      return reply
        .header(
          CachingConstants.CACHE_CONTROL_HEADER,
          CachingConstants.MAX_AGE_CACHE_CONTROL
        )
        .send(response);
    }
  );
};

module.exports = credentialTypeDescriptorController;
