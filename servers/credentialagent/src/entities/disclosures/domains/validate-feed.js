const newError = require('http-errors');
const { DisclosureErrors } = require('./errors');
const { ConfigurationType } = require('./constants');

const validateFeed = (disclosure, context) => {
  const { configurationType, feed } = disclosure;
  if (configurationType === ConfigurationType.ISSUING && feed === true) {
    throw newError(400, DisclosureErrors.ISSUING_FEED_NOT_SUPPORTED, {
      errorCode: 'issuing_feed_not_supported',
    });
  }
  if (context.method === 'PUT' && context.disclosure.feed !== disclosure.feed) {
    throw newError(400, DisclosureErrors.FEED_PROPERTY_CANNOT_BE_MODIFIED, {
      errorCode: 'feed_property_cannot_be_modified',
    });
  }
};

module.exports = {
  validateFeed,
};
