const CredentialSchema = require('./Credential.schema');

const VerifiableCredentialSchema = {
  $id: 'https://velocitynetwork.foundation/vc-api/VerifiableCredential.schema.json',
  type: 'object',
  description: 'A JSON-LD Verifiable Credential with a proof.',
  properties: {
    ...CredentialSchema.properties,
    proof: {
      $ref: 'https://velocitynetwork.foundation/vc-api/LinkedDataProof.schema.json#',
    },
  },
  required: [...CredentialSchema.required],
};

module.exports = VerifiableCredentialSchema;
