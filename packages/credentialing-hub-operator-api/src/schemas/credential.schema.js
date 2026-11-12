const { mutableEntitySchema } = require('@verii/common-schemas');
const newCredentialSchema = require('./new-credential.schema.json');

const credentialStatusSchema = {
  type: 'object',
  description: 'the issued credential status',
  properties: {
    id: {
      type: 'string',
    },
    statusListCredential: {
      type: 'string',
    },
    statusListIndex: {
      type: 'integer',
    },
    type: {
      type: 'string',
    },
  },
};

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
    did: {
      type: 'string',
      description: 'the issued credential id',
    },
    credentialSubjectId: {
      type: 'string',
      description: 'the issued credential subject id',
    },
    credentialStatus: {
      description: 'the issued credential status',
      anyOf: [
        credentialStatusSchema,
        {
          type: 'array',
          items: credentialStatusSchema,
        },
      ],
    },
    dataModelVersion: {
      type: 'string',
      enum: ['1.1', '2.0'],
      description: 'the W3C Verifiable Credentials data model version',
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
    envelopeFormat: {
      type: 'string',
      enum: ['jwt_vc_json-ld', 'vc+jwt'],
      description: 'the issued credential envelope format',
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
    revokedAt: {
      type: 'string',
      description: 'when the issued credential was revoked',
      format: 'date-time',
    },
    notifiedOfRevocationAt: {
      type: 'string',
      description: 'when the wallet was notified of revocation',
      format: 'date-time',
    },
    signingAlgorithm: {
      type: 'string',
      description: 'the JOSE algorithm used to sign the credential',
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
