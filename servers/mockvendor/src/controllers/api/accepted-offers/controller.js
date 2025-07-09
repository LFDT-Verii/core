module.exports = async (fastify) => {
  fastify.get(
    '/',
    {
      onRequest: fastify.verifyAdmin,
    },
    async ({ repos }) => repos.acceptedOffers.find({ sort: { createdAt: -1 } })
  );
};
