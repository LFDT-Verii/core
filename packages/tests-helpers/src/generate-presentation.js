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

const { generateKeyPair } = require('@verii/crypto');
const { mapWithIndex } = require('@verii/common-functions');
const {
  castArray,
  map,
  merge,
  pick,
  set,
  values,
  unset,
  slice,
  size,
} = require('lodash/fp');
const { nanoid } = require('nanoid/non-secure');
const {
  generateDocJwt,
  generateCredentialJwt,
  generatePresentationJwt,
} = require('@verii/jwt');

const phonePayload = {
  sub: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
    issuer: { id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa' },
    issuanceDate: '2020-08-17T11:27:06.000Z',
    type: ['PhoneV1.0', 'VerifiableCredential'],
    credentialSubject: {
      phone: '+447309917830',
    },
  },
};

const { privateKey } = generateKeyPair();

const generateSimpleKYCPresentation = (idDocTypes, options) => {
  const idCredentials = {
    phone: phonePayload,
  };

  const selectedCredentials = idDocTypes
    ? pick(castArray(idDocTypes), idCredentials)
    : values(idCredentials);

  return doSimpleGeneratePresentation(
    selectedCredentials,
    'fooDefinitionId',
    options
  );
};

const doSimpleGeneratePresentation = async (
  credentials,
  definitionId,
  options = { isBrokeVCS: false }
) => {
  const signedCredentials = await Promise.all(
    map((c) => generateCredentialJwt(c, privateKey), credentials)
  );

  const presentation = {
    id: nanoid(),
    verifiableCredential: options.isBrokeVCS
      ? [
          ...slice(0, 1, signedCredentials),
          ...Array(size(signedCredentials) - 1).fill(''),
        ]
      : signedCredentials,
    presentation_submission: {
      id: nanoid(),
      definition_id: definitionId,
      descriptor_map: mapWithIndex(
        (c, i) => ({
          id: nanoid(),
          path: `$.verifiableCredential[${i}]`,
          format: 'jwt_vc',
        }),
        signedCredentials
      ),
    },
  };

  return {
    presentation,
    credentials,
    override(overrides) {
      return merge(this, { presentation: overrides });
    },
    delete(key) {
      return set('presentation', unset(key, this.presentation), this);
    },
    sign(kid, personPrivateKey, issuer = 'https://self-issued.me') {
      return generateDocJwt(this.presentation, personPrivateKey, {
        issuer,
        kid,
        aud: this.presentation.aud,
        jti: nanoid(),
      });
    },
    selfSign() {
      return generatePresentationJwt(this.presentation, privateKey);
    },
  };
};

module.exports = {
  generateSimpleKYCPresentation,
  phonePayload,
};
