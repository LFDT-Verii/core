const { hexFromJwk } = require('@verii/jwt');
const { omit, isEmpty } = require('lodash/fp');

/* eslint-disable better-mutation/no-mutation */
const mapKeyResponse = (key, keyPair) => {
  const response = omit(['publicKey'], key);
  response.kidFragment = key.id;
  response.didDocumentKey = {
    id: key.id,
    type: key.type,
    controller: key.controller,
    ...(key.type === 'JsonWebKey2020'
      ? {
          publicKeyJwk: key.publicKey,
        }
      : {
          publicKeyMultibase: hexFromJwk(key.publicKey, false),
        }),
  };

  if (!isEmpty(keyPair)) {
    response.key = hexFromJwk(keyPair.privateKey);
    response.encoding = 'hex';
  }

  return response;
};

module.exports = { mapKeyResponse };
