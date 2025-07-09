module.exports = async (fastify) => {
  fastify.autoSchemaPreset({
    tags: ['healthchecks'],
    security: [{ BasicAuth: [] }],
  });
};
