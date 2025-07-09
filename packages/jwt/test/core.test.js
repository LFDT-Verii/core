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

const {
  jwtVerify: joseJwtVerify,
  generateKeyPair: joseGenerateKeyPair,
  SignJWT,
  exportJWK,
} = require('jose');
const { omit } = require('lodash/fp');
const { generateKeyPair } = require('@verii/crypto');
const { nanoid } = require('nanoid');
const {
  jwtSign,
  jwtSignSymmetric,
  jwtDecode,
  jwtVerify,
  jwkFromSecp256k1Key,
  hexFromJwk,
  publicKeyFromPrivateKey,
  tamperJwt,
  deriveJwk,
  jwkFromStringified,
  safeJwtDecode,
  toJwk,
} = require('../src/core');
const { generateDocJwt } = require('../index');

describe('JWT Tests', () => {
  let secp256kJoseKeyPair;
  let secp256kKeyPair;
  let es256JoseKeyPair;
  let es256KeyPair;
  let hs384Secret;
  let hs384JoseSecret;
  beforeAll(async () => {
    secp256kJoseKeyPair = await joseGenerateKeyPair('ES256K');
    secp256kKeyPair = {
      privateKey: await exportJWK(secp256kJoseKeyPair.privateKey),
      publicKey: await exportJWK(secp256kJoseKeyPair.publicKey),
    };
    es256JoseKeyPair = await joseGenerateKeyPair('ES256');
    es256KeyPair = {
      privateKey: await exportJWK(es256JoseKeyPair.privateKey),
      publicKey: await exportJWK(es256JoseKeyPair.publicKey),
    };
    hs384Secret = nanoid(64);
    hs384JoseSecret = new TextEncoder().encode(hs384Secret);
  });

  const payload = {
    field: 'value',
  };

  describe('Generate simple JWT', () => {
    it('Should sign HMAC JWTs from generic payload', async () => {
      const genericPayload = { field: 'value' };
      const result = await jwtSign(genericPayload, hs384Secret, {
        alg: 'HS384',
      });
      const verified = await joseJwtVerify(result, hs384JoseSecret);

      expect(verified).toEqual({
        payload: {
          ...payload,
          iat: expect.any(Number),
        },
        protectedHeader: {
          alg: 'HS384',
          typ: 'JWT',
        },
      });
    });

    it('Should generate JWT from generic payload using ES256', async () => {
      const genericPayload = { field: 'value' };
      const result = await jwtSign(genericPayload, es256KeyPair.privateKey, {
        alg: 'ES256',
      });
      const verified = await joseJwtVerify(result, es256JoseKeyPair.publicKey);

      expect(verified).toEqual({
        payload: {
          ...payload,
          iat: expect.any(Number),
        },
        protectedHeader: {
          alg: 'ES256',
          typ: 'JWT',
        },
      });
    });

    it('Should generate JWT from generic payload using secp256k1', async () => {
      const genericPayload = { field: 'value' };
      const result = await jwtSign(genericPayload, secp256kKeyPair.privateKey);
      const verified = await joseJwtVerify(
        result,
        secp256kJoseKeyPair.publicKey
      );

      expect(verified).toEqual({
        payload: {
          ...payload,
          iat: expect.any(Number),
        },
        protectedHeader: {
          alg: 'ES256K',
          typ: 'JWT',
        },
      });
    });

    it('should generate a ed25519 jwt', async () => {
      const edKeyPair = await joseGenerateKeyPair('EdDSA', { crv: 'Ed25519' });
      const privateJwk = await exportJWK(edKeyPair.privateKey);
      const publicJwk = await exportJWK(edKeyPair.publicKey);

      const docJwt = await generateDocJwt({ nonce: '123' }, privateJwk, {
        alg: 'EdDSA',
      });
      expect(docJwt).toMatch(/eyJ0eXAiOiJKV1QiLCJhbG/);
      expect(await jwtVerify(docJwt, publicJwk)).toEqual({
        header: { jwk: publicJwk, alg: 'EdDSA', typ: 'JWT' },
        payload: {
          nonce: '123',
          iat: expect.any(Number),
          nbf: expect.any(Number),
        },
      });
    });
  });

  describe('Generate symmetric JWT', () => {
    const secret =
      'cc7e0d44fd473002f1c42167459001140ec6389b7353f8088f4d9a95f2f596f2';
    const encodedSecret = new TextEncoder().encode(secret);

    it('should generate a simmetric jwt', async () => {
      const result = await jwtSignSymmetric(payload, secret);
      const verified = await joseJwtVerify(result, encodedSecret);
      expect(verified).toEqual({
        payload: {
          ...payload,
        },
        protectedHeader: {
          alg: 'HS256',
        },
      });
    });
  });

  describe('Decode JWT', () => {
    it('Should throw if badly formatted', async () => {
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'ES256K' })
        .sign(secp256kJoseKeyPair.privateKey);

      expect(() => jwtDecode(`break-${jwt}`)).toThrow(Error);
    });

    it('Should decode JWT using secp256k1', async () => {
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'ES256K' })
        .sign(secp256kJoseKeyPair.privateKey);

      const decoded = jwtDecode(jwt);

      expect(decoded).toEqual({
        header: {
          alg: 'ES256K',
          kid: secp256kKeyPair.kid,
        },
        payload,
      });
    });

    it('Should decode JWT using ES256', async () => {
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'ES256' })
        .sign(es256JoseKeyPair.privateKey);

      const decoded = jwtDecode(jwt);

      expect(decoded).toEqual({
        header: {
          alg: 'ES256',
          kid: es256KeyPair.kid,
        },
        payload,
      });
    });

    it('Should decode JWT using HS384', async () => {
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS384' })
        .sign(hs384JoseSecret);

      const decoded = jwtDecode(jwt);

      expect(decoded).toEqual({
        header: {
          alg: 'HS384',
          kid: es256KeyPair.kid,
        },
        payload,
      });
    });
  });

  describe('Safe Decode JWT', () => {
    let jwt;
    beforeAll(async () => {
      jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'ES256K' })
        .sign(secp256kJoseKeyPair.privateKey);
    });

    it('Should return null if badly formatted', async () => {
      expect(safeJwtDecode(`break-${jwt}`)).toBeNull();
    });

    it('Should decode JWT using secp256k1', async () => {
      expect(safeJwtDecode(jwt)).toEqual({
        header: {
          alg: 'ES256K',
          kid: secp256kKeyPair.kid,
        },
        payload,
      });
    });
  });

  describe('Verify JWT', () => {
    it('Should verify JWT using ES256K', async () => {
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'ES256K', typ: 'JWT' })
        .sign(secp256kJoseKeyPair.privateKey);

      const verified = await jwtVerify(jwt, secp256kKeyPair.publicKey);

      expect(verified).toEqual({
        payload,
        header: { alg: 'ES256K', typ: 'JWT' },
      });
    });
    it('Should verify JWT using HS384', async () => {
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS384', typ: 'JWT' })
        .sign(hs384JoseSecret);

      const verified = await jwtVerify(jwt, hs384Secret);

      expect(verified).toEqual({
        payload,
        header: { alg: 'HS384', typ: 'JWT' },
      });
    });

    it("Should permit Iat''s from the near future", async () => {
      const epochNow = Math.floor(Date.now() / 1000);
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'ES256K', typ: 'JWT' })
        .setIssuedAt(epochNow + 90) // add 90 seconds
        .sign(secp256kJoseKeyPair.privateKey);

      const verified = await jwtVerify(jwt, secp256kKeyPair.publicKey);
      expect(verified).toEqual({
        payload: {
          ...payload,
          iat: expect.any(Number),
        },
        header: { typ: 'JWT', alg: 'ES256K' },
      });
    });
  });

  describe('Parse key', () => {
    it('should generate jwks for public keys hexes', () => {
      const secp256kKeyPair1 = generateKeyPair();
      expect(jwkFromSecp256k1Key(secp256kKeyPair1.publicKey, false)).toEqual({
        kty: 'EC',
        crv: 'secp256k1',
        use: 'sig',
        x: expect.any(String),
        y: expect.any(String),
      });
    });

    it('should generate jwks from a pem', () => {
      const key1 =
        '-----BEGIN PUBLIC KEY-----\n' +
        'MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEu7yLD8KSz7SvTO0HBDdudY0VL2iEEEx2\n' +
        'eTEqkg9aRQFbcBzedDgN+MNxGzHHl5PLLP7/zXcNanhJf4jcD9Xguw==\n' +
        '-----END PUBLIC KEY-----';
      const jwk = jwkFromSecp256k1Key(key1, false);
      expect(jwk).toEqual({
        kty: 'EC',
        crv: 'secp256k1',
        use: 'sig',
        x: expect.any(String),
        y: expect.any(String),
      });
    });

    it('should generate jwks for private keys from private key only', () => {
      const secp256kKeyPair1 = generateKeyPair();
      const publicJwk = jwkFromSecp256k1Key(secp256kKeyPair1.publicKey, false);
      expect(jwkFromSecp256k1Key(secp256kKeyPair1.privateKey)).toEqual({
        ...publicJwk,
        d: expect.any(String),
      });
    });

    it('should generate public jwks from private keys', async () => {
      const secp256kKeyPair1 = generateKeyPair();
      const publicJwk = jwkFromSecp256k1Key(secp256kKeyPair1.publicKey, false);
      const publicJwkFromPrivateKey = jwkFromSecp256k1Key(
        secp256kKeyPair1.privateKey,
        false
      );
      const jwt = await jwtSign(
        { message: 'HELLO MR NAUGHTY' },
        jwkFromSecp256k1Key(secp256kKeyPair1.privateKey)
      );
      expect(await jwtVerify(jwt, publicJwkFromPrivateKey)).toEqual(
        await jwtVerify(jwt, publicJwk)
      );
    });

    it('Should fail to verify a modified jwt ', async () => {
      const jwt = await jwtSign(payload, secp256kKeyPair.privateKey);
      await expect(() =>
        jwtVerify(`${jwt}a`, secp256kKeyPair.publicKey)
      ).rejects.toThrow('signature verification failed');
    });

    it('Should fail to verify using the wrong key', async () => {
      const jwt = await jwtSign(payload, secp256kKeyPair.privateKey);
      const key2 = await joseGenerateKeyPair('ES256K');
      const publicJwk = {
        ...(await exportJWK(key2.publicKey)),
        alg: 'secp256k1',
      };
      await expect(async () => jwtVerify(jwt, publicJwk)).rejects.toThrow(
        'signature verification failed'
      );
    });

    it('should convert jwks to hex', () => {
      const { publicKey } = generateKeyPair();
      const publicJwk = jwkFromSecp256k1Key(publicKey, false);
      expect(hexFromJwk(publicJwk, false)).toEqual(publicKey);
    });

    it('Should init JWK key', async () => {
      const { privateKey } = generateKeyPair();
      const jwkKey = jwkFromSecp256k1Key(privateKey);
      const jwt = await jwtSign(payload, jwkKey);
      const verified = await jwtVerify(jwt, jwkKey);

      expect(jwkKey).toEqual({
        kty: 'EC',
        crv: 'secp256k1',
        use: 'sig',
        x: expect.any(String),
        y: expect.any(String),
        d: expect.any(String),
      });

      expect(verified).toEqual({
        payload: {
          ...payload,
          iat: expect.any(Number),
        },
        header: {
          alg: 'ES256K',
          typ: 'JWT',
        },
      });
    });

    it('should verify with a JWK key missing alg', async () => {
      const { privateKey } = generateKeyPair();
      const jwkKey = jwkFromSecp256k1Key(privateKey);
      const jwt = await jwtSign(payload, jwkKey);
      const verified = await jwtVerify(jwt, omit(['alg'], jwkKey));
      expect(verified).toEqual({
        payload: {
          ...payload,
          iat: expect.any(Number),
        },
        header: {
          alg: 'ES256K',
          typ: 'JWT',
        },
      });
    });
  });

  describe('jwk / hex conversions', () => {
    it('should generate jwk for hex public keys', async () => {
      const { publicKey } = generateKeyPair();
      const publicJwk = jwkFromSecp256k1Key(publicKey, false);
      expect(publicJwk).toEqual(expect.any(Object));
    });
    it('should generate hexs for jwk public keys', async () => {
      const { publicKey } = generateKeyPair();
      expect(publicKey).toEqual(
        await hexFromJwk(jwkFromSecp256k1Key(publicKey, false), false)
      );
    });
    it('should generate jwk for hex private keys', async () => {
      const { privateKey } = generateKeyPair();
      const privateJwk = jwkFromSecp256k1Key(privateKey);
      expect(privateJwk).toEqual(expect.any(Object));
    });
    it('should generate hexs for jwk private keys', async () => {
      const { privateKey } = generateKeyPair();
      expect(privateKey).toEqual(
        await hexFromJwk(jwkFromSecp256k1Key(privateKey, true), true)
      );
    });
  });

  describe('public key from private key', () => {
    it('should return hex public key for passed hex private key', () => {
      const { publicKey, privateKey } = generateKeyPair();

      const result = publicKeyFromPrivateKey(privateKey);

      expect(result).toEqual(publicKey);
    });
    it('should return jwk public key for passed jwk private key', () => {
      const { publicKey, privateKey } = generateKeyPair({ format: 'jwk' });

      const result = publicKeyFromPrivateKey(privateKey);

      expect(result).toEqual(publicKey);
    });
  });

  describe('Tamper JWT', () => {
    it('Should tamper a JWT', async () => {
      const genericPayload = { field: 'value' };
      const untamperedJwt = await jwtSign(
        genericPayload,
        secp256kKeyPair.privateKey
      );
      const verified = await jwtVerify(
        untamperedJwt,
        secp256kKeyPair.publicKey
      );

      expect(verified).toEqual(expect.any(Object));
      const tamperedJwt = tamperJwt(untamperedJwt, { foo: 'foo' });
      const func = async () =>
        jwtVerify(tamperedJwt, secp256kKeyPair.publicKey);
      await expect(func()).rejects.toThrowError(
        'signature verification failed'
      );
    });
  });

  describe('deriveJwk from JWT test suite', () => {
    it('Should derive jwk from JWT when jwk is embedded in the header', async () => {
      const { privateKey, publicKey } = generateKeyPair({ format: 'jwk' });
      const jwt = await jwtSign({ foo: 'bar' }, privateKey, {
        jwk: publicKey,
      });
      const derivedJwk = deriveJwk(jwt);
      expect(derivedJwk).toEqual(publicKey);
    });
    it('Should derive jwk when jwk is passed explicitly', async () => {
      const { privateKey, publicKey } = generateKeyPair({ format: 'jwk' });
      const jwt = await jwtSign({ foo: 'bar' }, privateKey);
      const derivedJwk = deriveJwk(jwt, publicKey);
      expect(derivedJwk).toEqual(publicKey);
    });
    it('Should derive jwk when hex is passed explicitly', async () => {
      const { privateKey, publicKey } = generateKeyPair();
      const privateKeyJwk = jwkFromSecp256k1Key(privateKey, true);
      const publicKeyJwk = jwkFromSecp256k1Key(privateKey, false);
      const jwt = await jwtSign({ foo: 'bar' }, privateKeyJwk);
      const derivedJwk = deriveJwk(jwt, publicKey);
      expect(derivedJwk).toEqual(publicKeyJwk);
    });
  });

  describe('jwkFromStringified test suite', () => {
    it('Should deserialize public jwk', async () => {
      const { publicKey } = generateKeyPair({ format: 'jwk' });
      const serializedPublicJwk = JSON.stringify(publicKey);
      const deSerializedPublicJwk = jwkFromStringified(
        serializedPublicJwk,
        false
      );
      expect(publicKey).toEqual(deSerializedPublicJwk);
    });

    it('Should deserialize private jwk', async () => {
      const { privateKey } = generateKeyPair({ format: 'jwk' });
      const serializedPrivateJwk = JSON.stringify(privateKey);
      const deSerializedPrivateJwk = jwkFromStringified(
        serializedPrivateJwk,
        true
      );
      expect(privateKey).toEqual(deSerializedPrivateJwk);
    });
  });

  describe('toJwk test suite', () => {
    it('Should return original public jwk if already a public jwk', async () => {
      const { publicKey } = generateKeyPair({ format: 'jwk' });
      const result = toJwk(publicKey, false);
      expect(result).toEqual(publicKey);
    });

    it('Should return original private jwk if already a private jwk', async () => {
      const { privateKey } = generateKeyPair({ format: 'jwk' });
      const result = toJwk(privateKey, true);
      expect(result).toEqual(privateKey);
    });

    it('Should return equivalent public jwk of a public hex', async () => {
      const { publicKey } = generateKeyPair();
      const result = toJwk(publicKey, false);
      expect(result).toEqual(jwkFromSecp256k1Key(publicKey, false));
    });
    it('Should return equivalent private jwk of a private hex', async () => {
      const { privateKey } = generateKeyPair();
      const result = toJwk(privateKey, true);
      expect(result).toEqual(jwkFromSecp256k1Key(privateKey, true));
    });
  });
});
