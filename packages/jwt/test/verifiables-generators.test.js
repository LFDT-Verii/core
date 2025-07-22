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

const { omit, get } = require('lodash/fp');
const { credentialUnexpired } = require('@verii/sample-data');
const { generateJWAKeyPair, KeyAlgorithms } = require('@verii/crypto');
const {
  generateCredentialJwt,
  generatePresentationJwt,
} = require('../src/verifiable-generators');
const { jwtVerify } = require('../src/core');
const {
  minimalJsonLdCredential,
  maximalJsonLdCredential,
} = require('./helpers/minimal-jsonld-credential');

describe('Verifiable Generator Tests', () => {
  const presentation = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://www.w3.org/2018/credImpGuide/v1',
    ],
    id: 'PRESENTATION-ID',
    issuanceDate: get('issuanceDate', credentialUnexpired),
    expirationDate: get('expirationDate', credentialUnexpired),
    type: 'VerifiablePresentation',
    verifiableCredential: [],
    issuer: 'HOLDER-ID',
    verifier: 'VERIFIER-ID',
  };

  describe('Generate credential JWT', () => {
    it('Should generate a ES256K JWT from credential', async () => {
      const keyPair = generateJWAKeyPair({
        algorithm: 'ec',
        curve: 'secp256k1',
      });
      const result = await generateCredentialJwt(
        minimalJsonLdCredential,
        keyPair.privateKey,
        'KEY-ID'
      );
      const verified = await jwtVerify(result, keyPair.publicKey);

      expect(verified).toEqual({
        header: {
          typ: 'JWT',
          kid: 'KEY-ID',
          alg: 'ES256K',
        },
        payload: {
          vc: minimalJsonLdCredential,
          jti: minimalJsonLdCredential.id,
          iss: minimalJsonLdCredential.issuer.id,
          iat: expect.any(Number),
          nbf: expect.any(Number),
        },
      });
    });

    it('Should generate a ES256 JWT from credential', async () => {
      const keyPair = generateJWAKeyPair({ algorithm: 'ec', curve: 'P-256' });
      const result = await generateCredentialJwt(
        minimalJsonLdCredential,
        keyPair.privateKey,
        'KEY-ID',
        KeyAlgorithms.ES256
      );
      const verified = await jwtVerify(result, keyPair.publicKey);

      expect(verified).toEqual({
        header: {
          alg: KeyAlgorithms.ES256,
          typ: 'JWT',
          kid: 'KEY-ID',
        },
        payload: {
          vc: {
            ...omit(['credentialSubject'], minimalJsonLdCredential),
            credentialSubject: {
              ...get('credentialSubject', minimalJsonLdCredential),
            },
          },
          iat: expect.any(Number),
          nbf: expect.any(Number),
          iss: minimalJsonLdCredential.issuer.id,
          jti: minimalJsonLdCredential.id,
          sub: minimalJsonLdCredential.credentialSubject.id,
        },
      });
    });

    it('Should generate a RS256 JWT from credential', async () => {
      const keyPair = generateJWAKeyPair({ algorithm: 'rsa' });
      const result = await generateCredentialJwt(
        minimalJsonLdCredential,
        keyPair.privateKey,
        'KEY-ID',
        KeyAlgorithms.RS256
      );
      const verified = await jwtVerify(result, keyPair.publicKey);

      expect(verified).toEqual({
        header: {
          alg: KeyAlgorithms.RS256,
          typ: 'JWT',
          kid: 'KEY-ID',
        },
        payload: {
          vc: {
            ...omit(['credentialSubject'], minimalJsonLdCredential),
            credentialSubject: {
              ...get('credentialSubject', minimalJsonLdCredential),
            },
          },
          iat: expect.any(Number),
          nbf: expect.any(Number),
          iss: minimalJsonLdCredential.issuer.id,
          jti: minimalJsonLdCredential.id,
          sub: minimalJsonLdCredential.credentialSubject.id,
        },
      });
    });

    it('Should generate JWT with a sub_jwk if the credential subject contains a jwk field', async () => {
      const keyPair = generateJWAKeyPair({
        algorithm: 'ec',
        curve: 'secp256k1',
      });
      const result = await generateCredentialJwt(
        maximalJsonLdCredential,
        keyPair.privateKey,
        'KEY-ID'
      );
      const verified = await jwtVerify(result, keyPair.publicKey);

      expect(verified).toEqual({
        header: {
          typ: 'JWT',
          kid: 'KEY-ID',
          alg: 'ES256K',
        },
        payload: {
          vc: omit(['credentialSubject.jwk'], maximalJsonLdCredential),
          iat: Date.parse(maximalJsonLdCredential.issuanceDate) / 1000,
          nbf: Date.parse(maximalJsonLdCredential.issuanceDate) / 1000,
          exp: Date.parse(maximalJsonLdCredential.expirationDate) / 1000,
          iss: maximalJsonLdCredential.issuer.id,
          jti: maximalJsonLdCredential.id,
          sub: maximalJsonLdCredential.credentialSubject.id,
          sub_jwk: maximalJsonLdCredential.credentialSubject.jwk,
        },
      });
    });

    it('Should generate JWT from credential for string issuer value', async () => {
      const keyPair = generateJWAKeyPair({
        algorithm: 'ec',
        curve: 'secp256k1',
      });
      const result = await generateCredentialJwt(
        {
          ...minimalJsonLdCredential,
          issuer: minimalJsonLdCredential.issuer.id,
        },
        keyPair.privateKey,
        'KEY-ID'
      );
      const verified = await jwtVerify(result, keyPair.publicKey);

      expect(verified).toEqual({
        header: {
          alg: 'ES256K',
          typ: 'JWT',
          kid: 'KEY-ID',
        },
        payload: {
          vc: {
            ...minimalJsonLdCredential,
            issuer: minimalJsonLdCredential.issuer.id,
          },
          jti: minimalJsonLdCredential.id,
          iss: minimalJsonLdCredential.issuer.id,
          iat: expect.any(Number),
          nbf: expect.any(Number),
        },
      });
    });
  });

  describe('Generate presentation JWT', () => {
    it('Should generate a ES256K presentation JWT', async () => {
      const keyPair = generateJWAKeyPair({
        algorithm: 'ec',
        curve: 'secp256k1',
      });
      const result = await generatePresentationJwt(
        presentation,
        keyPair.privateKey
      );
      const verified = await jwtVerify(result, keyPair.publicKey, {
        complete: true,
      });

      expect(verified).toEqual({
        header: {
          alg: 'ES256K',
          typ: 'JWT',
          jwk: keyPair.publicKey,
        },
        payload: {
          vp: expect.any(Object),
          iat: Date.parse(presentation.issuanceDate) / 1000,
          nbf: Date.parse(presentation.issuanceDate) / 1000,
          exp: Date.parse(presentation.expirationDate) / 1000,
          jti: presentation.id,
          iss: presentation.issuer,
          aud: presentation.verifier,
        },
      });
    });
    it('Should generate a ES256 JWT for the presentation', async () => {
      const keyPair = generateJWAKeyPair({ algorithm: 'ec', curve: 'P-256' });
      const result = await generatePresentationJwt(
        presentation,
        keyPair.privateKey,
        null,
        KeyAlgorithms.ES256
      );
      const verified = await jwtVerify(result, keyPair.publicKey, {
        complete: true,
      });

      expect(verified).toEqual({
        header: {
          alg: KeyAlgorithms.ES256,
          typ: 'JWT',
          jwk: keyPair.publicKey,
        },
        payload: {
          vp: expect.any(Object),
          iat: Date.parse(presentation.issuanceDate) / 1000,
          nbf: Date.parse(presentation.issuanceDate) / 1000,
          exp: Date.parse(presentation.expirationDate) / 1000,
          jti: presentation.id,
          iss: presentation.issuer,
          aud: presentation.verifier,
        },
      });
    });
    it('Should generate a RS256 JWT for a presentation', async () => {
      const keyPair = generateJWAKeyPair({ algorithm: 'rsa' });
      const result = await generatePresentationJwt(
        presentation,
        keyPair.privateKey,
        null,
        KeyAlgorithms.RS256
      );
      const verified = await jwtVerify(result, keyPair.publicKey, {
        complete: true,
      });

      expect(verified).toEqual({
        header: {
          alg: KeyAlgorithms.RS256,
          typ: 'JWT',
          jwk: keyPair.publicKey,
        },
        payload: {
          vp: expect.any(Object),
          iat: Date.parse(presentation.issuanceDate) / 1000,
          nbf: Date.parse(presentation.issuanceDate) / 1000,
          exp: Date.parse(presentation.expirationDate) / 1000,
          jti: presentation.id,
          iss: presentation.issuer,
          aud: presentation.verifier,
        },
      });
    });
  });
});
