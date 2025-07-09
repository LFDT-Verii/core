const userBaseSchema = require('./base-user.schema.json');

const userSchema = {
  title: 'user',
  $id: 'https://velocitycareerlabs.io/user.schema.json',
  type: 'object',
  description: 'user schema',
  properties: {
    ...userBaseSchema.properties,
    id: {
      type: 'string',
    },
  },
  required: [...userBaseSchema.required, 'id'],
  additionalProperties: false,
};

module.exports = {
  userSchema,
};
