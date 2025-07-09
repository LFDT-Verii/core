const { mutableEntitySchema } = require('@verii/common-schemas');
const newAgentDisclosureSchema = require('./new-agent-disclosure.schema.json');

const agentDisclosureSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://velocitycareerlabs.io/agent-disclosure-v0.8.schema.json',
  title: 'agent-disclosure',
  description:
    // eslint-disable-next-line max-len
    'The disclosure request made by an inspector on the velocity network. It describes credential types wanted and (in the future) predicate information as well as terms and conditions for usage of the data',
  properties: {
    ...mutableEntitySchema.properties,
    ...newAgentDisclosureSchema.properties,
    tenantId: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['id', 'vendorEndpoint', 'createdAt', 'updatedAt'],
};

module.exports = {
  agentDisclosureSchema,
};
