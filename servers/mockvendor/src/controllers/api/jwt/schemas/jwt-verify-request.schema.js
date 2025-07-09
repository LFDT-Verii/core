const jwtVerifyRequest = {
  title: 'jwt-verify-request',
  $id: 'https://velocitycareerlabs.io/jwt-verify-request.schema.json',
  description: 'jwt verify request schema',
  type: 'object',
  properties: {
    jwt: {
      type: 'string',
    },
    publicKey: {
      type: 'object',
    },
  },
  required: ['jwt'],
};

module.exports = { jwtVerifyRequest };
