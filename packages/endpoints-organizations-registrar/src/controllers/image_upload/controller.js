const { RegistrarScopes, imageMetadataSchema } = require('../../entities');

const imageUploadController = async (fastify) => {
  fastify.get(
    '/:url',
    {
      onRequest: fastify.verifyAccessToken([
        RegistrarScopes.AdminOrganizations,
        RegistrarScopes.WriteOrganizations,
      ]),
      schema: fastify.autoSchema({
        security: [
          {
            RegistrarOAuth2: [
              RegistrarScopes.WriteOrganizations,
              RegistrarScopes.AdminOrganizations,
            ],
          },
        ],
        params: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
            },
          },
          required: ['url'],
        },
        response: {
          200: imageMetadataSchema,
        },
      }),
    },
    async (req) => {
      const {
        repos,
        user,
        params: { url },
      } = req;
      const imageMetadata = await repos.images.findByUrl(url, user.sub);
      return {
        imageMetadata,
      };
    }
  );
};

module.exports = imageUploadController;
