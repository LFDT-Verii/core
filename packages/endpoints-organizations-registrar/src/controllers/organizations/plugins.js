const { map } = require('lodash/fp');

const loadCredentialTypes = async (req) => {
  const allCredentialSchemas = await req.repos.credentialSchemas.find(
    { filter: {} },
    { credentialType: 1, _id: 0 }
  );
  return map('credentialType', allCredentialSchemas);
};

const registeredCredentialTypesPreHandler = async (req) => {
  // eslint-disable-next-line better-mutation/no-mutation
  req.registeredCredentialTypes = await loadCredentialTypes(req);
};

const CredentialTypesPlugin = (fastify, options, next) => {
  fastify.decorateRequest('registeredCredentialTypes', null);
  next();
};

module.exports = { CredentialTypesPlugin, registeredCredentialTypesPreHandler };
