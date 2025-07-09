const { map } = require('lodash/fp');

const activateServices = (did, services, { headers, config: { isProd } }) => {
  if (!isProd && headers['x-auto-activate'] !== '0') {
    return map('id', services);
  }

  return [];
};
module.exports = {
  activateServices,
};
