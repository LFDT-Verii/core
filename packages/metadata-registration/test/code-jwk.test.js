/*
 * Copyright 2025 Velocity Team
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

const {
  get2BytesHash,
  encrypt,
  encryptBuffer,
  decrypt,
} = require('@verii/crypto');
const { hexFromJwk, jwkFromSecp256k1Key } = require('@verii/jwt');
const { encodeJwk, decodeJwk } = require('../src/code-jwk');
const { ALG_TYPE } = require('../src/constants');

const es256Jwk = {
  kty: 'EC',
  x: 'kDURbHqxIXblJe6hIAlsmBhoPzbS_CumW3gP517R_cM',
  y: 'NIkFH5IHSdlppa8GzS4hxLcLpI5XaWuzdsjcvMlTcBE',
  crv: 'P-256',
};

const es256kJwk = {
  kty: 'EC',
  crv: 'secp256k1',
  x: '5YJO99LvgIY3A3pidNkk_-LBrPz8yAqpYEUQyVsszQk',
  y: 'nyuwr_sdkEZTvb2dHNNa3Ksxp-kYuxTraVI7mAFZFD0',
};

const rs256Jwk = {
  kty: 'RSA',
  // eslint-disable-next-line max-len
  n: 'sXchOWzJQX8Mmy5xkFJ8vWwOSXvNLXxkIg0FkgSsn6AyzPMZcRJPzHZjW8UdP5smN4k_0HxZY9VZJtIBaU2zUb9DdKhSbJq6q5UgZqzqNmldOBy5MOxuTxgOdxIQ9V9OLChw46wxkKjqsoKvzMGeBAIsQaXgmIkqgLf5nKr3dHgE',
  e: 'AQAB',
};

const secret =
  '6fc13e4032a30cd61060d669cf931f4fa8de043a76f32df500bffb15aded78f8';

describe('encoding and decoding of jwks for blockchains', () => {
  describe('encodeJwk', () => {
    it('throws if HEX_AES_256 is used with a non-secp256k1 key', async () => {
      await expect(() =>
        encodeJwk(ALG_TYPE.HEX_AES_256, es256Jwk, secret)
      ).rejects.toThrow('Hex encoding is only supported for secp256k1 keys');
    });

    it('encodeJwk should encode ES256 JWK', async () => {
      const buffer = await encodeJwk(
        ALG_TYPE.COSEKEY_AES_256,
        es256Jwk,
        secret
      );
      expect(buffer.length).toEqual(138);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('encodeJwk should encode RS256 JWK', async () => {
      const buffer = await encodeJwk(
        ALG_TYPE.COSEKEY_AES_256,
        rs256Jwk,
        secret
      );
      expect(buffer.length).toEqual(236);
    });

    it('encodeJwk should encode ES256K JWK', async () => {
      const buffer = await encodeJwk(
        ALG_TYPE.COSEKEY_AES_256,
        es256kJwk,
        secret
      );
      expect(buffer.length).toEqual(138);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('encodeJwk should encode ES256K JWK as hex', async () => {
      const buffer = await encodeJwk(ALG_TYPE.HEX_AES_256, es256kJwk, secret);
      expect(buffer.length).toEqual(226);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe('decodeJwk', () => {
    it('decodes a raw hex key using HEX_AES_256 algType', async () => {
      await expect(() =>
        decodeJwk('SOME_OTHER_TYPE', Buffer.from('deadbeef', 'hex'), secret)
      ).rejects.toThrowError();
    });

    it('decodes a es256k compact JWK buffer back to JWK object', async () => {
      const encoded = await encodeJwk(
        ALG_TYPE.COSEKEY_AES_256,
        es256kJwk,
        secret
      );
      const result = await decodeJwk(
        get2BytesHash(ALG_TYPE.COSEKEY_AES_256),
        encoded,
        secret
      );

      expect(result).toEqual(es256kJwk);
    });

    it('decodes a es256 compact JWK buffer back to JWK object', async () => {
      const encoded = await encodeJwk(
        ALG_TYPE.COSEKEY_AES_256,
        es256Jwk,
        secret
      );
      const result = await decodeJwk(
        get2BytesHash(ALG_TYPE.COSEKEY_AES_256),
        encoded,
        secret
      );

      expect(result).toEqual(es256Jwk);
    });

    it('decodes a rs256 compact JWK buffer back to JWK object', async () => {
      const encoded = await encodeJwk(
        ALG_TYPE.COSEKEY_AES_256,
        rs256Jwk,
        secret
      );
      const result = await decodeJwk(
        get2BytesHash(ALG_TYPE.COSEKEY_AES_256),
        encoded,
        secret
      );

      expect(result).toEqual(rs256Jwk);
    });

    it('throws for unknown encoded algorithm in buffer', async () => {
      // Create a buffer with unknown algorithm index
      const invalidBuffer = encryptBuffer(
        Buffer.concat([
          Buffer.from(new Uint16Array([9999]).buffer), // unknown alg encoding
          Buffer.from(`,x=${Buffer.from('abc').toString('base64url')}`),
        ]),
        secret
      );
      await expect(() =>
        decodeJwk(
          get2BytesHash(ALG_TYPE.COSEKEY_AES_256),
          invalidBuffer,
          secret
        )
      ).rejects.toThrow(/CBOR decode error/);
    });
  });

  describe('backwards compatability tests', () => {
    it('backwards compatible secp256k1 hex decrypt', async () => {
      // serialize jwk, encrypt and convert to hex
      const legacyEncryptedPK = `0x${Buffer.from(
        encrypt(hexFromJwk(es256kJwk, false), secret),
        'base64'
      ).toString('hex')}`;

      // new create buffer & decryptJwk
      const encryptedPublicKey = Buffer.from(legacyEncryptedPK.slice(2), 'hex');
      const decodedJwk = await decodeJwk(
        get2BytesHash(ALG_TYPE.HEX_AES_256),
        encryptedPublicKey,
        secret
      );
      expect(decodedJwk).toEqual({ ...es256kJwk, use: 'sig' });
    });

    it('should be backwards compatible after issuing', async () => {
      // new encryptJwk & convert to hex
      const newKeyAsBuffer = await encodeJwk(
        ALG_TYPE.HEX_AES_256,
        es256kJwk,
        secret
      );
      const newKeyAsHex = `0x${newKeyAsBuffer.toString('hex')}`;

      // legacy covert, decrypt and deserialize
      const encryptedPublicKey = Buffer.from(
        newKeyAsHex.slice(2),
        'hex'
      ).toString('base64');
      const rawKey = decrypt(encryptedPublicKey, secret);
      expect(jwkFromSecp256k1Key(rawKey, false)).toEqual({
        ...es256kJwk,
        use: 'sig',
      });
    });
  });
});
