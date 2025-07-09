const { addInvitationBodySchema } = require('./add-invitation-body');

const invitationResponseItemBodySchema = {
  $id: 'https://velocitycareerlabs.io/invitation-response-item-body.json',
  title: 'invitation-response-item-body',
  type: 'object',
  description: 'payload for invitation response item from registrar',
  properties: {
    id: {
      type: 'string',
    },
    ...addInvitationBodySchema.properties,
    code: {
      type: 'string',
    },
    inviterDid: {
      type: 'string',
    },
    invitationUrl: {
      type: 'string',
      format: 'uri',
    },
    expiresAt: {
      type: 'string',
      format: 'date-time',
    },
    acceptedAt: {
      type: 'string',
      format: 'date-time',
    },
    acceptedBy: {
      type: 'string',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    createdBy: {
      type: 'string',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedBy: {
      type: 'string',
    },
  },
  required: [
    'id',
    ...addInvitationBodySchema.required,
    'code',
    'invitationUrl',
    'expiresAt',
    'createdAt',
    'createdBy',
    'updatedAt',
  ],
};

module.exports = { invitationResponseItemBodySchema };
