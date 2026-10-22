const { flow, split, first } = require('lodash/fp');
const { default: bs58 } = require('bs58');
const newError = require('http-errors');

const { extractVerificationJwk } = require('@verii/did-doc');
const { hexFromJwk, jwkFromSecp256k1Key } = require('@verii/crypto');
const { resolveDid } = require('../resolve-did/resolve-did');
const publicKeyFormats = require('./public-key-formats');

const resolversController = async (fastify) => {
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
                publicKeyFormats.BASE58,
                publicKeyFormats.HEX,
                publicKeyFormats.JWK,
              ],
              default: publicKeyFormats.HEX,
            },
          },
        },
        response: {
          200: { type: 'string' },
          ...fastify.BadRequestResponse,
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

      const publicJwk = extractVerificationJwk(didDoc, kid);
      if (!publicJwk) {
        throw newError.NotFound(`Public key was not found in document ${did}`, {
          kid,
          didDoc,
        });
      }

      return publicKeyEncoders[format](publicJwk);
    },
  );
};

const publicKeyEncoders = {
  [publicKeyFormats.BASE58]: (publicJwk) =>
    bs58.encode(
      Buffer.from(toSecp256k1Hex(publicJwk, publicKeyFormats.BASE58), 'hex'),
    ),
  [publicKeyFormats.HEX]: (publicJwk) =>
    toSecp256k1Hex(publicJwk, publicKeyFormats.HEX),
  [publicKeyFormats.JWK]: (publicJwk) =>
    JSON.stringify(
      isSecp256k1Jwk(publicJwk)
        ? jwkFromSecp256k1Key(hexFromJwk(publicJwk, false), false)
        : publicJwk,
    ),
};

const toSecp256k1Hex = (publicJwk, format) => {
  if (!isSecp256k1Jwk(publicJwk)) {
    throw newError(
      400,
      `Public key format ${format} is only supported for secp256k1 keys. Use format ${publicKeyFormats.JWK}`,
      { errorCode: 'public_key_format_not_supported' },
    );
  }
  return hexFromJwk(publicJwk, false);
};

const isSecp256k1Jwk = ({ kty, crv }) => kty === 'EC' && crv === 'secp256k1';

module.exports = resolversController;
