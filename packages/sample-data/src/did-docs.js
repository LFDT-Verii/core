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

/* eslint-disable max-len */
const rootPublicKey =
  '045bd3f1454612a4e347d5f3cf480df49ec318b4d0a9259082eac24517dd9ea42dbff53333c540c56c1b3d06d9c0a1dd591da0cfe4d33389a68c9ab7236ba924a2';

const rootPrivateKey =
  '071d76d6395c725960f2f6343bd26cc56173679b3ae33292d99d7abc289832bf';

const intermediatePublicKey =
  '043cc5ef517c60500744a256aa0209949f133ce3e618cef911dedc17cd9b1c9e675428824ecc60788204bd401eb76a65b573149f7f9161502e272ed496148adc77';

const intermediatePrivateKey =
  'd6f6ab857dee5a130f60fd031df969f366242e4607b083e572a8f17f31186708';

const credentialMetadata = {
  '@context': 'https://www.w3.org/ns/did/v1',
  id: 'did:velocity:leafcredentialmetadata1234567890',
  controller: 'did:velocity:intermediateissuer1234567890',
  assertionMethod: ['did:velocity:leafcredentialmetadata1234567890#key-1'],
  publicKey: [
    {
      id: 'did:velocity:leafcredentialmetadata1234567890#key-1',
      type: 'EcdsaSecp256k1VerificationKey2019',
      controller: 'did:velocity:leafcredentialmetadata1234567890',
      publicKeyBase58: 'ApBjX2aK1oUjPTSixmVSEkrVAyG9HozpwQbBOFpvbbbb',
    },
  ],
  service: [
    {
      type: 'VlcCredentialMetadata_v1',
      credentialType: 'EducationDegree',
    },
  ],
  created: '2002-10-12T17:00:00.000Z',
  updated: '2002-10-12T17:00:00.000Z',
  proof: {
    type: 'EcdsaSecp256k1Signature2019',
    proofPurpose: 'assertionMethod',
    verificationMethod: 'did:velocity:intermediateissuer1234567890#key-1',
    created: '2002-10-11T17:20:20.000Z',
    jws: '304502203553ae56095eebd053ce58b77816fdb149a5c73a3b8bc63d748433e522a35974022100feaab876ee1bc8b888fe539aac27ef78f3e1d108eebb3d08b9c91f53b0a4708e',
  },
};

const intermediateIssuer = {
  '@context': 'https://www.w3.org/ns/did/v1',
  id: 'did:velocity:intermediateissuer1234567890',
  controller: 'did:velocity:9876543210vnfvnfvnfvnf',
  assertionMethod: ['did:velocity:intermediateissuer1234567890#key-1'],
  publicKey: [
    {
      id: 'did:velocity:intermediateissuer1234567890#key-1',
      type: 'EcdsaSecp256k1VerificationKey2019',
      controller: 'did:velocity:intermediateissuer1234567890',
      publicKeyBase58:
        '2f6e7ohy35nehweKsvKbQ7u3P5xigFQpq4tnmi4NxrKjLmfPsTKdjxqozTw8uozhjrMe5MK1G62RBgquJRVsjFt82TKTmbfcGvAfEBJd7CokZx8qheRhgdCCMZo6yPTjUcdEZLbXHcwEthjAsYwoDAbs1LgK6ZSKA4EUxee5zDQL1gAydQ',
    },
  ],
  service: [
    {
      type: 'BasicProfileInformation',
      name: 'Intermediate Issuer',
      logo: 'https://intermediateissuer.com/logo.png',
      location: {
        countryCode: 'US',
        regionCode: 'TX',
      },
      founded: 2008,
    },
    {
      id: 'did:velocity:1234567890abcdefghijklmnop#credentialagent-1',
      type: 'VelocityCredentialAgent_v1.0',
      credentialTypes: ['CurrentEmploymentPosition', 'PastEmploymentPosition'],
      serviceEndpoint: 'https://agent.samplevendor.com/acme',
    },
  ],
  created: '2002-10-12T17:00:00.000Z',
  updated: '2002-10-12T17:00:00.000Z',
  proof: {
    type: 'EcdsaSecp256k1Signature2019',
    proofPurpose: 'assertionMethod',
    verificationMethod: 'did:velocity:rootissuer1234567890#key-1',
    created: '2002-10-11T17:20:20Z',
    jws: '3046022100d2c96f75eb5079c906b6bf5be52f929bac822fc61590619552ae534e29f07a38022100d415ab42be83213090a08eb64042fa586dcfe997465c2d21767cc2bfb06806fc',
  },
};

