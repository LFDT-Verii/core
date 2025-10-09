/*
 * Copyright 2024 Velocity Team
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
const { generateKeyPair } = require('@verii/crypto');
const { generateDocJwt, jwtDecode } = require('@verii/jwt');
const { nanoid } = require('nanoid');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { omit } = require('lodash/fp');
const {
  verifyVerifiablePresentationJwt,
} = require('../src/verify-presentation-jwt');

describe('verify presentation jwt', () => {
  describe('verify vnfProtocol v1 presentation', () => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    const payload = { vp: { credentials: [nanoid()] } };
    const options = {
      issuer: 'http://self.issued/me',
      jti: nanoid(),
    };

    it('should verify presentation with jwk', async () => {
      const presentation = await generateDocJwt(
        payload,
        keyPair.privateKey,
        options
      );
      expect(
        await verifyVerifiablePresentationJwt(presentation, {
          vnfProtocolVersion: 1,
        })
      ).toEqual({
        ...payload.vp,
        id: options.jti,
        issuanceDate: expectedIssuanceDate(presentation),
        issuer: {
          id: 'http://self.issued/me',
        },
      });
    });
  });
  describe('verify vnfProtocol v2 presentation', () => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    const didJwk = getDidUriFromJwk(keyPair.publicKey);
    const payload = { vp: { credentials: [nanoid()] } };
    const options = {
      issuer: didJwk,
      jti: nanoid(),
      kid: `${didJwk}#0`,
    };

    it('should verify presentation with kid', async () => {
      const presentation = await generateDocJwt(
        payload,
        keyPair.privateKey,
        options
      );
      expect(
        await verifyVerifiablePresentationJwt(presentation, {
          vnfProtocolVersion: 2,
        })
      ).toEqual({
        ...payload.vp,
        id: options.jti,
        issuanceDate: expectedIssuanceDate(presentation),
        issuer: {
          id: didJwk,
        },
      });
    });

    it('should fail to verify presentation with wrongkid', async () => {
      const wrongKeyPair = generateKeyPair({ format: 'jwk' });
      const presentation = await generateDocJwt(
        payload,
        wrongKeyPair.privateKey,
        options
      );
      await expect(() =>
        verifyVerifiablePresentationJwt(presentation, {
          vnfProtocolVersion: 2,
        })
      ).rejects.toEqual(
        new Error('Malformed jwt_vp property: signature verification failed')
      );
    });

    it('should fail to verify presentation with jwk set', async () => {
      const presentation = await generateDocJwt(
        payload,
        keyPair.privateKey,
        omit(['kid'], options)
      );
      await expect(() =>
        verifyVerifiablePresentationJwt(presentation, {
          vnfProtocolVersion: 2,
        })
      ).rejects.toEqual(new Error('jwt_vp must not be self signed'));
    });
  });
});

const expectedIssuanceDate = (jwt) =>
  new Date(jwtDecode(jwt).payload.iat * 1000).toISOString();
