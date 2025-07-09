const { ServiceTypes } = require('@verii/organizations-registry');

const Authorities = {
  NationalAuthority: 'NationalAuthority',
  DunnAndBradstreet: 'DunnAndBradstreet',
  GLEIF: 'GLEIF',
  LinkedIn: 'LinkedIn',
};

const OrganizationTypes = {
  COMPANY: 'company',
  NON_PROFIT: 'non-profit',
};

const OrganizationErrorMessages = {
  ORGANIZATION_NOT_FOUND: 'Organization not found',
  VERIFIABLE_CREDENTIAL_NOT_FOUND: 'Verifiable Credential not found',
  UNRECOGNIZED_VERIFIABLE_CREDENTIAL_TYPE:
    'Unrecognized Verifiable Credential type',
};

const PublicProfileFieldsForHide = [
  'adminGivenName',
  'adminFamilyName',
  'adminName',
  'adminTitle',
  'adminEmail',
  'signatoryGivenName',
  'signatoryFamilyName',
  'signatoryName',
  'signatoryTitle',
  'signatoryEmail',
];

const ServiceTypeLabels = {
  [ServiceTypes.InspectionType]: 'Relying Party',
  [ServiceTypes.NotaryIssuerType]: 'Notary Issuer',
  [ServiceTypes.HolderAppProviderType]: 'Wallet App Provider',
  [ServiceTypes.NodeOperatorType]: 'Node Operator',
  [ServiceTypes.CredentialAgentOperatorType]: 'Credential Agent Operator',
  [ServiceTypes.CareerIssuerType]: 'Issuer of Career Credentials',
  [ServiceTypes.IdentityIssuerType]: 'Issuer of Identity Credentials',
  [ServiceTypes.IdentityIssuerType]: 'Issuer of Identity Credentials',
  [ServiceTypes.IdentityIssuerType]: 'Issuer of Identity Credentials',
  [ServiceTypes.IdentityIssuerType]: 'Issuer of Identity Credentials',
};

module.exports = {
  Authorities,
  OrganizationErrorMessages,
  OrganizationTypes,
  PublicProfileFieldsForHide,
  ServiceTypeLabels,
};