const rootIssuer = {
  '@context': 'https://www.w3.org/ns/did/v1',
  id: 'did:velocity:rootissuer1234567890',
  controller: 'did:velocity:9876543210vnfvnfvnfvnf',
  assertionMethod: ['did:velocity:rootissuer1234567890#key-1'],
  publicKey: [
    {
      id: 'did:velocity:rootissuer1234567890#key-1',
      type: 'EcdsaSecp256k1VerificationKey2019',
      controller: 'did:velocity:rootissuer1234567890',
      publicKeyBase58:
        '2f6eKer4QABNcVgJE6ACtcM8d5ELjDZYDkSLBZH4YQ6zGADr8nPFh5y4RRTBHrScj5CyYJ1Hzcmav5peEMbqr1D2tDA7WGiLEDzXArTHvAYjC79WqRWL7RridWZtQapAr6VsqKENMYiyAFyECUogn5n9zrjAn7Cf2oEunoJAHjoNEje8G9',
    },
  ],
  service: [
    {
      id: 'did:velocity:1234567890abcdefghijklmnop#credentialagent-1',
      type: 'VelocityCredentialAgent_v1.0',
      credentialTypes: ['CurrentEmploymentPosition', 'PastEmploymentPosition'],
      serviceEndpoint: 'https://agent.samplevendor.com/acme',
    },
  ],
  created: '2002-10-12T17:00:00.000Z',
  updated: '2002-10-12T17:00:00.000Z',
  proof: {
    type: 'EcdsaSecp256k1Signature2019',
    proofPurpose: 'assertionMethod',
    verificationMethod: 'did:velocity:rootissuer1234567890#key-1',
    created: '2002-10-11T17:20:20Z',
    jws: '3045022100d396dc06437a16ccaef988c2ddc8be66f6bdda945830ef211ea413b3fae3755e022076666ec6ff1b56ba4957c3fe56ee342fd6275e4b0693a8fae5c6591c214cd317',
  },
};

const templateIssuer = {
  '@context': 'https://www.w3.org/ns/did/v1',
  controller: 'did:velocity:9876543210vnfvnfvnfvnf',
  assertionMethod: ['did:velocity:rootissuer1234567890#key-1'],
  publicKey: [
    {
      id: 'did:velocity:rootissuer1234567890#key-1',
      type: 'EcdsaSecp256k1VerificationKey2019',
      controller: 'did:velocity:rootissuer1234567890',
      publicKeyBase58:
        '2f6eKer4QABNcVgJE6ACtcM8d5ELjDZYDkSLBZH4YQ6zGADr8nPFh5y4RRTBHrScj5CyYJ1Hzcmav5peEMbqr1D2tDA7WGiLEDzXArTHvAYjC79WqRWL7RridWZtQapAr6VsqKENMYiyAFyECUogn5n9zrjAn7Cf2oEunoJAHjoNEje8G9',
    },
  ],
  created: '2002-10-12T17:00:00.000Z',
  updated: '2002-10-12T17:00:00.000Z',
  proof: {
    type: 'EcdsaSecp256k1Signature2019',
    proofPurpose: 'assertionMethod',
    verificationMethod: 'did:velocity:rootissuer1234567890#key-1',
    created: '2002-10-11T17:20:20.000Z',
    jws: '3045022100d396dc06437a16ccaef988c2ddc8be66f6bdda945830ef211ea413b3fae3755e022076666ec6ff1b56ba4957c3fe56ee342fd6275e4b0693a8fae5c6591c214cd317',
  },
};

module.exports = {
  rootPublicKey,
  rootPrivateKey,
  intermediatePublicKey,
  intermediatePrivateKey,
  credentialMetadata,
  intermediateIssuer,
  rootIssuer,
  templateIssuer,
};
