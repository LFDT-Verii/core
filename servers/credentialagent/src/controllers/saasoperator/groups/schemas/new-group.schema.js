module.exports = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://velocitycareerlabs.io/new-group.schema.json',
  title: 'new-group',
  description: 'An new group',
  type: 'object',
  additionalProperties: false,
  properties: {
    slug: { type: 'string', minLength: 1, pattern: '^[a-z0-9_-]*' },
    did: { type: 'string', minLength: 1 },
  },
  required: ['slug', 'did'],
};
