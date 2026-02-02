const { serviceExists } = require('@verii/did-doc');
const newError = require('http-errors');
const { map, find } = require('lodash/fp');

const validateServicesForDelete = ({
  didDoc,
  activatedServiceIds,
  servicesIds = [],
}) =>
  map((serviceId) => {
    if (!serviceExists(didDoc, serviceId)) {
      throw newError(
        400,
        `Service ${serviceId} was not found in organization ${didDoc.id}`,
      );
    }
    if (
      !find(
        (activeServiceId) => activeServiceId === serviceId,
        activatedServiceIds,
      )
    ) {
      throw newError(
        400,
        `Service ${serviceId} was not found in activated services of the organization ${didDoc.id}`,
      );
    }
  }, servicesIds);

module.exports = {
  validateServicesForDelete,
};
