const { createECDH, createPrivateKey, createPublicKey } = require('crypto');
const { base64url } = require('jose');
const { isEmpty, startsWith, omit } = require('lodash/fp');

const isPem = startsWith('-----BEGIN');

const normalizeHex = (hex) => hex.replace(/^0x/i, '');

const normalizeCoordinateHex = (hex, byteLength = 32) => {
  const normalizedHex = normalizeHex(hex);
  const paddedHex = normalizedHex.padStart(byteLength * 2, '0');
  return paddedHex.slice(-byteLength * 2);
};

const base64UrlToHex = (value) => {
  return Buffer.from(base64url.decode(value)).toString('hex');
};

const hexToBase64Url = (value) => {
  return base64url.encode(Buffer.from(normalizeHex(value), 'hex'));
};

const uncompressedPublicKeyToCoordinates = (publicKey) => {
  const normalizedKey = normalizeHex(publicKey);
  const coordinates = normalizedKey.startsWith('04')
    ? normalizedKey.slice(2)
    : normalizedKey;
  if (coordinates.length < 128 || coordinates.length % 2 !== 0) {
    throw new Error('Invalid secp256k1 public key');
  }
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

const publicJwkFromPem = (pem, priv) => {
  const keyObject = priv ? createPrivateKey(pem) : createPublicKey(pem);
  const exportedJwk = keyObject.export({ format: 'jwk' });
  return priv ? exportedJwk : omit(['d'], exportedJwk);
};

const jwkFromSecp256k1Key = (key, priv = true) => {
  if (isPem(key)) {
    const rawJwk = publicJwkFromPem(key, priv);
    return {
      ...rawJwk,
      kty: 'EC',
      use: 'sig',
    };
  }
  if (!priv) {
    try {
      return publicJwkFromPublicHex(key);
    } catch {
      return publicJwkFromPublicHex(publicHexFromPrivateHex(key));
    }
  }
  const privateKeyHex = normalizeCoordinateHex(key);
  return {
    ...publicJwkFromPublicHex(publicHexFromPrivateHex(privateKeyHex)),
    d: hexToBase64Url(privateKeyHex),
  };
};

const jwkFromStringified = (key, priv = true) => {
  const jwk = JSON.parse(key);
  return priv ? jwk : omit(['d'], jwk);
};

const stringifyJwk = (jwk, priv = true) => {
  return JSON.stringify(priv ? jwk : omit(['d'], jwk));
};

const hexFromJwk = (jwk, priv = true) => {
  if (priv) {
    return normalizeCoordinateHex(base64UrlToHex(jwk.d));
  }
  return `04${normalizeCoordinateHex(base64UrlToHex(jwk.x))}${normalizeCoordinateHex(base64UrlToHex(jwk.y))}`;
};

const publicKeyFromPrivateKey = (key) => {
  return key.x == null ? publicHexFromPrivateHex(key) : omit(['d'], key);
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
