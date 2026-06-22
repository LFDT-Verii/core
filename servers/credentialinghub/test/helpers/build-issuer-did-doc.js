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
const { map } = require('lodash/fp');
const {
  generateKeyPair,
  KeyAlgorithms,
  KeyEncodings,
  KeyPurposes,
} = require('@verii/crypto');
const { nanoid } = require('nanoid/non-secure');
const { mapWithIndex } = require('@verii/common-functions');

const buildIssuerDidDoc = (options = {}) =>
  buildDidDoc({
    ...options,
    service: [
      {
        id: '#test-service',
        type: 'VlcCareerIssuer_v1',
        credentialTypes: ['CurrentEmploymentPosition'],
        serviceEndpoint: 'https://agent.samplevendor.com/acme',
      },
    ],
  });

const PURPOSES = [
  KeyPurposes.DLT_TRANSACTIONS,
  KeyPurposes.EXCHANGES,
  KeyPurposes.ISSUING_METADATA,
];

const buildDidDoc = ({
  didMethod = 'ion',
  service = [],
  keyPerPurpose = false,
}) => {
  const purposes = keyPerPurpose
    ? map((purpose) => [purpose], PURPOSES)
    : [PURPOSES];

  const keyPairs = map(() => generateKeyPair({ format: 'jwk' }), purposes);
  const keys = mapWithIndex(
    ({ publicKey }, index) => ({
      id: `#velocity-key-${index}`,
      publicKeyJwk: publicKey,
      type: 'JsonWebKey2020',
      controller: 'did:key:01230123012',
    }),
    keyPairs,
  );

  return {
    didDoc: {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: `did:${didMethod}:${nanoid(20)}`,
      service,
      assertionMethod: map('id', keys),
      verificationMethod: keys,
    },
    keys: mapWithIndex(
      (purpose, index) => ({
        purposes: purpose,
        algorithm: KeyAlgorithms.SECP256K1,
        encoding: KeyEncodings.JWK,
        kidFragment: keys[index].id,
        jwk: keyPairs[index].privateKey,
      }),
      purposes,
    ),
  };
};
module.exports = {
  buildIssuerDidDoc,
};
