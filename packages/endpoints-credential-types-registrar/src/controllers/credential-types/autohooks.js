const { newCredentialTypeSchema, credentialTypeSchema } = require('./schemas');

module.exports = async (fastify) => {
  fastify
    .addSchema(newCredentialTypeSchema)
    .addSchema(credentialTypeSchema)
    .autoSchemaPreset({
      tags: ['registrar_credential_types'],
    });
};
