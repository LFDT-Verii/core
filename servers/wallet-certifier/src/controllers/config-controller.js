module.exports = async (fastify, { config, db }) => {
  fastify.get(
    '/config',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['brandName', 'registrationUrl', 'environmentName'],
            properties: {
              brandName: { type: 'string' },
              logoUrl: { type: 'string' },
              registrationUrl: { type: 'string' },
              environmentName: { type: 'string' },
            },
          },
        },
      },
    },
    async () => ({
      brandName: config.brandName,
      ...(config.logoUrl ? { logoUrl: config.logoUrl } : {}),
      registrationUrl: config.registrationUrl,
      environmentName: config.environmentName,
    }),
  );

  fastify.get(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['status'],
            properties: { status: { type: 'string', const: 'ok' } },
          },
        },
      },
    },
    async () => {
      await db.command({ ping: 1 });
      return { status: 'ok' };
    },
  );
};
