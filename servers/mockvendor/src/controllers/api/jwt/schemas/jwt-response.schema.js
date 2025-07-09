const jwtResponse = {
  title: 'jwt-response',
  $id: 'https://velocitycareerlabs.io/jwt-response.schema.json',
  description: 'jwt response schema',
  type: 'object',
  properties: {
    compactJwt: {
      type: 'string',
    },
  },
  required: ['compactJwt'],
};

module.exports = { jwtResponse };
