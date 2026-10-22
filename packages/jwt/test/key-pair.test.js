const { describe, it } = require('node:test');
const { expect } = require('expect');
const { generateKeyPairSync } = require('node:crypto');
const {
  isMatchingKeyPair,
  publicJwkFromPrivateJwk,
} = require('../src/key-pair');

const generateJwks = (type, options) => {
  const { privateKey, publicKey } = generateKeyPairSync(type, options);
  return {
    privateJwk: privateKey.export({ format: 'jwk' }),
    publicJwk: publicKey.export({ format: 'jwk' }),
  };
};

const keyTypes = [
  {
    name: 'secp256k1',
    generate: () => generateJwks('ec', { namedCurve: 'secp256k1' }),
    otherCrv: 'P-256',
  },
  {
    name: 'P-256',
    generate: () => generateJwks('ec', { namedCurve: 'P-256' }),
    otherCrv: 'secp256k1',
  },
  {
    name: 'RSA',
    generate: () => generateJwks('rsa', { modulusLength: 2048 }),
  },
];

describe('isMatchingKeyPair', () => {
  keyTypes.forEach(({ name, generate, otherCrv }) => {
    describe(name, () => {
      it('should be true for the public key of the private key', async () => {
        const { privateJwk, publicJwk } = generate();
        expect(await isMatchingKeyPair(privateJwk, publicJwk)).toEqual(true);
      });

      it('should be false for the public key of another key', async () => {
        const { privateJwk } = generate();
        const { publicJwk } = generate();
        expect(await isMatchingKeyPair(privateJwk, publicJwk)).toEqual(false);
      });

      it('should be false when the public members do not belong to the private key', async () => {
        const { privateJwk } = generate();
        const { publicJwk } = generate();
        const inconsistentJwk =
          privateJwk.kty === 'RSA'
            ? { ...privateJwk, n: publicJwk.n }
            : { ...privateJwk, x: publicJwk.x, y: publicJwk.y };
        expect(
          await isMatchingKeyPair(
            inconsistentJwk,
            publicJwkFromPrivateJwk(inconsistentJwk),
          ),
        ).toEqual(false);
      });

      it('should be false when the private key has only d', async () => {
        const { privateJwk, publicJwk } = generate();
        const { kty, crv, d } = privateJwk;
        expect(await isMatchingKeyPair({ kty, crv, d }, publicJwk)).toEqual(
          false,
        );
      });

      if (otherCrv != null) {
        it(`should be false when the key is relabelled ${otherCrv}`, async () => {
          const { privateJwk, publicJwk } = generate();
          expect(
            await isMatchingKeyPair(
              { ...privateJwk, crv: otherCrv },
              { ...publicJwk, crv: otherCrv },
            ),
          ).toEqual(false);
        });
      }
    });
  });

  it('should be false for a key type without a supported algorithm', async () => {
    const { privateJwk, publicJwk } = generateJwks('ed25519');
    expect(await isMatchingKeyPair(privateJwk, publicJwk)).toEqual(false);
  });
});

describe('publicJwkFromPrivateJwk', () => {
  keyTypes.forEach(({ name, generate }) => {
    it(`should keep only the public members of ${name} JWKs`, () => {
      const { privateJwk, publicJwk } = generate();
      expect(publicJwkFromPrivateJwk({ ...privateJwk, kid: 'key-1' })).toEqual({
        ...publicJwk,
        kid: 'key-1',
      });
    });
  });
});
