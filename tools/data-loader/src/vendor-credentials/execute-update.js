const { initHttpClient } = require('@verii/http-client');
const { printInfo } = require('../helpers/common');

const setupHttpClient = ({ endpoint, authToken }) => {
  const options = { prefixUrl: endpoint };
  if (authToken != null) {
    options.bearerToken = authToken;
  }
  if (process.env.NODE_ENV === 'test') {
    options.isTest = true;
  }

  return initHttpClient(options)({
    log: console,
    traceId: 'TRACE-ID',
  });
};

const initExecuteUpdate = (options) => {
  const vendorHttpClient = setupHttpClient(options);
  return async ({ person, offer }) => {
    if (person) {
      printInfo({
        createdPerson: await vendorHttpClient
          .post('api/users', { json: person })
          .then((res) => res.json()),
      });
    }
    printInfo({
      createdOffer: await vendorHttpClient
        .post('api/offers', { json: offer })
        .then((res) => res.json()),
    });
  };
};

module.exports = {
  initExecuteUpdate,
};
