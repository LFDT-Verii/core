const { nanoid } = require('nanoid');
const { CredentialFileType } = require('./constants');

const folderMap = {
  [CredentialFileType.DisplayDescriptor]: 'display-descriptors',
  [CredentialFileType.FormSchema]: 'form-schemas',
  [CredentialFileType.JsonSchema]: 'schemas',
  [CredentialFileType.JsonldContext]: 'contexts',
};

const generateCredentialFileName = ({ originalFilename, credentialFileType }) =>
  `${folderMap[credentialFileType]}/${nanoid()}-${originalFilename}`;

module.exports = { generateCredentialFileName };
