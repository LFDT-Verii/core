const { mutableEntitySchema } = require('@verii/common-schemas');
const newTenantSchema = require('./new-tenant.schema.json');

const tenantSchema = {
  title: 'Tenant',
  $id: 'tenant',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...mutableEntitySchema.properties,
    ...newTenantSchema.properties,
    caoDid: {
      type: 'string',
    },
    description: {
      type: 'string',
    },
  },
  required: [...mutableEntitySchema.required, ...newTenantSchema.required],
  examples: [
    {
      id: '5fsdflkdsfsdfsfwwerr',
      did: 'did:ion:129031903190239123021312',
      name: 'ACME Limited',
      logo: 'http://example.com/logo.com',
      createdAt: '2019-08-24T14:15:22Z',
      updatedAt: '2019-08-24T14:15:22Z',
    },
  ],
};

module.exports = tenantSchema;
