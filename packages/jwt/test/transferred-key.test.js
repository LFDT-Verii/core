/*
 * Copyright 2026 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');
const { generateKeyPairSync } = require('node:crypto');
const { omit } = require('lodash/fp');
const { leadingZeroSecp256k1Keys } = require('@verii/sample-data');
const { hexFromJwk, jwkFromSecp256k1Key } = require('@verii/crypto');
const {
  resolveTransferredKey,
  TransferredKeyError,
  TransferredKeyErrorCodes,
} = require('../src/transferred-key');

const generateJwks = (namedCurve = 'secp256k1') => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve });
  return {
    privateJwk: privateKey.export({ format: 'jwk' }),
    publicJwk: publicKey.export({ format: 'jwk' }),
  };
};

const dualKey = ({ privateJwk, publicJwk }) => ({
  encoding: 'hex',
  key: hexFromJwk(privateJwk),
  publicKey: hexFromJwk(publicJwk, false),
  jwk: privateJwk,
  publicJwk,
});

const transferredKeyError = (errorCode) =>
  expect.objectContaining({
    name: 'TransferredKeyError',
    errorCode,
  });

describe('resolveTransferredKey', () => {
  it('should resolve a dual key to its JWKs', () => {
    const jwks = generateJwks();
    expect(resolveTransferredKey(dualKey(jwks))).toEqual(jwks);
  });

  it('should resolve a JWK-only key', () => {
    const jwks = generateJwks();
    expect(
      resolveTransferredKey({
        encoding: 'jwk',
        jwk: jwks.privateJwk,
        publicJwk: jwks.publicJwk,
      }),
    ).toEqual(jwks);
  });

  it('should resolve a JWK-only P-256 key', () => {
    const jwks = generateJwks('P-256');
    expect(
      resolveTransferredKey({
        encoding: 'jwk',
        jwk: jwks.privateJwk,
        publicJwk: jwks.publicJwk,
      }),
    ).toEqual(jwks);
  });

  it('should resolve a hex-only key', () => {
    const { privateJwk, publicJwk } = generateJwks();
    expect(
      resolveTransferredKey({
        encoding: 'hex',
        key: hexFromJwk(privateJwk),
        publicKey: hexFromJwk(publicJwk, false),
      }),
    ).toEqual({
      privateJwk: { ...privateJwk, use: 'sig' },
      publicJwk: { ...publicJwk, use: 'sig' },
    });
  });

  it('should resolve hexKey like key', () => {
    const { privateJwk } = generateJwks();
    expect(resolveTransferredKey({ hexKey: hexFromJwk(privateJwk) })).toEqual({
      privateJwk: { ...privateJwk, use: 'sig' },
      publicJwk: undefined,
    });
  });

  it('should resolve a key that is already a JWK', () => {
    const { privateJwk, publicJwk } = generateJwks();
    expect(
      resolveTransferredKey({ key: privateJwk, publicKey: publicJwk }),
    ).toEqual({ privateJwk, publicJwk });
  });

  it('should leave the public JWK undefined when no public key is sent', () => {
    const { privateJwk } = generateJwks();
    expect(resolveTransferredKey({ jwk: privateJwk })).toEqual({
      privateJwk,
      publicJwk: undefined,
    });
  });

  it('should throw when no private key is sent', () => {
    const { publicJwk } = generateJwks();
    expect(() => resolveTransferredKey({ publicJwk })).toThrow(
      transferredKeyError(TransferredKeyErrorCodes.PRIVATE_KEY_NOT_FOUND),
    );
  });

  it('should treat empty members as not sent', () => {
    const { privateJwk } = generateJwks();
    expect(
      resolveTransferredKey({
        jwk: {},
        key: '',
        hexKey: hexFromJwk(privateJwk),
        publicJwk: {},
        publicKey: '',
      }),
    ).toEqual({
      privateJwk: { ...privateJwk, use: 'sig' },
      publicJwk: undefined,
    });
    expect(() => resolveTransferredKey({ jwk: {}, key: '' })).toThrow(
      transferredKeyError(TransferredKeyErrorCodes.PRIVATE_KEY_NOT_FOUND),
    );
  });

  it('should throw when the private hex is not a secp256k1 key', () => {
    expect(() => resolveTransferredKey({ key: 'not-a-key' })).toThrow(
      transferredKeyError(TransferredKeyErrorCodes.PRIVATE_KEY_INVALID),
    );
  });

  it('should throw when the public hex is not a secp256k1 public key', () => {
    const { privateJwk } = generateJwks();
    expect(() =>
      resolveTransferredKey({
        jwk: privateJwk,
        publicKey: hexFromJwk(privateJwk),
      }),
    ).toThrow(transferredKeyError(TransferredKeyErrorCodes.PUBLIC_KEY_INVALID));
  });

  it('should throw when the private hex is another key than the JWK', () => {
    const jwks = generateJwks();
    const other = generateJwks();
    expect(() =>
      resolveTransferredKey({
        ...dualKey(jwks),
        key: hexFromJwk(other.privateJwk),
      }),
    ).toThrow(
      transferredKeyError(TransferredKeyErrorCodes.KEY_FORMATS_MISMATCH),
    );
  });

  it('should throw when the public hex is another key than the public JWK', () => {
    const jwks = generateJwks();
    const other = generateJwks();
    expect(() =>
      resolveTransferredKey({
        ...dualKey(jwks),
        publicKey: hexFromJwk(other.publicJwk, false),
      }),
    ).toThrow(
      transferredKeyError(TransferredKeyErrorCodes.KEY_FORMATS_MISMATCH),
    );
  });

  it('should throw when a P-256 scalar is also sent as hex', () => {
    const { privateJwk } = generateJwks('P-256');
    expect(() =>
      resolveTransferredKey({ key: hexFromJwk(privateJwk), jwk: privateJwk }),
    ).toThrow(
      transferredKeyError(TransferredKeyErrorCodes.KEY_FORMATS_MISMATCH),
    );
  });

  it('should throw a TransferredKeyError with a message', () => {
    expect(() => resolveTransferredKey({})).toThrow(TransferredKeyError);
    expect(() => resolveTransferredKey({})).toThrow('Private key not found');
  });

  describe('leading zero bytes', () => {
    Object.entries(leadingZeroSecp256k1Keys).forEach(([member, vector]) => {
      it(`should resolve a dual key whose ${member} starts with a zero byte`, () => {
        expect(
          resolveTransferredKey({
            key: vector.privateKeyHex,
            publicKey: vector.publicKeyHex,
            jwk: vector.privateJwk,
            publicJwk: vector.publicJwk,
          }),
        ).toEqual({
          privateJwk: vector.privateJwk,
          publicJwk: vector.publicJwk,
        });
      });

      it(`should keep the zero byte when only hex is sent and ${member} starts with one`, () => {
        const { privateJwk, publicJwk } = resolveTransferredKey({
          key: vector.privateKeyHex,
          publicKey: vector.publicKeyHex,
        });
        expect(omit(['use'], privateJwk)).toEqual(vector.privateJwk);
        expect(omit(['use'], publicJwk)).toEqual(vector.publicJwk);
        expect(hexFromJwk(privateJwk)).toEqual(vector.privateKeyHex);
        expect(hexFromJwk(publicJwk, false)).toEqual(vector.publicKeyHex);
      });

      it(`should match a JWK that dropped the zero byte of ${member} to its hex`, () => {
        const unpaddedJwk = {
          ...vector.privateJwk,
          [member]: Buffer.from(vector.privateJwk[member], 'base64url')
            .subarray(1)
            .toString('base64url'),
        };
        expect(
          resolveTransferredKey({
            key: vector.privateKeyHex,
            jwk: unpaddedJwk,
          }).privateJwk,
        ).toEqual(unpaddedJwk);
      });
    });

    it('should encode every vector at full length', () => {
      Object.values(leadingZeroSecp256k1Keys).forEach((vector) => {
        expect(vector.privateKeyHex).toHaveLength(64);
        expect(vector.publicKeyHex).toHaveLength(130);
        expect(jwkFromSecp256k1Key(vector.privateKeyHex)).toEqual({
          ...vector.privateJwk,
          use: 'sig',
        });
      });
    });
  });
});
