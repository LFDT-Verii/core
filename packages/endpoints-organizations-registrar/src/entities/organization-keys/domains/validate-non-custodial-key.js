const newError = require('http-errors');

const validateNonCustodialKey = (newKey) => {
  if (!newKey.custodied && newKey.kidFragment == null) {
    throw newError(400, 'Non custodial keys must specify kidFragment', {
      code: 'kid_fragment_required',
    });
  }
};

module.exports = { validateNonCustodialKey };
