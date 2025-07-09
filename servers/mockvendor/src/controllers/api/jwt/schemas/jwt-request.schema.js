const jwtRequest = {
  title: 'jwt-request',
  $id: 'https://velocitycareerlabs.io/jwt-request.schema.json',
  description: 'jwt request schema',
  type: 'object',
  properties: {
    header: {
      type: 'object',
    },
    payload: {
      type: 'object',
    },
    options: {
      type: 'object',
      oneOf: [
        {
          required: ['kid'],
          properties: {
            kid: {
              type: 'string',
              minLength: 1,
            },
          },
        },
        {
          required: ['keyId'],
          properties: {
            keyId: {
              type: 'string',
              minLength: 1,
            },
          },
        },
      ],
    },
  },
  required: ['payload', 'options'],
};

module.exports = { jwtRequest };
