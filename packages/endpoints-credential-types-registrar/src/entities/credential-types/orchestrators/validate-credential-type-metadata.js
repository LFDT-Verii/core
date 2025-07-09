const { fetchJson } = require('@verii/common-fetchers');
const { map, values } = require('lodash/fp');
const newError = require('http-errors');

const validateCredentialTypeMetadata = async (credentialType, context) => {
  try {
    const { schemaUrl, displayDescriptorUrls, formSchemaUrls } = credentialType;
    await Promise.all([
      fetchJson(schemaUrl, context),
      ...map((link) => fetchJson(link, context), values(displayDescriptorUrls)),
      ...map((link) => fetchJson(link, context), values(formSchemaUrls)),
    ]);
  } catch (e) {
    context.log.error(e, 'invalid credential type link', credentialType);
    throw newError(400, 'Invalid credential type link', {
      errorCode: 'invalid-credential-type-link',
    });
  }
};

module.exports = {
  validateCredentialTypeMetadata,
};
