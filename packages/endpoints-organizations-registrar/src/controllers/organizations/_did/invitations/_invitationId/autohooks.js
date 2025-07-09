const autohooks = async (fastify) => {
  fastify.autoSchemaPreset({
    params: {
      type: 'object',
      properties: {
        ...fastify.currentAutoSchemaPreset.params.properties,
        invitationId: {
          type: 'string',
          description: 'the invitation id',
        },
      },
    },
  });
};

module.exports = autohooks;
