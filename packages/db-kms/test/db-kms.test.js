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

const { env } = require('@spencejs/spence-config');
const {
  mongoFactoryWrapper,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const console = require('console');
const { ObjectId } = require('mongodb');
const { map, toUpper } = require('lodash/fp');
const {
  generatePositive256BitHexString,
  generateJWAKeyPair,
} = require('@verii/crypto');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { jwtDecode } = require('@verii/jwt');
const { OBJECT_ID_FORMAT } = require('@verii/test-regexes');
const { initDbKms } = require('../src/db-kms');

const config = {
  mongoSecret: '1234567890',
  ...env,
};

describe('db kms', () => {
  let kms;

  beforeAll(async () => {
    await mongoFactoryWrapper('kms', {
      log: console,
      config,
    });
    kms = initDbKms({ config })({ log: console });
    await mongoDb().collection('kms').deleteMany({});
  });

  afterAll(async () => {
    await mongoCloseWrapper();
  });

  const keySpecs = {
    es256: { algorithm: 'ec', curve: 'P-256' },
    secp256k1: { algorithm: 'ec', curve: 'secp256k1' },
    rsa: { algorithm: 'rsa' },
  };
  describe('adding keys', () => {
    it('should add a es256 key', async () => {
      const result = await kms.createKey(keySpecs.es256);
      expect(result).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        ...keySpecs.es256,
        publicJwk: {
          crv: keySpecs.es256.curve,
          kty: toUpper(keySpecs.es256.algorithm),
          x: expect.any(String),
          y: expect.any(String),
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(await kms.exportKeyOrSecret(result.id)).toEqual({
        ...result,
        privateJwk: { ...result.publicJwk, d: expect.any(String) },
      });
    });
    it('should add a secp256k1 key', async () => {
      const result = await kms.createKey(keySpecs.secp256k1);
      expect(result).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        ...keySpecs.secp256k1,
        publicJwk: {
          crv: keySpecs.secp256k1.curve,
          kty: toUpper(keySpecs.secp256k1.algorithm),
          x: expect.any(String),
          y: expect.any(String),
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(await kms.exportKeyOrSecret(result.id)).toEqual({
        ...result,
        privateJwk: { ...result.publicJwk, d: expect.any(String) },
      });
    });
    it('should add a rs256 key', async () => {
      const result = await kms.createKey(keySpecs.rsa);
      expect(result).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        ...keySpecs.rsa,
        publicJwk: {
          e: 'AQAB',
          kty: toUpper(keySpecs.rsa.algorithm),
          n: expect.any(String),
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(await kms.exportKeyOrSecret(result.id)).toEqual({
        ...result,
        privateJwk: {
          ...result.publicJwk,
          d: expect.any(String),
          dp: expect.any(String),
          dq: expect.any(String),
          p: expect.any(String),
          q: expect.any(String),
          qi: expect.any(String),
        },
      });
    });
  });
  describe('importing keys', () => {
    it('should import a es256 key', async () => {
      const keyPair = generateJWAKeyPair(keySpecs.es256);
      const result = await kms.importKey({ ...keyPair, ...keySpecs.es256 });
      expect(result).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        ...keySpecs.es256,
        publicJwk: keyPair.publicKey,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(await kms.exportKeyOrSecret(result.id)).toEqual({
        ...result,
        privateJwk: keyPair.privateKey,
      });
    });
    it('should import a secp256k1 key', async () => {
      const keyPair = generateJWAKeyPair(keySpecs.secp256k1);
      const result = await kms.importKey({ ...keyPair, ...keySpecs.secp256k1 });
      expect(result).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        ...keySpecs.secp256k1,
        publicJwk: keyPair.publicKey,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(await kms.exportKeyOrSecret(result.id)).toEqual({
        ...result,
        privateJwk: keyPair.privateKey,
      });
    });
    it('should import a rs256 key', async () => {
      const keyPair = generateJWAKeyPair(keySpecs.rsa);
      const result = await kms.importKey({ ...keyPair, ...keySpecs.rsa });
      expect(result).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        ...keySpecs.rsa,
        publicJwk: keyPair.publicKey,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(await kms.exportKeyOrSecret(result.id)).toEqual({
        ...result,
        privateJwk: keyPair.privateKey,
      });
    });
  });
  describe('importing secrets', () => {
    it('should import a secret', async () => {
      const secret = generatePositive256BitHexString();
      const result = await kms.importSecret({ secret });
      expect(result).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(await kms.exportKeyOrSecret(result.id)).toEqual({
        ...result,
        secret,
      });
    });
  });
  describe('exporting keys & secrets', () => {
    it('should return null if key or secret not found', async () => {
      await expect(
        kms.exportKeyOrSecret(new ObjectId().toString())
      ).resolves.toBeNull();
    });
  });

  describe('jwt operations', () => {
    let keys;
    let alternativeKeys;
    const payload = { iss: 'http://example.com', user: { id: '1234' } };
    beforeAll(async () => {
      keys = await Promise.all(
        map((keySpec) => kms.createKey(keySpec), Object.values(keySpecs))
      );
      alternativeKeys = await Promise.all(
        map((keySpec) => kms.createKey(keySpec), Object.values(keySpecs))
      );
    });

    describe('signing & verify jwts', () => {
      it('should sign & verify a jwt using a es256 key and be verifiable by the correct key', async () => {
        const result = await kms.signJwt(payload, keys[0].id, {
          alg: 'ES256',
        });
        expect(result).toEqual(expect.any(String));
        expect(jwtDecode(result)).toEqual(expectedDecodedJwt({ alg: 'ES256' }));
        await expect(kms.verifyJwt(result, keys[0].id)).resolves.toEqual(
          expectedDecodedJwt({ alg: 'ES256' })
        );
        await expect(() =>
          kms.verifyJwt(result, alternativeKeys[0].id)
        ).rejects.toThrow(new Error('signature verification failed'));
      });
      it('should sign a jwt using a secp256k1 key and be verifiable by the correct key', async () => {
        const result = await kms.signJwt(payload, keys[1].id, {
          alg: 'ES256K',
        });
        expect(result).toEqual(expect.any(String));
        expect(jwtDecode(result)).toEqual(
          expectedDecodedJwt({ alg: 'ES256K' })
        );
        await expect(kms.verifyJwt(result, keys[1].id)).resolves.toEqual(
          expectedDecodedJwt({ alg: 'ES256K' })
        );
        await expect(() =>
          kms.verifyJwt(result, alternativeKeys[1].id)
        ).rejects.toThrow(new Error('signature verification failed'));
      });
      it('should sign a jwt using a rs256 key and be verifiable by the correct key', async () => {
        const result = await kms.signJwt(payload, keys[2].id, {
          alg: 'RS256',
        });
        expect(result).toEqual(expect.any(String));
        expect(jwtDecode(result)).toEqual(expectedDecodedJwt({ alg: 'RS256' }));
        await expect(kms.verifyJwt(result, keys[2].id)).resolves.toEqual(
          expectedDecodedJwt({ alg: 'RS256' })
        );
        await expect(() =>
          kms.verifyJwt(result, alternativeKeys[2].id)
        ).rejects.toThrow(new Error('signature verification failed'));
      });
    });

    const expectedDecodedJwt = ({ alg }) => ({
      header: { typ: 'JWT', alg },
      payload: { iat: expect.any(Number), ...payload },
    });
  });
});
