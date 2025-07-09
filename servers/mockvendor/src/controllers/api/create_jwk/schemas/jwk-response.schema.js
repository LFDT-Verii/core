const jwkResponse = {
  title: 'jwk-response',
  $id: 'https://velocitycareerlabs.io/jwk-response.schema.json',
  description: 'jwk response schema',
  type: 'object',
  properties: {
    jwk: {
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
    keyId: { type: 'string' },
  },
  required: ['jwk', 'keyId'],
};

module.exports = { jwkResponse };
