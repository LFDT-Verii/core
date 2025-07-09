const createError = require('http-errors');
const { isEmpty, map } = require('lodash/fp');
const { getClosest } = require('../domains');

const findCredentialTypeMetadataBySchemaNameExtension = (parent) => ({
  findCredentialTypeMetadataBySchemaName: async (schemaName) => {
    const credentialType = await parent.findOne({
      filter: { schemaName },
    });

    if (isEmpty(credentialType)) {
      const credSchemasList = await parent.find({
        filter: {},
      });
      const schemaNameList = map((item) => item.schemaName, credSchemasList);

      const closestSchemaName = getClosest(schemaName, schemaNameList);

      throw new createError.NotFound(
        `Schema ${schemaName} not found. Did you mean '${closestSchemaName}'?`
      );
    }

    return credentialType;
  },
  extensions: parent.extensions.concat([
    'findCredentialTypeMetadataBySchemaName',
  ]),
});

module.exports = { findCredentialTypeMetadataBySchemaNameExtension };
