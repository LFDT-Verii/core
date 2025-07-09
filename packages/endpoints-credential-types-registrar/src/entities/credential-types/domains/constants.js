const CredentialTypeErrorMessages = {
  CREDENTIAL_TYPE_NOT_FOUND: 'Credential Type not found',
  CREDENTIAL_TYPE_NOT_FOUND_TEMPLATE: (type) =>
    `Credential Type "${type}" not found`,
};

const CredentialGroup = {
  Contact: 'Contact',
  IdDocument: 'IdDocument',
  Career: 'Career',
};

module.exports = { CredentialTypeErrorMessages, CredentialGroup };
