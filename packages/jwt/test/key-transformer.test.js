const { jwkFromSecp256k1Key } = require('../src/core');
const {
  transformKey,
  hexToJwkKeyTransformer,
} = require('../src/key-transformer');

describe('Key Transformer Tests', () => {
  const privateKey = 'privateKey';
  const publicKey = 'publicKey';
  const key = {
    privateKey,
    publicKey,
  };

  describe('Transform key', () => {
    it('Should transform private key', () => {
      const transformedKey = transformKey('privateKey', key, true);

      expect(transformedKey).toEqual({
        privateKey: jwkFromSecp256k1Key(privateKey, true),
      });
    });

    it('Should transform public key', () => {
      const transformedKey = transformKey('publicKey', key, false);

      expect(transformedKey).toEqual({
        publicKey: jwkFromSecp256k1Key(publicKey, false),
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
        key: '1234567890abcdef',
        publicKey: 'fedcba0987654321',
      };
      const jwkKey = {
        key: jwkFromSecp256k1Key(hexKey.key, true),
        publicKey: jwkFromSecp256k1Key(hexKey.publicKey, false),
        encoding: 'jwk',
        other: 'other',
      };
      const transformedKey = hexToJwkKeyTransformer(hexKey);

      expect(transformedKey).toEqual(jwkKey);
    });
  });
});
