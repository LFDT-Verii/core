const { normalizeDisplayDescriptorName } = require('@verii/common-functions');
const path = require('path');
const newError = require('http-errors');
const { isEmpty } = require('lodash/fp');
const {
  getLanguageCode,
  loadLocalizableDisplayDescriptorFile,
} = require('../../../entities');
const { CachingConstants } = require('../../../helpers');

const displayDescriptorsRoutes = async (fastify) => {
  fastify.get(
    '/*',
    {
      schema: fastify.autoSchema({
        description: 'Get Credential Type Display Descriptor',
        response: {
          200: {
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
      const schemaName = normalizeDisplayDescriptorName(path.basename(req.url));
      const credentialTypeMetadata = await repos.credentialSchemas.findOne({
        filter: { schemaName },
      });

      if (isEmpty(credentialTypeMetadata?.displayDescriptorUrls)) {
        throw newError.NotFound('File not found');
      }

      const locale = getLanguageCode('display-descriptors', req.url);
      const json = await loadLocalizableDisplayDescriptorFile(
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
displayDescriptorsRoutes.prefixOverride = '/display-descriptors';

module.exports = displayDescriptorsRoutes;
