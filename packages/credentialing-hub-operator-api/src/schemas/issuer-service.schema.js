const { flow, omit, update, without } = require('lodash/fp');
const { mutableEntitySchema } = require('@verii/common-schemas');
const newIssuerConfigurationSchema = require('./new-issuer-service.schema');

const newAuthRulesSchema =
  newIssuerConfigurationSchema.properties.verifiablePresentationAuthRules;

// Rules saved before valueType existed don't have one, and are returned as
// they are. Only requests are checked against the anyOf that allows valueFormat
// on string rules alone.
const authRulesSchema = flow(
  update(['items', 'required'], without(['valueType'])),
  update(['items'], omit(['anyOf'])),
)(newAuthRulesSchema);

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
    verifiablePresentationAuthRules: authRulesSchema,
  },
  required: [
    ...mutableEntitySchema.required,
    ...newIssuerConfigurationSchema.required,
  ],
};

module.exports = issuerServiceSchema;
