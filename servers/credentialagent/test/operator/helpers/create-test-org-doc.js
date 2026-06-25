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

const { generateKeyPair, hexFromJwk } = require('@verii/crypto');

const { nanoid } = require('nanoid/non-secure');

const createOrgDoc = async () => {
  const { privateKey, publicKey } = generateKeyPair({
    format: 'jwk',
  });
  const key = {
    id: '#velocity-key-1',
    publicKeyJwk: publicKey,
    algorithm: 'SECP256K1',
    encoding: 'hex',
    controller: 'did:key:01230123012',
  };

  const did = `did:nanoid:${nanoid(20)}`;
  return {
    orgDoc: {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        {
          '@base': did,
        },
      ],
      id: did,
      alsoKnownAs: ['did:aka:foo'],
      service: [
        {
          id: '#test-service',
          type: 'VlcCareerIssuer_v1',
          credentialTypes: ['CurrentEmploymentPosition'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        },
      ],
      assertionMethod: [key.id],
      verificationMethod: [key],
    },
    orgKey: hexFromJwk(privateKey),
    orgPublicKey: hexFromJwk(publicKey, false),
  };
};
module.exports = {
  createOrgDoc,
};
