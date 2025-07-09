const jwkDidRequest = {
  title: 'jwk-did-request',
  $id: 'https://velocitycareerlabs.io/jwk-did-request.schema.json',
  description: 'jwk did request schema',
  type: 'object',
  properties: {
    crv: {
      type: 'string',
      enum: ['secp256k1', 'P-256'],
    },
    didMethod: {
      type: 'string',
      enum: ['did:jwk'],
      default: 'did:jwk',
    },
  },
  required: ['crv'],
};

module.exports = { jwkDidRequest };
