const { omit } = require('lodash/fp');
const newAgentDisclosureSchema = require('./new-agent-disclosure.schema.json');

const updateAgentDisclosureSchema = {
  ...newAgentDisclosureSchema,
  $id: 'https://velocitycareerlabs.io/update-agent-disclosure.schema.json',
  title: 'update-agent-disclosure',
  description: 'Slightly modified from new-agent-disclosure',
  properties: {
    ...omit(['feed'], newAgentDisclosureSchema.properties),
    setIssuingDefault: {
      type: 'boolean',
    },
  },
  additionalProperties: false,
};

module.exports = {
  updateAgentDisclosureSchema,
};
