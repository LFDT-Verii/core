const rootRoutes = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        description: 'Healthcheck and version info',
        responses: {
          200: {
            description: 'Successful response',
            content: { 'text/plain': { schema: { type: 'string' } } },
          },
        },
        tags: ['healthchecks'],
      },
    },
    async (_res, reply) => {
      reply
        .status(200)
        .send(
          `Welcome to VelocityCore Registrar\nVersion: ${fastify.config.version}\n`
        );
    }
  );
};

// eslint-disable-next-line better-mutation/no-mutation
rootRoutes.prefixOverride = '';

module.exports = rootRoutes;
