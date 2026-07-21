const walletSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'organizationId',
    'name',
    'organizationName',
    'protocols',
    'eligible',
  ],
  properties: {
    id: { type: 'string' },
    organizationId: { type: 'string' },
    name: { type: 'string' },
    organizationName: { type: 'string' },
    logoUrl: { type: 'string' },
    protocols: { type: 'array', items: { type: 'string' } },
    eligible: { type: 'boolean' },
    disabledReason: { type: 'string' },
    appleAppStoreUrl: { type: 'string' },
    playStoreUrl: { type: 'string' },
  },
};

module.exports = async (fastify, { registrarClient }) => {
  fastify.get(
    '/wallets',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 2, maxLength: 80 },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['wallets'],
            properties: {
              wallets: { type: 'array', items: walletSchema },
            },
          },
        },
      },
    },
    async (request) => ({
      wallets: await registrarClient.searchWallets(request.query.q.trim()),
    }),
  );
};
