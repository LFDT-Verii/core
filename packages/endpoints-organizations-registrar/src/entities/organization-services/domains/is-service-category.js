const { includes } = require('lodash/fp');

const {
  ServiceTypeToCategoryMap,
  ServiceCategories,
  ServiceTypesOfServiceCategory,
  IssuingAndInspectionCategories,
} = require('@verii/organizations-registry');

const isIssuingOrInspectionService = (service) =>
  service?.type != null &&
  includes(
    ServiceTypeToCategoryMap[service.type],
    IssuingAndInspectionCategories
  );

const isCaoService = (service) =>
  service != null &&
  includes(
    service.type,
    ServiceTypesOfServiceCategory[ServiceCategories.CredentialAgentOperator]
  );

const isNodeOperator = (service) =>
  service != null &&
  includes(
    service.type,
    ServiceTypesOfServiceCategory[ServiceCategories.NodeOperator]
  );

module.exports = { isIssuingOrInspectionService, isCaoService, isNodeOperator };
