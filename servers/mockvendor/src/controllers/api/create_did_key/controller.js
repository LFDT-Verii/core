const { jwkDidResponse, jwkDidRequest } = require('./schemas');
const { generateJwk } = require('../../../entities');

const controller = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        tags: ['jose'],
        body: jwkDidRequest,
        response: {
          200: jwkDidResponse,
        },
      },
    },
    async (req) => {
      const { publicKey, id, did, kid } = generateJwk(req?.body?.crv);

      return {
        publicJwk: publicKey,
        keyId: id,
        kid,
        did,
      };
    }
  );
};

module.exports = controller;
