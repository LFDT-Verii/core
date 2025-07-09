const { isNil } = require('lodash/fp');
const newError = require('http-errors');

const assertDisclosureActive = (disclosure, req) => {
  const { enableDeactivatedDisclosure } = req.config;
  if (
    !enableDeactivatedDisclosure ||
    isNil(disclosure?.deactivationDate) ||
    new Date(disclosure.deactivationDate) > new Date()
  ) {
    return;
  }

  throw newError(400, 'Disclosure is not active', {
    errorCode: 'disclosure_not_active',
  });
};

module.exports = {
  assertDisclosureActive,
};
