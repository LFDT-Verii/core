const { readFile } = require('fs/promises');
const path = require('path');
const env = require('env-var');
const {
  CredentialGroup,
} = require('@verii/endpoints-credential-types-registrar/src/entities');
const {
  ServiceCategories,
  // eslint-disable-next-line import/no-extraneous-dependencies
} = require('@verii/organizations-registry');

const libUrl = env.get('LIB_URL').required().asString();
const v11jsonld = `${libUrl}/contexts/layer1-v1.1.jsonld.json`;
const v10jsonld = `${libUrl}/contexts/layer1-v1.0.jsonld.json`;

const loadJsonFile = async (schemaName) => {
  const relativePath = `schemas/${schemaName}.schema.json`;
  const str = await readFile(
    path.join(__dirname, `../../../samples/sample-lib-app/${relativePath}`),
    { encoding: 'utf-8' },
  );

  return JSON.parse(str);
};

module.exports = {
  up: async (db) => {
    const newCredentialSchemas = [
      {
        schemaName: 'education-degree-graduation-v1.1', // kebab cased schema
        credentialType: 'EducationDegreeGraduationV1.1', // camelCased schema
        jsonldContext: v11jsonld,
        credentialGroup: CredentialGroup.Career,
        issuerCategory: 'RegularIssuer',
      },
      {
        schemaName: 'open-badge-credential', // kebab cased schema
        credentialType: 'OpenBadgeCredential', // camelCased schema
        jsonldContext:
          'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
        credentialGroup: CredentialGroup.Career,
        issuerCategory: 'RegularIssuer',
      },
      {
        schemaName: 'employment-current-v1.1', // kebab cased schema
        credentialType: 'EmploymentCurrentV1.1', // camelCased schema
        jsonldContext: v11jsonld,
        credentialGroup: CredentialGroup.Career,
        issuerCategory: 'RegularIssuer',
      },
      {
        schemaName: 'email-v1.0', // kebab cased schema
        credentialType: 'EmailV1.0', // camelCased schema
        jsonldContext: v10jsonld,
        credentialGroup: CredentialGroup.Contact,
        issuerCategory: ServiceCategories.ContactIssuer,
      },
    ];
    const insertions = await Promise.all(
      newCredentialSchemas.map(async (entry) => {
        const schemaJson = await loadJsonFile(entry.schemaName);
        return {
          ...entry,
          recommended: true,
          title:
            schemaJson.title ?? schemaJson.description ?? entry.credentialType,
          schemaUrl: `${libUrl}/schemas/${entry.schemaName}.json`,
          displayDescriptorUrls: {
            en: `${libUrl}/display-descriptors/en/${entry.schemaName}.descriptor.json`,
          },
          formSchemaUrls: {
            en: `${libUrl}/form-schemas/en/${entry.credentialType}.form-schema.json`,
          },
          layer1: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
    );
    await db.collection('credentialSchemas').insertMany(insertions);
  },
  down: async () => {},
};
