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

const { get } = require('lodash/fp');
const { getUnixTime } = require('date-fns/fp');
const { credentialUnexpired } = require('@verii/sample-data');
const { generateKeyPair } = require('@verii/crypto');
const { omit } = require('lodash/fp');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const {
  generateCredentialJwt,
  generatePresentationJwt,
} = require('../src/verifiable-generators');
const {
  decodeCredentialJwt,
  verifyCredentialJwt,
  decodePresentationJwt,
  verifyPresentationJwt,
} = require('../src/verifiable-decoders');
const { jwtDecode, jwkFromSecp256k1Key } = require('../src/core');

describe('Verifiable Decoder Tests', () => {
  const keyPair = generateKeyPair();

  const credential = {
    ...credentialUnexpired,
    credentialSubject: {
      ...credentialUnexpired.credentialSubject,
      id: 'SUBJECT-ID',
    },
  };
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

  describe('Decode credential JWT', () => {
    it('Should decode credential from JWT', async () => {
      const credentialJwt = await generateCredentialJwt(
        credential,
        keyPair.privateKey,
        'KEY-ID'
      );
      const decoded = decodeCredentialJwt(credentialJwt);

      expect(decoded).toEqual(credential);
    });
    it('Should decode credential wrapper from JWT', async () => {
      const credentialJwt = await generateCredentialJwt(
        { vc: credential },
        keyPair.privateKey,
        'KEY-ID'
      );
      const decoded = decodeCredentialJwt(credentialJwt);

      expect(decoded).toEqual(credential);
    });
    it('Should decode issuer credential from JWT when issuer has additional properties besides "id"', async () => {
      const issuer = { id: credential.issuer.id, name: 'name', image: 'image' };
      const credentialJwt = await generateCredentialJwt(
        {
          vc: {
            ...credential,
            issuer,
          },
        },
        keyPair.privateKey,
        'KEY-ID'
      );
      const decoded = decodeCredentialJwt(credentialJwt);

      expect(decoded).toEqual({
        ...credential,
        issuer,
      });
    });
  });

  describe('Verify credential JWT', () => {
    it('Should verify credential from JWT', async () => {
      const credentialJwt = await generateCredentialJwt(
        credential,
        keyPair.privateKey,
        'KEY-ID'
      );
      const decoded = await verifyCredentialJwt(
        credentialJwt,
        keyPair.publicKey
      );

      expect(decoded).toEqual(credential);
    });
    it('Should verify credential wrapper from JWT', async () => {
      const credentialJwt = await generateCredentialJwt(
        { vc: credential },
        keyPair.privateKey,
        'KEY-ID'
      );
      const decoded = await verifyCredentialJwt(
        credentialJwt,
        keyPair.publicKey
      );

      expect(decoded).toEqual(credential);
    });

    it('Should fail verification if key is invalid', async () => {
      const { publicKey: wrongPublicKey } = generateKeyPair();
      const credentialJwt = await generateCredentialJwt(
        { vc: credential },
        keyPair.privateKey,
        'KEY-ID'
      );
      await expect(async () =>
        verifyCredentialJwt(credentialJwt, wrongPublicKey)
      ).rejects.toThrow(new Error('signature verification failed'));
    });
  });

  describe('Decode presentation JWT', () => {
    it('Should decode presentation', async () => {
      const presentationJwt = await generatePresentationJwt(
        presentation,
        keyPair.privateKey
      );
      const jwk = jwkFromSecp256k1Key(keyPair.publicKey, false);

      const decodedPresentationAgnosticJwt = jwtDecode(presentationJwt);
      expect(decodedPresentationAgnosticJwt).toEqual({
        header: {
          alg: 'ES256K',
          jwk,
          typ: 'JWT',
        },
        payload: {
          aud: presentation.verifier,
          exp: getUnixTime(new Date(presentation.expirationDate)),
          iat: getUnixTime(new Date(presentation.issuanceDate)),
          iss: presentation.issuer,
          jti: presentation.id,
          nbf: getUnixTime(new Date(presentation.issuanceDate)),
          vp: {
            ...omit(
              ['id', 'issuer', 'verifier', 'expirationDate'],
              presentation
            ),
          },
        },
      });
      const decodedPresentation = decodePresentationJwt(presentationJwt);
      expect(decodedPresentation).toEqual({
        ...presentation,
        issuer: {
          id: presentation.issuer,
        },
      });
    });

    it('Should decode presentation wrapper', async () => {
      const presentationWrapper = {
        vp: {
          id: '123',
          field: 'value',
        },
      };
      const presentationJwt = await generatePresentationJwt(
        presentationWrapper,
        keyPair.privateKey
      );

      const verified = decodePresentationJwt(presentationJwt);

      expect(verified).toEqual({
        ...presentationWrapper.vp,
        issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
    });
  });

  describe('Verify presentation JWT', () => {
    it('Should verify presentation', async () => {
      const presentationJwt = await generatePresentationJwt(
        presentation,
        keyPair.privateKey
      );
      const verified = await verifyPresentationJwt(presentationJwt);

      expect(verified).toEqual({
        ...presentation,
        issuer: {
          id: presentation.issuer,
        },
      });
    });

    it('Should verify presentation wrapper', async () => {
      const presentationWrapper = {
        vp: {
          id: '123',
          field: 'value',
        },
      };
      const presentationJwt = await generatePresentationJwt(
        presentationWrapper,
        keyPair.privateKey
      );

      const verified = await verifyPresentationJwt(presentationJwt);

      expect(verified).toEqual({
        ...presentationWrapper.vp,
        issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
      });
    });

    it('Presentation should fail verification if key is invalid', async () => {
      const { publicKey: wrongPublicKey } = generateKeyPair();
      const presentationJwt = await generatePresentationJwt(
        presentation,
        keyPair.privateKey
      );

      await expect(async () =>
        verifyPresentationJwt(presentationJwt, wrongPublicKey)
      ).rejects.toThrow(new Error('signature verification failed'));
    });
  });
});
