const { KeyPurposes } = require('@verii/crypto');
const newError = require('http-errors');
const { isEmpty, all, find } = require('lodash/fp');

const validateByoDidKeys = (keys) => {
  if (isEmpty(keys)) {
    throw newError(400, 'Keys are required for BYO DID', {
      code: 'keys_required',
    });
  }
  const isNonCustodialKeys = all((key) => !key.custodial, keys);
  if (!isNonCustodialKeys) {
    throw newError(400, 'Keys must be non-custodial', {
      code: 'keys_must_be_non_custodial',
    });
  }
  const dlt = find(
    (key) => key.purposes.includes(KeyPurposes.DLT_TRANSACTIONS),
    keys
  );
  if (isEmpty(dlt)) {
    throw newError(400, 'Keys must include DLT_TRANSACTIONS purpose', {
      code: 'keys_must_include_dlt_transactions',
    });
  }
};

module.exports = { validateByoDidKeys };
