const { createECDH } = require('crypto');
const { omit } = require('lodash/fp');

const normalizeHex = (hex) => hex.replace(/^0x/i, '');

const HEX_FORMAT = /^[0-9a-fA-F]+$/;

const normalizeCoordinateHex = (hex, byteLength = 32) => {
  const normalizedHex = normalizeHex(hex);
  const paddedHex = normalizedHex.padStart(byteLength * 2, '0');
  return paddedHex.slice(-byteLength * 2);
};

const detectHexKeyType = (key) => {
  const normalizedKey = normalizeHex(key);
  if (!HEX_FORMAT.test(normalizedKey)) {
    return 'unknown';
  }
  if (normalizedKey.length === 64) {
    return 'private';
  }
  if (
    (normalizedKey.length === 130 && normalizedKey.startsWith('04')) ||
    normalizedKey.length === 128
  ) {
    return 'public';
  }
  return 'unknown';
};

const base64UrlToHex = (value) =>
  Buffer.from(value, 'base64url').toString('hex');

const hexToBase64Url = (value) =>
  Buffer.from(normalizeHex(value), 'hex').toString('base64url');

const uncompressedPublicKeyToCoordinates = (publicKey) => {
  const normalizedKey = normalizeHex(publicKey);
  const coordinates = normalizedKey.startsWith('04')
    ? normalizedKey.slice(2)
    : normalizedKey;
  const canonicalCoordinates = coordinates.slice(-128);
  return {
    x: canonicalCoordinates.slice(0, 64),
    y: canonicalCoordinates.slice(64),
  };
};

const publicJwkFromPublicHex = (publicKeyHex) => {
  const { x, y } = uncompressedPublicKeyToCoordinates(publicKeyHex);
  return {
    kty: 'EC',
    crv: 'secp256k1',
    use: 'sig',
    x: hexToBase64Url(x),
    y: hexToBase64Url(y),
  };
};

const publicHexFromPrivateHex = (privateKeyHex) => {
  const ecdh = createECDH('secp256k1');
  ecdh.setPrivateKey(Buffer.from(normalizeCoordinateHex(privateKeyHex), 'hex'));
  return ecdh.getPublicKey('hex', 'uncompressed');
};

const jwkFromSecp256k1Key = (key, priv = true) => {
  if (!priv) {
    const keyType = detectHexKeyType(key);
    if (keyType === 'public') {
      return publicJwkFromPublicHex(key);
    }
    if (keyType === 'private') {
      return publicJwkFromPublicHex(publicHexFromPrivateHex(key));
    }
    throw new Error(
      'Expected secp256k1 private key (64 hex chars) or uncompressed public key (128/130 hex chars)',
    );
  }
  const privateKeyHex = normalizeCoordinateHex(key);
  return {
    ...publicJwkFromPublicHex(publicHexFromPrivateHex(privateKeyHex)),
    d: hexToBase64Url(privateKeyHex),
  };
};

const hexFromJwk = (jwk, priv = true) => {
  if (priv) {
    return normalizeCoordinateHex(base64UrlToHex(jwk.d));
  }
  return `04${normalizeCoordinateHex(base64UrlToHex(jwk.x))}${normalizeCoordinateHex(base64UrlToHex(jwk.y))}`;
};

const publicKeyFromPrivateKey = (key) => {
  if (key.x == null) {
    return publicHexFromPrivateHex(key);
  }
  return omit(['d'], key);
};

module.exports = {
  hexFromJwk,
  jwkFromSecp256k1Key,
  publicKeyFromPrivateKey,
};
