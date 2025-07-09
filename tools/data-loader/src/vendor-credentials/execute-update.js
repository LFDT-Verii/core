const got = require('got');
const { printInfo } = require('../helpers/common');

const setupGot = ({ endpoint, authToken }) => {
  const options = {
    prefixUrl: endpoint,
  };
  if (authToken != null) {
    options.headers = { Authorization: `Bearer ${authToken}` };
  }
  return got.extend(options);
};

const initExecuteUpdate = (options) => {
  const vendorGot = setupGot(options);
  return async ({ person, offer }) => {
    if (person) {
      printInfo({
        createdPerson: await vendorGot
          .post('api/users', { json: person })
          .json(),
      });
    }
    printInfo({
      createdOffer: await vendorGot.post('api/offers', { json: offer }).json(),
    });
  };
};

module.exports = {
  initExecuteUpdate,
};
