const { mutableEntitySchema } = require('@verii/common-schemas');
const newRelyingPartyConfigurationSchema = require('./new-relying-party-service.schema');

const relyingPartyServiceSchema = {
  title: 'relying-party-service',
  $id: 'relying-party-service',
  description: 'The relying-party service',
  type: 'object',
  additionalProperties: false,
  properties: {
    genericRedirectUrl: {
      type: 'string',
      format: 'uri',
      description:
        'only returned if authMethod include `verifiable_presentation`',
    },
    ...mutableEntitySchema.properties,
    ...newRelyingPartyConfigurationSchema.properties,
  },
  required: [
    ...mutableEntitySchema.required,
    ...newRelyingPartyConfigurationSchema.required,
  ],
};

module.exports = relyingPartyServiceSchema;
