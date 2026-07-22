module.exports = async (fastify, { config, repositories }) => {
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
    '/',
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
      await repositories.ping();
      return { status: 'ok' };
    },
  );
};
