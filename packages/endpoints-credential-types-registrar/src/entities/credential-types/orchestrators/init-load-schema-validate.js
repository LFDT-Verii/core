const { fetchJson } = require('@verii/common-fetchers');

const initLoadSchemaValidate = (fastify) => async (schemaName, context) => {
  const { repos } = context;
  const uriSchemaName = `https://velocitynetwork.foundation/schemas/${schemaName}`;
  if (
    !fastify.hasDocSchema(uriSchemaName) &&
    !fastify.hasDocSchema(schemaName)
  ) {
    const { schemaUrl } =
      await repos.credentialSchemas.findCredentialTypeMetadataBySchemaName(
        schemaName,
      );
    const jsonSchema = await fetchJson(schemaUrl, context);
    fastify.addDocSchema(jsonSchema);
  }
  const funcFromSchemaName = fastify.getDocValidator(schemaName);
  if (funcFromSchemaName) {
    return funcFromSchemaName;
  }
  return fastify.getDocValidator(uriSchemaName);
};

module.exports = { initLoadSchemaValidate };
