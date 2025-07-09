const autohooks = async (fastify) => {
  fastify.autoSchemaPreset({
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
  });
};

module.exports = autohooks;
