const { mutableEntitySchema } = require('@verii/common-schemas');
const newIssuerConfigurationSchema = require('./new-issuer-service.schema');

const issuerServiceSchema = {
  title: 'issuer-service',
  $id: 'issuer-service',
  description: 'The issuer service',
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
    ...newIssuerConfigurationSchema.properties,
  },
  required: [
    ...mutableEntitySchema.required,
    ...newIssuerConfigurationSchema.required,
  ],
};

module.exports = issuerServiceSchema;
