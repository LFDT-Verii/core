const { isEmpty } = require('lodash/fp');
const { jwkFromSecp256k1Key } = require('./core');

const transformKey = (property, key, isPrivate = true) =>
  !isEmpty(key[property])
    ? { [property]: jwkFromSecp256k1Key(key[property], isPrivate) }
    : {};

const hexToJwkKeyTransformer = (key) => ({
  ...key,
  encoding: 'jwk',
  ...transformKey('publicKey', key, false),
  ...transformKey('key', key),
});

module.exports = {
  hexToJwkKeyTransformer,
  transformKey,
};
