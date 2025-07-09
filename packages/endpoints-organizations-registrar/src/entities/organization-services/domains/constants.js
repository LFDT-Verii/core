const {
  ServiceCategories,
  ServiceTypesOfServiceCategory,
} = require('@verii/organizations-registry');

const didDocServiceFields = ['id', 'type', 'serviceEndpoint'];

const identityCategories = [
  ...ServiceTypesOfServiceCategory[ServiceCategories.IdDocumentIssuer],
  ...ServiceTypesOfServiceCategory[ServiceCategories.NotaryIdDocumentIssuer],
  ...ServiceTypesOfServiceCategory[ServiceCategories.ContactIssuer],
  ...ServiceTypesOfServiceCategory[ServiceCategories.NotaryContactIssuer],
  ...ServiceTypesOfServiceCategory[ServiceCategories.IdentityIssuer],
];

const NodeServiceCategories = [
  ...ServiceTypesOfServiceCategory[ServiceCategories.NodeOperator],
  ...ServiceTypesOfServiceCategory[ServiceCategories.CredentialAgentOperator],
];

const OrganizationServiceErrorMessages = {
  ORGANIZATION_SERVICE_NOT_FOUND: 'Organization service not found',
  SERVICE_ID_CANNOT_BE_UPDATED: 'Service "id" property cannot be updated',
  SERVICE_TYPE_CANNOT_BE_UPDATED: 'Service "type" property cannot be updated',
};

module.exports = {
  didDocServiceFields,
  identityCategories,
  NodeServiceCategories,
  OrganizationServiceErrorMessages,
};
