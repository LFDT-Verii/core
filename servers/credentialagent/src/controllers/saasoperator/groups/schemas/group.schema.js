module.exports = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://velocitycareerlabs.io/group.schema.json',
  title: 'group',
  description: 'An group',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    did: { type: 'string' },
    slug: { type: 'string' },
    dids: { type: 'array', items: { type: 'string' } },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'slug'],
};
