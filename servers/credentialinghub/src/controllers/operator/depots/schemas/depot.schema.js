const { mutableEntitySchema } = require('@verii/common-schemas');
const newDepot = require('./new-depot.schema.json');

const depotSchema = {
  $id: 'depot',
  required: [
    ...mutableEntitySchema.required,
    ...newDepot.required,
    'serviceId',
  ],
  type: 'object',
  properties: {
    ...mutableEntitySchema.properties,
    ...newDepot.properties,
    serviceId: {
      type: 'string',
      description: 'the serviceId this depot is used for',
    },
    messagingSettings: {
      type: 'object',
      description: 'the wallet messaging settings',
      properties: {
        webhookUrl: {
          type: 'string',
        },
        authToken: {
          type: 'string',
        },
      },
    },
  },
};

module.exports = depotSchema;
