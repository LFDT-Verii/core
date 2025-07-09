const jwtVerifyResponse = {
  title: 'jwt-verify-response',
  $id: 'https://velocitycareerlabs.io/jwt-verify-response.schema.json',
  description: 'jwt verify response schema',
  type: 'object',
  properties: {
    verified: {
      type: 'boolean',
    },
    error: {
      type: 'string',
    },
  },
  required: ['verified'],
};

module.exports = { jwtVerifyResponse };
