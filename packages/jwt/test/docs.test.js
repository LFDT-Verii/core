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

const { generateKeyPair } = require('@verii/crypto');
const { generateDocJwt } = require('../src/docs');
const { jwkFromSecp256k1Key, jwtVerify } = require('../src/core');

describe('generate doc jwt', () => {
  const keyPair = generateKeyPair();

  describe('Generate simple JWT', () => {
    it('Should generate JWT from generic payload', async () => {
      const doc = { field: 'value' };
      const issuer = 'did:velocity:issuer';
      const result = await generateDocJwt(doc, keyPair.privateKey, {
        issuer,
        audience: 'something',
      });
      const verified = await jwtVerify(
        result,
        jwkFromSecp256k1Key(keyPair.publicKey, false),
      );

      expect(verified).toEqual({
        payload: {
          ...doc,
          iss: issuer,
          nbf: expect.any(Number),
          iat: expect.any(Number),
          aud: 'something',
        },
        header: {
          typ: 'JWT',
          alg: 'ES256K',
          jwk: {
            crv: 'secp256k1',
            kty: 'EC',
            use: 'sig',
            x: expect.any(String),
            y: expect.any(String),
          },
        },
      });
    });

    it('Should generate JWT  with keyId', async () => {
      const doc = { field: 'value' };
      const issuer = 'did:ethr:issuer';
      const kid = `${issuer}#key-1`;
      const result = await generateDocJwt(doc, keyPair.privateKey, {
        issuer,
        kid,
      });
      const verified = await jwtVerify(
        result,
        jwkFromSecp256k1Key(keyPair.publicKey, false),
      );

      expect(verified).toEqual({
        payload: {
          ...doc,
          iss: issuer,
          nbf: expect.any(Number),
          iat: expect.any(Number),
        },
        header: {
          typ: 'JWT',
          alg: 'ES256K',
          kid,
        },
      });
    });

    it('Should generate JWT with no options sent', async () => {
      const doc = { field: 'value' };
      const result = await generateDocJwt(doc, keyPair.privateKey);
      const verified = await jwtVerify(
        result,
        jwkFromSecp256k1Key(keyPair.publicKey, false),
      );

      expect(verified).toEqual({
        payload: {
          ...doc,
          nbf: expect.any(Number),
          iat: expect.any(Number),
        },
        header: {
          typ: 'JWT',
          alg: 'ES256K',
          jwk: {
            crv: 'secp256k1',
            kty: 'EC',
            use: 'sig',
            x: expect.any(String),
            y: expect.any(String),
          },
        },
      });
    });
  });
});
