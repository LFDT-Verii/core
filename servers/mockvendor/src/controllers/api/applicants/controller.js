module.exports = async (fastify) => {
  fastify.get(
    '/',
    {
      onRequest: fastify.verifyAdmin,
    },
    async ({ repos }) => repos.applicants.find({ sort: { createdAt: -1 } })
  );
};
