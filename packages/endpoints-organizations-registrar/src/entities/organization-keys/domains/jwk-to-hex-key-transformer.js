const { isEmpty } = require('lodash/fp');
const { hexFromJwk } = require('@verii/jwt');

const jwkToHexKeyTransformer = (key) => ({
  ...key,
  encoding: 'hex',
  publicKey: hexFromJwk(key.publicKey, false),
  ...(!isEmpty(key.key) ? { key: hexFromJwk(key.key) } : {}),
});

module.exports = {
  jwkToHexKeyTransformer,
};
