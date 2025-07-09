const { flow, split, first } = require('lodash/fp');
const { default: bs58 } = require('bs58');
const newError = require('http-errors');

const { extractVerificationKey } = require('@verii/did-doc');
const { publicKeyHexToPem } = require('@verii/crypto');
const { jwkFromSecp256k1Key } = require('@verii/jwt');
const { resolveDid } = require('../resolve-did/resolve-did');
const publicKeyFormats = require('./public-key-formats');

const resolversController = async (fastify) => {
  const publicKeyEncoders = {
    [publicKeyFormats.PEM]: (publicKey) => publicKeyHexToPem(publicKey),
    [publicKeyFormats.BASE58]: (publicKey) =>
      bs58.encode(Buffer.from(publicKey, 'hex')),
    [publicKeyFormats.HEX]: (publicKey) => publicKey,
    [publicKeyFormats.JWK]: (publicKey) =>
      JSON.stringify(jwkFromSecp256k1Key(publicKey, false)),
  };

  fastify.get(
    '/:kid',
    {
      schema: fastify.autoSchema({
        tags: ['registrar_organizations'],
        params: {
          type: 'object',
          properties: {
            kid: {
              type: 'string',
            },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: [
                publicKeyFormats.PEM,
                publicKeyFormats.BASE58,
                publicKeyFormats.HEX,
                publicKeyFormats.JWK,
              ],
              default: publicKeyFormats.PEM,
            },
          },
        },
        response: {
          200: { type: 'string' },
          404: { type: 'string' },
        },
      }),
    },
    async (req) => {
      const {
        params: { kid },
        query: { format },
      } = req;
      const did = flow(split('#'), first)(kid);
      const didDoc = await resolveDid(did, req);

      const publicKey = extractVerificationKey(didDoc, kid);
      if (!publicKey) {
        throw newError.NotFound(`Public key was not found in document ${did}`, {
          kid,
          didDoc,
        });
      }

      return publicKeyEncoders[format](publicKey);
    }
  );
};

module.exports = resolversController;
