const { jwkFromSecp256k1Key } = require('@verii/jwt');
const { omit } = require('lodash/fp');
const { ObjectId } = require('mongodb');

const mapResponseKeyToDbKey = (key) => ({
  _id: expect.any(ObjectId),
  id: key.kidFragment,
  controller: key.didDocumentKey.controller,
  algorithm: 'SECP256K1',
  publicKey:
    key.didDocumentKey.publicKeyJwk ??
    getPublicJwk(key.didDocumentKey.publicKeyMultibase),
  purposes: key.purposes,
  custodied: key.custodied,
});

const getPublicJwk = (hexKey) =>
  omit(['use'], jwkFromSecp256k1Key(hexKey, false));

module.exports = { mapResponseKeyToDbKey };
