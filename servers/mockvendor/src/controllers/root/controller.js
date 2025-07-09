const rootRoutes = async (fastify) => {
  fastify.get('/', async (req, reply) => {
    reply
      .status(200)
      .send(`Welcome to Mockvendor\nVersion: ${fastify.config.version}\n`);
  });
  fastify.post('/test-integration', async (req, reply) => {
    return reply.status(200).send({ messageReceived: req.body.message });
  });
};

// eslint-disable-next-line better-mutation/no-mutation
rootRoutes.prefixOverride = '';

module.exports = rootRoutes;
