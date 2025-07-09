const { groupSchema, modifyGroupSchema } = require('./schemas');

module.exports = async (fastify) => {
  fastify
    .addSchema(groupSchema)
    .addSchema(modifyGroupSchema)
    .autoSchemaPreset({
      tags: ['registrar_iam'],
    });
};
