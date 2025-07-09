const { flow, map, compact, uniq } = require('lodash/fp');
const { extractServiceEndpointDid } = require('./extract-service-endpoint-did');

const extractCaoServiceRefs = flow(
  map(extractServiceEndpointDid),
  compact,
  uniq
);

module.exports = { extractCaoServiceRefs };
