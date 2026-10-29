const { hexFromJwk, KeyEncodings } = require('@verii/crypto');
const { omit, isEmpty } = require('lodash/fp');

const mapKeyResponse = (key, keyPair, keyEncoding = KeyEncodings.HEX) =>
  isHexEncoded(key, keyEncoding)
    ? mapHexKeyResponse(key, keyPair)
    : mapJwkKeyResponse(key, keyPair);

// Hex carries no curve, so a key on any curve other than secp256k1 is always returned as JWK.
const isHexEncoded = ({ publicKey }, keyEncoding) =>
  keyEncoding === KeyEncodings.HEX &&
  (publicKey?.crv == null || publicKey.crv === 'secp256k1');

const mapHexKeyResponse = (key, keyPair) => ({
  ...omit(['publicKey'], key),
  kidFragment: key.id,
  didDocumentKey: {
    ...buildDidDocumentKeyIds(key),
    ...(key.type === 'JsonWebKey2020'
      ? { publicKeyJwk: key.publicKey }
      : { publicKeyMultibase: hexFromJwk(key.publicKey, false) }),
  },
  ...(isEmpty(keyPair)
    ? {}
    : { key: hexFromJwk(keyPair.privateKey), encoding: KeyEncodings.HEX }),
});

const mapJwkKeyResponse = (key, keyPair) => ({
  ...omit(['publicKey', 'encoding'], key),
  kidFragment: key.id,
  didDocumentKey: {
    ...buildDidDocumentKeyIds(key),
    publicKeyJwk: key.publicKey,
  },
  ...(isEmpty(keyPair)
    ? {}
    : { jwk: keyPair.privateKey, encoding: KeyEncodings.JWK }),
});

const buildDidDocumentKeyIds = ({ id, type, controller }) => ({
  id,
  type,
  controller,
});

module.exports = { mapKeyResponse };
