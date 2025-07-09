module.exports = async (fastify) => {
  fastify.autoSchemaPreset({
    tags: ['registrar_iam'],
    security: [{ RegistrarOAuth2: [] }],
  });
};
