const userBaseSchema = require('./base-user.schema.json');

const modifyUserSchema = {
  title: 'modify-user',
  $id: 'https://velocitycareerlabs.io/modify-user.schema.json',
  type: 'object',
  description: 'modify user schema',
  properties: {
    ...userBaseSchema.properties,
  },
  required: [...userBaseSchema.required, 'groupId'],
  additionalProperties: false,
};

module.exports = {
  modifyUserSchema,
};
