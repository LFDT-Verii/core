const jwkDidResponse = {
  title: 'jwk-did-response',
  $id: 'https://velocitycareerlabs.io/jwk-did-response.schema.json',
  description: 'jwk did response schema',
  type: 'object',
  properties: {
    did: {
      type: 'string',
    },
    kid: {
      type: 'string',
    },
    keyId: {
      type: 'string',
    },
    publicJwk: {
      type: 'object',
      required: ['kty'],
      properties: {
        kty: { type: 'string' },
        use: { type: 'string' },
        key_ops: { type: 'string' },
        x5u: { type: 'string' },
        x5c: { type: 'string' },
        x5t: { type: 'string' },
        'x5t#S256': { type: 'string' },
        alg: { type: 'string' },
        kid: { type: 'string' },
        exp: { type: 'string' },
        crv: { type: 'string' },
        y: { type: 'string' },
        x: { type: 'string' },
        n: { type: 'string' },
        e: { type: 'string' },
      },
    },
  },
  required: ['did', 'publicJwk'],
};

module.exports = { jwkDidResponse };
