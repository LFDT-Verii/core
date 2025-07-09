const { jwtSign, jwtVerify, deriveJwk } = require('@verii/jwt');
const {
  jwtRequest,
  jwtResponse,
  jwtVerifyRequest,
  jwtVerifyResponse,
} = require('./schemas');
const { getKeyPair } = require('../../../entities');

const controller = async (fastify) => {
  fastify.post(
    '/sign',
    {
      schema: {
        tags: ['jose'],
        body: jwtRequest,
        response: {
          200: jwtResponse,
        },
      },
    },
    async (req) => {
      const { body } = req;
      const { header, payload, options } = body;

      const keyPair = getKeyPair(options);

      const compactJwt = await jwtSign(payload, keyPair.privateKey, {
        ...header,
        alg: keyPair.alg,
        jwk: keyPair.publicKey,
      });
      return {
        compactJwt,
      };
    }
  );

  fastify.post(
    '/verify',
    {
      schema: {
        tags: ['jose'],
        body: jwtVerifyRequest,
        response: {
          200: jwtVerifyResponse,
        },
      },
    },
    async (req) => {
      const { body } = req;
      const { jwt, publicKey } = body;
      try {
        const jwk = deriveJwk(jwt, publicKey);
        await jwtVerify(jwt, jwk);
        return {
          verified: true,
        };
      } catch (e) {
        return {
          verified: false,
          error: e,
        };
      }
    }
  );
};

module.exports = controller;
