const newError = require('http-errors');
const displayDescriptorSchema = require('../schemas/display-descriptor.schema.json');

const { CredentialFileType } = require('./constants');

const noop = () => ({ isValid: true });

const initValidateCredentialFile =
  ({ validateSchema, validateJSONBySchema }) =>
  ({ file, credentialFileType }) => {
    let credentialFile;

    const credentialFileValidators = {
      [CredentialFileType.DisplayDescriptor]: (credFile) =>
        validateJSONBySchema(credFile, displayDescriptorSchema),
      [CredentialFileType.JsonSchema]: validateSchema,
      [CredentialFileType.FormSchema]: noop,
      [CredentialFileType.JsonldContext]: noop,
    };

    try {
      credentialFile = JSON.parse(file.toString());
    } catch (error) {
      throw newError(400, 'Invalid JSON', {
        errorCode: 'invalid_json',
      });
    }

    const result = credentialFileValidators[credentialFileType](credentialFile);
    throwIfNotValid(result);
  };

const throwIfNotValid = ({ isValid, error }) => {
  if (isValid) {
    return;
  }
  throw newError(400, error, {
    errorCode: 'file_validation_error',
  });
};

module.exports = {
  initValidateCredentialFile,
};
