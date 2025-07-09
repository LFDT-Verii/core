module.exports = async (fastify) => {
  fastify.autoSchemaPreset({
    params: {
      type: 'object',
      properties: { id: { type: 'string', minLength: 1 } },
      required: ['id'],
    },
  });
};
