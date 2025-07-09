const { map, find } = require('lodash/fp');

const selectActivatedServices = (selectedServiceIds, services) =>
  map((id) => find({ id }, services))(selectedServiceIds);

module.exports = {
  selectActivatedServices,
};
