const { describe, it } = require('node:test');
const { expect } = require('expect');
const {
  transformKey,
  hexToJwkKeyTransformer,
  jwkFromStringified,
  stringifyJwk,
} = require('../src/key-transformer');

// These fixtures have a leading 0x00 byte in the X coordinate. They verify we
// preserve coordinate padding when converting between key representations.
const PRIVATE_KEY_WITH_PADDING =
  '52b1a0115ecef18c8e082711c84b9a19fda9128c24d206b7f718b39036d26cc1';
const PUBLIC_KEY_WITH_PADDING =
  '04007ea463cc5f7ac9e6eef4f1aa3484ca01d365f8f4f23fcd13569ed28a9c4b4ae43f3b3c1d5fae0f2f8fc67b551322a35c38d9a10a4b392adc580fd483d79187';
const PRIVATE_JWK_WITH_PADDING = {
  kty: 'EC',
  crv: 'secp256k1',
  x: 'AH6kY8xfesnm7vTxqjSEygHTZfj08j_NE1ae0oqcS0o',
  y: '5D87PB1frg8vj8Z7VRMio1w42aEKSzkq3FgP1IPXkYc',
  d: 'UrGgEV7O8YyOCCcRyEuaGf2pEowk0ga39xizkDbSbME',
  use: 'sig',
};
const PUBLIC_JWK_WITH_PADDING = {
  kty: 'EC',
  crv: 'secp256k1',
  x: 'AH6kY8xfesnm7vTxqjSEygHTZfj08j_NE1ae0oqcS0o',
  y: '5D87PB1frg8vj8Z7VRMio1w42aEKSzkq3FgP1IPXkYc',
  use: 'sig',
};

const PRIVATE_KEY =
  '1111111111111111111111111111111111111111111111111111111111111111';
const PUBLIC_KEY =
  '044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa385b6b1b8ead809ca67454d9683fcf2ba03456d6fe2c4abe2b07f0fbdbb2f1c1';
const PRIVATE_JWK = {
  kty: 'EC',
  crv: 'secp256k1',
  x: 'TzVb3LfMCvco7zzOuWFdkGhLtbLKX4WasPC3BAdYcao',
  y: 'OFtrG46tgJymdFTZaD_PK6A0Vtb-LEq-Kwfw-9uy8cE',
  d: 'ERERERERERERERERERERERERERERERERERERERERERE',
  use: 'sig',
};
const PUBLIC_JWK = {
  kty: 'EC',
  crv: 'secp256k1',
  x: 'TzVb3LfMCvco7zzOuWFdkGhLtbLKX4WasPC3BAdYcao',
  y: 'OFtrG46tgJymdFTZaD_PK6A0Vtb-LEq-Kwfw-9uy8cE',
  use: 'sig',
};

describe('Key Transformer Tests', () => {
  describe('Transform key', () => {
    const key = {
      privateKey: PRIVATE_KEY_WITH_PADDING,
      publicKey: PUBLIC_KEY_WITH_PADDING,
    };

    it('Should transform private key', () => {
      const transformedKey = transformKey('privateKey', key, true);

      expect(transformedKey).toEqual({
        privateKey: PRIVATE_JWK_WITH_PADDING,
      });
    });

    it('Should transform public key', () => {
      const transformedKey = transformKey('publicKey', key, false);

      expect(transformedKey).toEqual({
        publicKey: PUBLIC_JWK_WITH_PADDING,
      });
    });

    it('Should return empty object if key property is empty', () => {
      const transformedKey = transformKey('invalidKey', key, true);

      expect(transformedKey).toEqual({});
    });
  });

  describe('hexToJwkKeyTransformer', () => {
    it('should transform hex key to jwk key', () => {
      const hexKey = {
        other: 'other',
        key: PRIVATE_KEY,
        publicKey: PUBLIC_KEY,
      };
      const jwkKey = {
        key: PRIVATE_JWK,
        publicKey: PUBLIC_JWK,
        encoding: 'jwk',
        other: 'other',
      };
      const transformedKey = hexToJwkKeyTransformer(hexKey);

      expect(transformedKey).toEqual(jwkKey);
    });
  });

  describe('jwk string serialization', () => {
    it('should deserialize public jwk', () => {
      const serialized = JSON.stringify(PUBLIC_JWK);

      expect(jwkFromStringified(serialized, false)).toEqual(PUBLIC_JWK);
    });

    it('should deserialize private jwk', () => {
      const serialized = JSON.stringify(PRIVATE_JWK);

      expect(jwkFromStringified(serialized, true)).toEqual(PRIVATE_JWK);
    });

    it('should stringify only the public members', () => {
      const stringifiedPublicJwk = stringifyJwk(PRIVATE_JWK, false);

      expect(JSON.parse(stringifiedPublicJwk)).toEqual(PUBLIC_JWK);
    });

    it('should stringify private members when priv is true', () => {
      const stringifiedPrivateJwk = stringifyJwk(PRIVATE_JWK, true);

      expect(JSON.parse(stringifiedPrivateJwk)).toEqual(PRIVATE_JWK);
    });
  });
});
