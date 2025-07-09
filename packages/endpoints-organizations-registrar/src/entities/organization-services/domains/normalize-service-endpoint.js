const { trimEnd } = require('lodash');

const normalizeServiceEndpoint = (serviceEndpoint) =>
  `${trimEnd(serviceEndpoint, '/')}`;

module.exports = { normalizeServiceEndpoint };
