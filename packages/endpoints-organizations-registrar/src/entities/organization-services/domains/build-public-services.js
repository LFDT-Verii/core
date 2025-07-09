const { map, pick } = require('lodash/fp');

const buildPublicService = pick([
  'id',
  'type',
  'serviceEndpoint',
  'credentialTypes',
  'logoUrl',
  'playStoreUrl',
  'appleAppStoreUrl',
  'appleAppId',
  'googlePlayId',
  'name',
  'supportedExchangeProtocols',
]);

const buildPublicServices = map(buildPublicService);

module.exports = { buildPublicServices, buildPublicService };
