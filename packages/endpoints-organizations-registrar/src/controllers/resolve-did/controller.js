const {
  didServiceSchema,
  modifyDidServiceSchema,
} = require('@verii/common-schemas');
const { resolveDid } = require('./resolve-did');
const { didDocSchema, didProofSchema, publicKeySchema } = require('./schemas');

const resolveDidController = async (fastify) => {
  fastify
    .addSchema(modifyDidServiceSchema)
    .addSchema(didServiceSchema)
    .addSchema(publicKeySchema)
    .addSchema(didProofSchema)
    .addSchema(didDocSchema);

  fastify.get(
    '/:did',
    {
      schema: fastify.autoSchema({
        tags: ['registrar_organizations'],
        params: {
          type: 'object',
          properties: {
            did: {
              type: 'string',
              description: 'the did document',
              pattern: '^did:[a-z0-9]+:[A-Za-z0-9._:?=&%;-]+$',
            },
          },
        },
        response: {
          200: { $ref: 'did-doc#' },
        },
      }),
    },
    async (req) => {
      const {
        params: { did },
      } = req;
      return resolveDid(did, req);
    }
  );
};

module.exports = resolveDidController;
