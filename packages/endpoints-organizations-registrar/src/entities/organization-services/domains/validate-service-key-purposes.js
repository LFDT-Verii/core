const newError = require('http-errors');
const { includes, map, find, flow, compact } = require('lodash/fp');
const { KeyPurposes } = require('@verii/crypto');
const { ServiceTypes } = require('@verii/organizations-registry');

const validateServiceKeyPurposes = (registeredService, keys) => {
  const requiredPurposes = requiredKeyPurposes[registeredService.type];

  // gets a single key for each required purpose
  const registeredKeys = flow(
    map(findKeyWithRequiredPurpose(keys)),
    compact
  )(requiredPurposes);

  // if the number of found keys doesnt equal the number required, then its an error
  if (registeredKeys.length !== requiredPurposes.length) {
    throw newError(400, 'No required purpose for service', {
      code: 'required_key_missing_in_byo_did_doc',
    });
  }
};

const findKeyWithRequiredPurpose = (keys) => (requiredPurpose) =>
  find((key) => includes(requiredPurpose, key.purposes), keys);

const keyPurposesCaoNode = [KeyPurposes.DLT_TRANSACTIONS];
const keyPurposesIssuing = [
  KeyPurposes.DLT_TRANSACTIONS,
  KeyPurposes.ISSUING_METADATA,
  KeyPurposes.EXCHANGES,
];
const keyPurposesRelyingParties = [
  KeyPurposes.DLT_TRANSACTIONS,
  KeyPurposes.EXCHANGES,
];

const requiredKeyPurposes = {
  // CAO and NODE
  [ServiceTypes.CredentialAgentOperatorType]: keyPurposesCaoNode,
  [ServiceTypes.NodeOperatorType]: keyPurposesCaoNode,
  // ISSUING
  [ServiceTypes.IdentityIssuerType]: keyPurposesIssuing,
  [ServiceTypes.CareerIssuerType]: keyPurposesIssuing,
  [ServiceTypes.NotaryIssuerType]: keyPurposesIssuing,
  [ServiceTypes.ContactIssuerType]: keyPurposesIssuing,
  [ServiceTypes.NotaryContactIssuerType]: keyPurposesIssuing,
  [ServiceTypes.NotaryIdDocumentIssuerType]: keyPurposesIssuing,
  [ServiceTypes.IdDocumentIssuerType]: keyPurposesIssuing,
  // RELYING PARTIES
  [ServiceTypes.HolderAppProviderType]: keyPurposesRelyingParties,
  [ServiceTypes.InspectionType]: keyPurposesRelyingParties,
};

module.exports = {
  validateServiceKeyPurposes,
};
