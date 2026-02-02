/**
 * Copyright 2023 Velocity Team
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
 */
const { describe, it } = require('node:test');
const { expect } = require('expect');

const { padCharsStart } = require('lodash/fp');
const crypto = require('crypto');
const { HEX_FORMAT, URLSAFE_BASE64_FORMAT } = require('@verii/test-regexes');
const {
  generateKeyPair,
  publicKeyHexToPem,
  generateRandomNumber,
  generatePositive256BitHexString,
  signPayload,
  verifyPayload,
  generateRandomBytes,
  encrypt,
  encryptBuffer,
  decrypt,
  decryptBuffer,
  createCommitment,
  hashAndEncodeHex,
  isStringHex,
  signAndEncodeBase64,
  verifyBase64Signature,
  get2BytesHash,
  calculateDigest,
  initBuildRefreshToken,
  deriveEncryptionSecretFromPassword,
  calcSha384,
  generateJWAKeyPair,
} = require('../src/crypto');

describe('Crypto tests', () => {
  const { publicKey, privateKey } = {
    publicKey:
      '04ceb9d637ad9497fe351de6ac19c467a7efa1db808b65507f65bb9e156e1f0daefe33f91bd815ed3191a0850af94d4ac195faaa24460296848264d320def9fdf6',
    privateKey:
      '2367b74c3d55b9a180a69c6985cc4c18e5bf94844567757156adc65082d61ed3',
  };

  describe('generateRandomBytes', () => {
    const length = 12;
    const result = generateRandomBytes(length);
    expect(result).toEqual(expect.any(Buffer));
    expect(result.toString('hex')).toHaveLength(length * 2);
  });

  it('should generate a random 256 bit string', () => {
    const result = generatePositive256BitHexString();
    expect(result.slice(0, 2)).toEqual('0x');
    expect(result.slice(2)).toEqual(expect.stringMatching(HEX_FORMAT));
  });

  it('create commitment', () => {
    const result = createCommitment(
      Buffer.from('af9d043d9e7879f5fc93febb7baaf0ad7bc98ce4', 'hex'),
    );
    expect(result).toEqual('EiClnKu9zDe5G2fqOO/joEySuuAkfdk6oowSPvKFrf0wGA==');
  });

  describe('encryption', () => {
    it('should encrypt & decrypt', () => {
      const text = '0123456789-/!abcdefg';
      const secret =
        '81F9D21264DBA82B70E4B21241178473320A016ACF5819FB276CBA562A7AD78F';
      const encryptedValue = encrypt(text, secret);
      expect(encryptedValue).toEqual(expect.any(String));
      expect(encryptedValue).not.toEqual(text);
      expect(decrypt(encryptedValue, secret)).toEqual(text);
    });

    it('should encrypt & decrypt buffers', () => {
      const text = '0123456789-/!abcdefg';
      const buffer = Buffer.from(text, 'utf-8');
      const secret =
        '81F9D21264DBA82B70E4B21241178473320A016ACF5819FB276CBA562A7AD78F';
      const encryptedValue = encryptBuffer(buffer, secret);
      expect(encryptedValue).toEqual(expect.any(Buffer));
      expect(encryptedValue).not.toEqual(text);
      expect(decryptBuffer(encryptedValue, secret)).toEqual(buffer);
    });
  });

  describe('generateKeyPair', () => {
    it('should be generate key pairs with default curve', () => {
      const keyPair = generateKeyPair();
      expect(keyPair).toEqual({
        publicKey: expect.any(String),
        privateKey: expect.any(String),
      });
      expect(padCharsStart('0', 64, keyPair.privateKey)).toHaveLength(64);
      expect(keyPair.publicKey).toHaveLength(130);
    });

    it('should be generate key pairs', () => {
      const keyPair = generateKeyPair({
        format: 'jwk',
        curve: 'P-256',
      });
      expect(keyPair).toEqual({
        publicKey: {
          crv: 'P-256',
          kty: 'EC',
          x: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          y: expect.stringMatching(URLSAFE_BASE64_FORMAT),
        },
        privateKey: {
          crv: 'P-256',
          kty: 'EC',
          x: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          y: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          d: expect.stringMatching(URLSAFE_BASE64_FORMAT),
        },
      });
    });

    it('should be generate key pairs as jwks', () => {
      const keyPair = generateKeyPair({ format: 'jwk' });
      expect(keyPair).toEqual({
        publicKey: {
          crv: 'secp256k1',
          kty: 'EC',
          x: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          y: expect.stringMatching(URLSAFE_BASE64_FORMAT),
        },
        privateKey: {
          crv: 'secp256k1',
          kty: 'EC',
          x: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          y: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          d: expect.stringMatching(URLSAFE_BASE64_FORMAT),
        },
      });
    });

    it('should be throw error if curve wrong', () => {
      expect(() =>
        generateKeyPair({
          curve: 'abc',
        }),
      ).toThrow('Invalid EC curve name');
    });
  });

  describe('generateJWAKeyPair', () => {
    it('should generate a secp256k1 key', () => {
      expect(
        generateJWAKeyPair({ algorithm: 'ec', curve: 'secp256k1' }),
      ).toEqual({
        publicKey: {
          crv: 'secp256k1',
          kty: 'EC',
          x: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          y: expect.stringMatching(URLSAFE_BASE64_FORMAT),
        },
        privateKey: {
          crv: 'secp256k1',
          kty: 'EC',
          d: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          x: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          y: expect.stringMatching(URLSAFE_BASE64_FORMAT),
        },
      });
    });

    it('should generate a P-256 key', () => {
      expect(generateJWAKeyPair({ algorithm: 'ec', curve: 'P-256' })).toEqual({
        publicKey: {
          crv: 'P-256',
          kty: 'EC',
          x: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          y: expect.stringMatching(URLSAFE_BASE64_FORMAT),
        },
        privateKey: {
          crv: 'P-256',
          kty: 'EC',
          d: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          x: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          y: expect.stringMatching(URLSAFE_BASE64_FORMAT),
        },
      });
    });

    it('should generate an RSA key', () => {
      expect(generateJWAKeyPair({ algorithm: 'rsa' })).toEqual({
        publicKey: {
          kty: 'RSA',
          n: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          e: expect.stringMatching(URLSAFE_BASE64_FORMAT),
        },
        privateKey: {
          kty: 'RSA',
          n: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          e: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          d: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          dp: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          dq: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          p: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          q: expect.stringMatching(URLSAFE_BASE64_FORMAT),
          qi: expect.stringMatching(URLSAFE_BASE64_FORMAT),
        },
      });
    });
  });
  describe('pem / hex conversions', () => {
    it('should generate pems for hex public keys', () => {
      expect(publicKeyHexToPem(publicKey)).toEqual(
        expect.stringContaining('BEGIN PUBLIC KEY'),
      );
    });
  });

  it('Should return a random number with with 1 digit', async () => {
    const number = await generateRandomNumber(1);
    expect(number.toString()).toHaveLength(1);
  });

  it('Should return a random number with with 6 digit', async () => {
    const number = await generateRandomNumber(6);
    expect(number.toString()).toHaveLength(6);
  });

  describe('signing and verifying object payloads', () => {
    it('should sign and verify a object payload', () => {
      const payload = { message: 'TEST MESSAGE' };
      const signature = signPayload(payload, privateKey);
      expect(signature).toEqual(
        // eslint-disable-next-line max-len
        '304502202f13bea623e1ff6c9ca5e75ef47761e9e42f669cbe504f2b51f3ee59f407f72a022100e0ec7879886ec6333a0a17348ff1cd29dc68a1a73ac822ca0fc55f588a85b98d',
      );
      const verifiedPayload = verifyPayload(payload, signature, publicKey);
      expect(verifiedPayload).toEqual(true);
    });

    it('should sign and fail to verify a object payload', () => {
      const { publicKey: fakePublicKey } = generateKeyPair();
      const payload = { message: 'TEST MESSAGE' };
      const signature = signPayload(payload, privateKey);
      const verifiedPayload = verifyPayload(payload, signature, fakePublicKey);
      expect(verifiedPayload).toEqual(false);
    });
  });

  describe('string format validation', () => {
    it('should properly recognize a string of hex characters', () => {
      const longHexStr = `${publicKey}${publicKey}${publicKey}`;
      expect(isStringHex(longHexStr)).toEqual(true);
    });
    it('should properly recognize a string of containing non-hex characters', () => {
      expect(isStringHex('g')).toEqual(false);
    });
  });

  describe('signing and verifying string payloads', () => {
    it('should sign and verify a string payload', () => {
      const { publicKey: publicKeyHex, privateKey: privateKeyHex } =
        generateKeyPair({ format: 'hex' });
      const payload = JSON.stringify({ message: 'TEST MESSAGE' });
      const signature = signAndEncodeBase64(payload, privateKeyHex);
      expect(signature).toBeDefined();

      const isSignatureValid = crypto
        .createVerify('SHA256')
        .update(payload)
        .verify(
          publicKeyHexToPem(publicKeyHex),
          Buffer.from(signature, 'base64'),
        );

      expect(isSignatureValid).toBe(true);
    });

    it('should sign and does not verify a payload', () => {
      const { publicKey: publicKeyHex, privateKey: privateKeyHex } =
        generateKeyPair({ format: 'hex' });

      const payload = JSON.stringify({ message: 'TEST MESSAGE' });
      const signature = signAndEncodeBase64(payload, privateKeyHex);
      expect(signature).toBeDefined();

      const isSignatureValid = crypto
        .createVerify('SHA256')
        .update(JSON.stringify({ message: 'TEST MESSAGE 2' }))
        .verify(
          publicKeyHexToPem(publicKeyHex),
          Buffer.from(signature, 'base64'),
        );
      expect(isSignatureValid).toBe(false);
    });
  });

  describe('verifying signed string payloads', () => {
    it('should verify a string payload', () => {
      const { publicKey: publicKeyHex, privateKey: privateKeyHex } =
        generateKeyPair({ format: 'hex' });
      const payload = JSON.stringify({ message: 'TEST MESSAGE' });
      const signature = signAndEncodeBase64(payload, privateKeyHex);
      expect(signature).toBeDefined();

      const isSignatureValid = verifyBase64Signature(
        payload,
        signature,
        publicKeyHex,
      );

      expect(isSignatureValid).toBe(true);
    });

    it('should sign and does not verify a payload', () => {
      const { publicKey: publicKeyHex, privateKey: privateKeyHex } =
        generateKeyPair({ format: 'hex' });
      const payload = JSON.stringify({ message: 'TEST MESSAGE' });
      const signature = signAndEncodeBase64(payload, privateKeyHex);
      expect(signature).toBeDefined();

      const isSignatureValid = verifyBase64Signature(
        JSON.stringify({ message: 'TEST MESSAGE 2' }),
        signature,
        publicKeyHex,
      );
      expect(isSignatureValid).toBe(false);
    });
  });

  describe('get2BytesHash test suite', () => {
    it('should return 2 bytes hash', () => {
      const value = '1234567890';
      const result = get2BytesHash(value);
      expect(result).toEqual('0xc775');
    });

    it('should return error if value is null or undefined', () => {
      expect(() => get2BytesHash(null)).toThrow();
      expect(() => get2BytesHash()).toThrow();
    });
  });

  describe('calculateDigest test suite', () => {
    it('should return a digest', () => {
      const value = '1234567890';
      const result1 = calculateDigest('sha384', 'base64')(value);
      const result2 = calculateDigest('sha256', 'hex')(value);
      expect(result1).toEqual(
        '7YRfi08qbV2oajvskDUtkW1qZuNCDXIOFkOa3yOPEpGCyMZPxOyMHmUGvCtIiLr5',
      );
      expect(result2).toEqual(
        'c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646',
      );
    });

    it('should return error if value is null or undefined', () => {
      expect(() => calculateDigest('sha384', 'base64')(null)).toThrow();
      expect(() => calculateDigest('sha384', 'base64')()).toThrow();
    });

    it('should return error if value is not a string', () => {
      expect(() => calculateDigest('sha384', 'base64')(123)).toThrow();
    });
  });

  describe('initBuildRefreshToken test suite', () => {
    it('should return a function that creates a default refresh token of 64 bytes', async () => {
      const buildRefreshToken = initBuildRefreshToken();
      expect(buildRefreshToken()).toHaveLength(128);
    });
    it('should use input param to override the dfault token length', async () => {
      const buildRefreshToken = initBuildRefreshToken(256);
      expect(buildRefreshToken()).toHaveLength(64);
    });
  });

  describe('deriveEncryptionSecretFromPassword test suite', () => {
    it('value should be encrypted properly and decrypted properly with argon2 derived secret', async () => {
      const password = '12345678901234567890';
      const secret = await deriveEncryptionSecretFromPassword(password);
      const value = 'foo';
      const encryptedValue = encrypt(value, secret);
      const decryptedValue = decrypt(encryptedValue, secret);
      expect(decryptedValue).toEqual('foo');
    });
    it('previously encrypted value should be decrypted properly with argon2 derived secret', async () => {
      const password = '12345678901234567890';
      const secret = await deriveEncryptionSecretFromPassword(password);
      const encryptedValue =
        'dbKpLjElHE10BHG9xmt91NQgG5VG6p9d+7aSPA/fBiP0+4Lk93jP8sVZmAIgPzg8IyUJ17JpslmvBeV0N1vL9uX4AFQQHOFisyjYXJ6S+pcdHUJTPjeh7av62kPd0G5zAL9C';
      const decryptedValue = decrypt(encryptedValue, secret);
      expect(decryptedValue).toEqual('foo');
    });
  });

  describe('calcSha384 test suite', () => {
    it('should generate expected hashes for empty string', async () => {
      const emptyHash =
        'OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb';
      const password = '';
      const hash = calcSha384(password);
      const hash2 = calcSha384(password);
      expect(hash).toEqual(hash2);
      expect(hash).toEqual(emptyHash);
    });

    it('should generate expected hashes for input', async () => {
      const input = 'ug4XrPIdz1_iKlLM';
      const expectedHash =
        'PUcB2FoaCjr+YaDJj+6rwzysqtnp0ZBlDfFknJUb9gD0IF9quMsPtszc5+uN3VCW';
      const hash = calcSha384(input);
      expect(hash).toEqual(expectedHash);
    });
  });

  describe('hashAndEncodeHex test suite', () => {
    it('should generate expected hashes for input', async () => {
      const input = 'ug4XrPIdz1_iKlLM';
      const expectedHash =
        'ff34897e0531e94720472a9fbed8af22bbe0438b623a661f738622bac53e1aa9';
      const hash = hashAndEncodeHex(input);
      expect(hash).toEqual(expectedHash);
    });
  });
});
