const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const { VNF_GROUP_ID_CLAIM } = require('../../oauth');
const {
  findCredentialTypeMetadataBySchemaNameExtension,
} = require('./find-credential-type-metadata-by-schema-name-extension');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'credentialSchemas',
      entityName: 'credentialSchemas',
      defaultProjection: {
        _id: 1,
        title: 1,
        schemaName: 1,
        credentialType: 1,
        credentialGroup: 1,
        jsonldContext: 1,
        recommended: 1,
        linkedIn: 1,
        linkedinProfileCompatible: 1,
        issuerCategory: 1,
        layer1: 1,
        schemaUrl: 1,
        displayDescriptorUrls: 1,
        formSchemaUrls: 1,
        createdAt: 1,
        updatedAt: 1,
        createdBy: 1,
        updatedBy: 1,
        createdByGroup: 1,
      },
      extensions: [
        autoboxIdsExtension,
        findCredentialTypeMetadataBySchemaNameExtension,
        (parent, context) => ({
          prepModification: (val, kind) => {
            const { user } = context;
            const newValues = { ...val };
            if (user) {
              if (kind === 'insert') {
                newValues.createdByGroup = user[VNF_GROUP_ID_CLAIM];
                newValues.createdBy = user.sub;
              }
              newValues.updatedBy = user.sub;
            }
            return parent.prepModification(newValues, kind);
          },
        }),
      ],
    },
    app
  );
};
