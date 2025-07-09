const { flatMap } = require('lodash/fp');
const {
  ServiceTypesOfServiceCategory,
} = require('@verii/organizations-registry');

const serviceCategoriesToServiceTypes = flatMap(
  (currentServiceCategory) =>
    ServiceTypesOfServiceCategory[currentServiceCategory]
);

const getServiceTypesFromCategories = ({ filter } = {}) => {
  const serviceCategories = filter?.serviceTypes;
  return serviceCategories != null
    ? serviceCategoriesToServiceTypes(serviceCategories)
    : undefined;
};

module.exports = { getServiceTypesFromCategories };
