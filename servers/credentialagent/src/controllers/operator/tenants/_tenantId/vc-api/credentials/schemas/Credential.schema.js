const { w3cVcSchema } = require('@verii/common-schemas');

const CredentialSchema = {
  $id: 'https://velocitynetwork.foundation/vc-api/Credential.schema.json',
  type: 'object',
  description: 'A JSON-LD Verifiable Credential without a proof.',
  additionalProperties: false,
  properties: {
    ...w3cVcSchema.properties,
    id: {
      type: 'string',
      description: 'The ID of the credential.',
    },
  },
  required: ['@context', ...w3cVcSchema.required],
};

module.exports = CredentialSchema;
