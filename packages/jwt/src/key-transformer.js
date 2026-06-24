const { isEmpty, omit } = require('lodash/fp');
const {
  hexFromJwk,
  jwkFromSecp256k1Key,
  publicKeyFromPrivateKey,
} = require('@verii/crypto');

const jwkFromStringified = (key, priv = true) => {
  const parsed = JSON.parse(key, (k, v) => {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
      return undefined;
    }
    return v;
  });
  const jwk = { ...parsed };
  return priv ? jwk : omit(['d'], jwk);
};

const stringifyJwk = (jwk, priv = true) => {
  return JSON.stringify(priv ? jwk : omit(['d'], jwk));
};

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
  hexFromJwk,
  hexToJwkKeyTransformer,
  jwkFromSecp256k1Key,
  jwkFromStringified,
  publicKeyFromPrivateKey,
  stringifyJwk,
  transformKey,
};
