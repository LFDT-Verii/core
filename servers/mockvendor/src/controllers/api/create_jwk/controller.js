const { jwkResponse } = require('./schemas');
const { generateJwk } = require('../../../entities');

const controller = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        tags: ['jose'],
        body: {
          type: 'object',
          properties: {
            crv: {
              type: 'string',
              enum: ['secp256k1', 'P-256'],
            },
          },
          required: ['crv'],
        },
        response: {
          200: jwkResponse,
        },
      },
    },
    async (req) => {
      const { publicKey, id } = generateJwk(req?.body?.crv);
      return {
        jwk: publicKey,
        keyId: id,
      };
    }
  );
};

module.exports = controller;
