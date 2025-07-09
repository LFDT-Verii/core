const { modifyUserSchema, userSchema } = require('./schemas');

module.exports = async (fastify) => {
  fastify
    .addSchema(modifyUserSchema)
    .addSchema(userSchema)
    .autoSchemaPreset({
      tags: ['registrar_iam'],
    });
};
