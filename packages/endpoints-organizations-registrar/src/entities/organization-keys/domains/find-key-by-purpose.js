const { includes, find } = require('lodash/fp');

const findKeyByPurpose = (purpose, keys) =>
  find((key) => includes(purpose, key.purposes), keys);

module.exports = { findKeyByPurpose };
