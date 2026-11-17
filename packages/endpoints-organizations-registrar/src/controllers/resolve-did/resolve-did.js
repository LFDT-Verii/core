const newError = require('http-errors');
const { resolveDid } = require('../../entities');

const resolveDidOrNotFound = (did, context) =>
  resolveDid(did, context).catch((error) => {
    if (error.errorCode === 'did_resolution_failed') {
      throw newError(404, error.message, { errorCode: error.errorCode });
    }
    throw error;
  });

module.exports = { resolveDidOrNotFound };
