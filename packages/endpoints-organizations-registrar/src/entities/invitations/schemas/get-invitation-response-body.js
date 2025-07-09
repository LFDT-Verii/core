const {
  invitationResponseItemBodySchema,
} = require('./invitation-response-item-body');

const getInvitationResponseBodySchema = {
  title: 'get-invitation-response-body',
  $id: 'https://velocitycareerlabs.io/get-invitation-response-body.json',
  type: 'object',
  description: 'payload for get invitation response from registrar',
  properties: {
    invitation: invitationResponseItemBodySchema,
    messageCode: {
      type: 'string',
      description: 'message code',
    },
  },
  required: ['invitation'],
};

module.exports = { getInvitationResponseBodySchema };
