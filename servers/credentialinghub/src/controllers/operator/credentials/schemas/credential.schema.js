const { mutableEntitySchema } = require('@verii/common-schemas');
const newCredentialSchema = require('./new-credential.schema.json');

const credentialSchema = {
  $id: 'Credential',
  type: 'object',
  properties: {
    ...mutableEntitySchema.properties,
    ...newCredentialSchema.properties,
    depotId: {
      type: 'string',
      description: 'the depot that contains this credential',
    },
    contentHash: {
      type: 'string',
      description: 'the credential content hash',
    },
    acceptedAt: {
      type: 'string',
      description: 'when the credential was accepted',
      format: 'date-time',
    },
    jwtVc: {
      type: 'string',
      description: 'the issued credential',
    },
    rejectedAt: {
      type: 'string',
      description: 'when the credential was rejected',
      format: 'date-time',
    },
    rejectedReason: {
      type: 'string',
      description: 'an optional reason that was captured during rejection',
    },
  },
  required: [
    ...mutableEntitySchema.required,
    ...newCredentialSchema.required,
    'depotId',
    'contentHash',
  ],
  $defs: newCredentialSchema.$defs,
};

module.exports = credentialSchema;
