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
    preauthCodeExpiresAt: {
      type: 'string',
      format: 'date-time',
      description:
        "when the depot's current pre-authorized code expires. Absent when the code doesn't expire",
    },
  },
};

module.exports = depotSchema;
