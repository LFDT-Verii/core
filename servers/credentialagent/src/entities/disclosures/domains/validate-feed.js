const newError = require('http-errors');
const { DisclosureErrors } = require('./errors');
const { ConfigurationType } = require('./constants');

const validateFeed = (disclosure) => {
  const { configurationType, feed } = disclosure;
  if (configurationType === ConfigurationType.ISSUING && feed === true) {
    throw newError(400, DisclosureErrors.ISSUING_FEED_NOT_SUPPORTED, {
      errorCode: 'issuing_feed_not_supported',
    });
  }
};

module.exports = {
  validateFeed,
};
