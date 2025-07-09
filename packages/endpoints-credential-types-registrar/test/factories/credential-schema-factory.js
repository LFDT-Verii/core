const { register } = require('@spencejs/spence-factories');
const { endsWith, kebabCase, startCase } = require('lodash/fp');
const { CredentialGroup } = require('../../src/entities');
const initCredentialSchemasRepo = require('../../src/entities/credential-types/repos/repo');

const trimVersion = (credentialType) => {
  const match = /(^.*)V\d\.\d$/.exec(credentialType);
  if (match == null) {
    return credentialType;
  }

  return match[1];
};

module.exports = (app) =>
  register(
    'credentialSchema',
    initCredentialSchemasRepo(app)({ config: app.config }),
    async (overrides, { getOrBuild }) => {
      const credentialType = await getOrBuild(
        'credentialType',
        () => 'EducationDegreeGraduationV1.0'
      );

      const schemaName = endsWith('V1.0', credentialType)
        ? `${kebabCase(credentialType.slice(0, -4))}-v1.0`
        : kebabCase(credentialType);

      return {
        schemaName,
        title: startCase(trimVersion(credentialType)),
        credentialType,
        credentialGroup: CredentialGroup.Career,
        recommended: true,
        issuerCategory: 'RegularIssuer',
        jsonldContext: [
          'https://lib.velocitynetwork.foundation/layer1-v1.1.jsonld.json',
        ],
        layer1: true,
        schemaUrl: 'https://example.com/schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/schema.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/schema.json',
        },
        ...overrides(),
      };
    }
  );
