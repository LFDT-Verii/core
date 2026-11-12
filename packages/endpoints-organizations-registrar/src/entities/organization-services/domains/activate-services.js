const { map } = require('lodash/fp');

const activateServices = (
  did,
  services,
  { headers, config: { autoActivateServices } },
) => {
  if (autoActivateServices && headers['x-auto-activate'] !== '0') {
    return map('id', services);
  }

  return [];
};
module.exports = {
  activateServices,
};
