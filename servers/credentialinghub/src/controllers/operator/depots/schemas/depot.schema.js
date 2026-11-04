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
    deferredCredentialsResolvedAt: {
      type: 'string',
      format: 'date-time',
      description:
        "the last time the issuer resolved the depot's deferred credentials",
    },
    waitingExchangeId: {
      type: 'string',
      description: 'the VN API exchange waiting on the depot, if there is one',
    },
  },
};

module.exports = depotSchema;
