const { isEmpty } = require('lodash/fp');
const newError = require('http-errors');

const validateServiceType = (service) => {
  if (isEmpty(service.type)) {
    throw newError(400, 'Service must have a type', {
      errorCode: 'type_required',
    });
  }
};

module.exports = { validateServiceType };
