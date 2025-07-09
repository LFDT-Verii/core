const { first } = require('lodash/fp');
const { fetchJson } = require('@verii/common-fetchers');
const { getLanguageUrls } = require('../domains/get-language-urls');

const loadLocalizableCredentialFile =
  (field) =>
  async ({ credentialType, locale }, context) => {
    const { log } = context;
    try {
      const url = getLanguageUrls({
        locale,
        urls: credentialType[field],
      });
      const json = await fetchJson(first(url), context);
      return json;
    } catch (error) {
      log.warn({ err: error }, `ignoring missing ${field}`);
      return undefined;
    }
  };

module.exports = {
  loadLocalizableFormSchemaFile:
    loadLocalizableCredentialFile('formSchemaUrls'),
  loadLocalizableDisplayDescriptorFile: loadLocalizableCredentialFile(
    'displayDescriptorUrls'
  ),
};
