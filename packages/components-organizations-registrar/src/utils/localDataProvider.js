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

import localStorageDataProvider from 'ra-data-local-storage';

const dataProvider = localStorageDataProvider({
  defaultData: {
    organizations: [
      {
        id: 'did:velocity:0x8fec924d7d2e3c9b8ce63af02d50a28103237b9f',
        didDoc: {
          id: 'did:velocity:0x8fec924d7d2e3c9b8ce63af02d50a28103237b9f',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x8fec924d7d2e3c9b8ce63af02d50a28103237b9f#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x8fec924d7d2e3c9b8ce63af02d50a28103237b9f',
              publicKeyBase58:
                'PqLmXmujCHKMfxQBzdURwB5uRRzZSPrKFbAoNY1osYiRuq7YwqBWsFEBwaFkUJmwcnWUUkNtkNYAaEKtY8ics4ms',
            },
          ],
          assertionMethod: ['did:velocity:0x8fec924d7d2e3c9b8ce63af02d50a28103237b9f#key-1'],
          service: [
            {
              id: 'did:velocity:0x8fec924d7d2e3c9b8ce63af02d50a28103237b9f#velocity-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://stagingagent.velocitycareerlabs.io',
              credentialTypes: ['Badge', 'CurrentEmploymentPosition', 'PastEmploymentPosition'],
            },
          ],
          created: '2021-08-23T06:44:54.307Z',
          updated: '2021-08-23T06:44:54.512Z',
          proof: {
            created: '2021-08-23T06:44:54.512Z',
            jws: '3045022041b1922856fc02caffbe637807c5dcc44820837332eeab8bf12de9877fc8ad82022100849cfa933a7affd4a8f4d39791806c19dd440a1900211f4c1d3b7e3b8e6ff99f',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Orchidée Pharmaceutique',
          location: {
            countryCode: 'FR',
            regionCode: '75',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Orchidee_Pharmaceutique.png',
          founded: '1984',
          did: 'did:velocity:0x8fec924d7d2e3c9b8ce63af02d50a28103237b9f',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x8fec924d7d2e3c9b8ce63af02d50a28103237b9f/resolve-vc/did:velocity:045067bf7befba75af175d2a39ae5b88004f8a31e878e70d445e04ca145daa89fd1f8b10e62df185b90a25b9f1e2d9e4dc7f70ed82f42286bc1f6eeda7e4d2429e',
        },
      },
      {
        id: 'did:velocity:0x9973b0ea0d9cd317ac8a73f281535d21c61c43a3',
        didDoc: {
          id: 'did:velocity:0x9973b0ea0d9cd317ac8a73f281535d21c61c43a3',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x9973b0ea0d9cd317ac8a73f281535d21c61c43a3#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x9973b0ea0d9cd317ac8a73f281535d21c61c43a3',
              publicKeyBase58:
                'SPosdNZU9WFgt7LhvMzr4HT2V4CgHhxEWZJNr9HDfVpzfohkB5kiyK4AcVeQPJv7VEGhbVJ6Ww7AHCka7w6j4xAz',
            },
          ],
          assertionMethod: ['did:velocity:0x9973b0ea0d9cd317ac8a73f281535d21c61c43a3#key-1'],
          service: [
            {
              id: 'did:velocity:0x9973b0ea0d9cd317ac8a73f281535d21c61c43a3#velocity-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              credentialTypes: ['PastEmploymentPosition'],
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2021-08-19T23:03:40.952Z',
          updated: '2021-08-19T23:03:40.965Z',
          proof: {
            created: '2021-08-19T23:03:40.965Z',
            jws: '3045022013ec8e8fe3a53ebbfe86eada497e24a9eaeafe7720c640240b27cae9359cee6702210089cc4c20fb85e4ee36a6412e26ea3385cdd961bf2a80cdf292d825a1518d8a7a',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'ABC Health Services',
          location: {
            countryCode: 'US',
            regionCode: 'NY',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/MCB.png',
          website: 'https://www.abchealth.com',
          contactEmail: 'velocity@abchealth.com',
          founded: '1965-01-01',
          closed: '2020-01-01',
          registrationNumbers: [
            {
              authority: 'DunnAndBradstreet',
              number: '1',
              uri: 'uri://uri',
            },
          ],
          did: 'did:velocity:0x9973b0ea0d9cd317ac8a73f281535d21c61c43a3',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x9973b0ea0d9cd317ac8a73f281535d21c61c43a3/resolve-vc/did:velocity:0497349a1520e64dc357e4d96f2c89201b82f0eda09778cb9d1beeb537a9b7bc1bfce1e4eab3e4ed1d7874a7ca57642b89991701c9216a6c529c860eab90e48f99',
        },
      },
      {
        id: 'did:velocity:0x101395e2f118804caee638df279cfb04f853ab1b',
        didDoc: {
          id: 'did:velocity:0x101395e2f118804caee638df279cfb04f853ab1b',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x101395e2f118804caee638df279cfb04f853ab1b#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x101395e2f118804caee638df279cfb04f853ab1b',
              publicKeyBase58:
                'NeDvYFSFLxRFzobwLC9DYfdkWzSAKZBcDmcn8by5iogPLuGVbXKGX9JsoVGKCz3kYKcdCMBXyTkBWZBN61LButR4',
            },
          ],
          assertionMethod: ['did:velocity:0x101395e2f118804caee638df279cfb04f853ab1b#key-1'],
          service: [
            {
              id: 'did:velocity:0x101395e2f118804caee638df279cfb04f853ab1b#velocity-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              credentialTypes: ['PastEmploymentPosition'],
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2021-08-19T22:25:53.151Z',
          updated: '2021-08-19T22:25:53.162Z',
          proof: {
            created: '2021-08-19T22:25:53.162Z',
            jws: '30450220519ba4c5de23fa4472f9b16af930f6491b99d97ea7c10dee48a5e67ecdf2cc1a022100c9205e97d77db60c15e8a8e828171d642a0019f05ca66b4e0d9f052e30c7c5b4',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'ABC Health Services',
          location: {
            countryCode: 'US',
            regionCode: 'NY',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/MCB.png',
          website: 'https://www.abchealth.com',
          contactEmail: 'velocity@abchealth.com',
          founded: '1965-01-01',
          closed: '2020-01-01',
          registrationNumbers: [
            {
              authority: 'DunnAndBradstreet',
              number: '1',
              uri: 'uri://uri',
            },
          ],
          permittedVelocityServiceCategory: ['Issuer'],
          did: 'did:velocity:0x101395e2f118804caee638df279cfb04f853ab1b',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x101395e2f118804caee638df279cfb04f853ab1b/resolve-vc/did:velocity:04411acd117c35de3b373aecefba5b6f9650d253e9f580c59dac73d0cc97bbe046af530ce99a02706378b0949e899d56306a20afd0c1e41492da1137cda2e331b5',
        },
      },
      {
        id: 'did:velocity:0xbaee1bfc24eaafb8ff31084bffa376c5680e5fd8',
        didDoc: {
          id: 'did:velocity:0xbaee1bfc24eaafb8ff31084bffa376c5680e5fd8',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xbaee1bfc24eaafb8ff31084bffa376c5680e5fd8#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0xbaee1bfc24eaafb8ff31084bffa376c5680e5fd8',
              publicKeyBase58:
                'Nms7fNY9S3oJmHCJo4cnAzX2hpzRWZs8u278FpDLHoh3RZuzSGKawmg72Za3G5mF97ve4KASUSbSZEYs9cbxX2jE',
            },
          ],
          assertionMethod: ['did:velocity:0xbaee1bfc24eaafb8ff31084bffa376c5680e5fd8#key-1'],
          service: [
            {
              id: 'did:velocity:0xbaee1bfc24eaafb8ff31084bffa376c5680e5fd8#velocity-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              credentialTypes: ['VaccinationCertificate-Apr2021'],
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2021-08-19T20:59:15.210Z',
          updated: '2021-08-19T20:59:15.259Z',
          proof: {
            created: '2021-08-19T20:59:15.259Z',
            jws: '3045022100e8bb8dc8c59018f6e49995cf8b579d0732a4b68f5c8e5746338e00946d59dfd902206c8eff9f37a56260f40d369048e5c1bc0a9166b42475c5644635dd2c110be3b1',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'ABC Health Services',
          location: {
            countryCode: 'US',
            regionCode: 'NY',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/MCB.png',
          founded: '1965-01-01',
          did: 'did:velocity:0xbaee1bfc24eaafb8ff31084bffa376c5680e5fd8',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xbaee1bfc24eaafb8ff31084bffa376c5680e5fd8/resolve-vc/did:velocity:040f4bda7bf49b5ebdbde92119ab02c0c07e2e80da2ce897ef72dfdfb927b0bd434cf51cdf84d26bd20be6ca8daf4c4a07f19af12c947f02346d233b7108a44e18',
        },
      },
      {
        id: 'did:velocity:0x73232eda30ab159329c8e3d011c846fe2106ba90',
        didDoc: {
          id: 'did:velocity:0x73232eda30ab159329c8e3d011c846fe2106ba90',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x73232eda30ab159329c8e3d011c846fe2106ba90#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x73232eda30ab159329c8e3d011c846fe2106ba90',
              publicKeyBase58:
                'RCwQRbESmpBi98vj7fuGAeEWCiPpZSxVWcXqG8C7BHC7nSwNWwzpv7r1LhLVzQx9vrmsysUothpRVemaHfkkSs4B',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: '1360 Bug Company',
              registrationNumbers: [
                {
                  authority: 'DunnAndBradstreet',
                  number: '1360',
                  uri: 'http://www.ics.uci.edu/pub/ietf/uri/#Related',
                },
                {
                  authority: 'DunnAndBradstreet',
                  number: '1360',
                  uri: 'http://www.ics.uci.edu/pub/ietf/uri/#Related',
                },
              ],
              logo: 'https://example.com/logo.png',
              location: {
                countryCode: 'BY',
                regionCode: 'MN',
              },
              founded: '2020-03-03',
              closed: '2022-03-03',
              contactEmail: 'example@mail.ru',
              website: 'https://example.com',
            },
            {
              id: 'did:velocity:0x73232eda30ab159329c8e3d011c846fe2106ba90#credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
            {
              id: '#credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: [
                'PastEmploymentPosition',
                'CurrentEmploymentPosition',
                'Course',
                'Badge',
                'Assessment',
                'EducationDegree',
                'Certification',
              ],
            },
          ],
          created: '2021-06-25T16:10:03.072Z',
          updated: '2021-08-16T22:37:10.959Z',
          proof: {
            created: '2021-08-16T22:37:10.959Z',
            jws: '304402206a2b9850474d4283ce116de6b6111c445d1d69abaf9c227787bc3ad6c1faae050220105b6fc29699fefa17175c1fec4a234340969e585c9ffda505c88d41b356e446',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: '1360 Bug Company',
          location: {
            countryCode: 'BY',
            regionCode: 'MN',
          },
          logo: 'https://example.com/logo.png',
          website: 'https://example.com',
          contactEmail: 'example@mail.ru',
          founded: '2020-03-03',
          closed: '2022-03-03',
          registrationNumbers: [
            {
              authority: 'DunnAndBradstreet',
              number: '1360',
              uri: 'http://www.ics.uci.edu/pub/ietf/uri/#Related',
            },
            {
              authority: 'DunnAndBradstreet',
              number: '1360',
              uri: 'http://www.ics.uci.edu/pub/ietf/uri/#Related',
            },
          ],
          permittedVelocityServiceCategory: ['', 'Inspector', 'Issuer'],
          did: 'did:velocity:0x73232eda30ab159329c8e3d011c846fe2106ba90',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x73232eda30ab159329c8e3d011c846fe2106ba90/resolve-vc/did:velocity:04b4bdea495f735b8b7f78700284c785ccb70fb675e0cdeed87fa7992423f9f6b7e16bf2ede61a1d549804233714f867ee7f8211a9773454bdc6ad39489abbb88a',
        },
      },
      {
        id: 'did:velocity:0x823eda875e4c9c9eb78493b5ae3cc9aeabfb8563',
        didDoc: {
          id: 'did:velocity:0x823eda875e4c9c9eb78493b5ae3cc9aeabfb8563',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x823eda875e4c9c9eb78493b5ae3cc9aeabfb8563#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x823eda875e4c9c9eb78493b5ae3cc9aeabfb8563',
              publicKeyBase58:
                'QjgPxTQkpFg8PkKhJDB69Q5RsJFnVqFqoAXp7gogJKEwU8SMDgyXne46jWn5a4yZc2YmUjUxeoXV3cifB2pbSnQf',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0x823eda875e4c9c9eb78493b5ae3cc9aeabfb8563#credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
            {
              type: 'BasicProfileInformation',
              name: 'Bedrock insurance',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Bedrock Insurance.png',
              location: {
                countryCode: 'NL',
                regionCode: 'GR',
              },
              founded: {
                year: 1932,
              },
            },
          ],
          created: '2021-05-11T10:20:01.683Z',
          updated: '2021-05-11T10:20:01.687Z',
          proof: {
            created: '2021-05-11T10:20:01.687Z',
            jws: '3046022100fc1b848060ff01224b3b0df69e7c57fb6a64682111b74767dbadfa91e4bc2cfe022100a5860f942735c8817509b3a66b5e4248488b3f3fa60069c76fdf42b3bc04111d',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Bedrock insurance',
          location: {
            countryCode: 'NL',
            regionCode: 'GR',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Bedrock Insurance.png',
          website: 'https://example.com',
          founded: '1932',
          permittedVelocityServiceCategory: ['Inspector', ''],
          did: 'did:velocity:0x823eda875e4c9c9eb78493b5ae3cc9aeabfb8563',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x823eda875e4c9c9eb78493b5ae3cc9aeabfb8563/resolve-vc/did:velocity:04fc889d0c2e28cafe2054cd7c7f9d4ac549632fb9f9ca84cf91a5e31ffd40e871f4c39a9813dcb70797fd18e7e437ad0e7f31769f13d3ddd87ee514ba4eda61bf',
        },
      },
      {
        id: 'did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3',
        didDoc: {
          id: 'did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3',
              publicKeyBase58:
                'PMTkNxoVFkTUBBmpMRzbAqYs3Eyz629tc8ygpZT6bhu97CJEj7wp2Td7XZvbXwczCXrMpjrjcVqkSJj53s91qkHr',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3#credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              credentialTypes: ['Course', 'EducationDegree', 'Badge'],
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
            {
              type: 'BasicProfileInformation',
              name: 'Universidad de Sant Cugat',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Universidad de  Sant Cugat.png',
              location: {
                countryCode: 'ES',
                regionCode: 'CAT',
              },
              founded: {
                year: 1984,
              },
            },
          ],
          created: '2021-05-11T09:04:42.063Z',
          updated: '2021-05-11T09:04:42.156Z',
          proof: {
            created: '2021-05-11T09:04:42.156Z',
            jws: '3044022015dee490f65679256e9469deaf3006c3a916ac68e7afa34cac1298becdcfc06f02205951e1e7dfa9d2458611f224c50aa80b16c6513b02960edb8bbfdb19602bb749',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Universidad de Sant Cugat',
          location: {
            countryCode: 'ES',
            regionCode: 'CAT',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Universidad de  Sant Cugat.png',
          website: 'https://example.com',
          founded: '1984',
          permittedVelocityServiceCategory: ['Issuer', ''],
          did: 'did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3/resolve-vc/did:velocity:04bef1cce29c93c8b5bc09cf429554c1ae3f8942b3ca4d40d79dd3e1a153344b46fc8b948af9734f077ac019250d9570bcefd6b48f99b910859cfcbcfc9f63121d',
        },
      },
      {
        id: 'did:velocity:0x85aa6652f62be290328fbe8b84e8603323b68b59',
        didDoc: {
          id: 'did:velocity:0x85aa6652f62be290328fbe8b84e8603323b68b59',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x85aa6652f62be290328fbe8b84e8603323b68b59#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x85aa6652f62be290328fbe8b84e8603323b68b59',
              publicKeyBase58:
                'QWG5mF93B8N7myfaepwQpbRuzhkm95DUUCdjGirpPN3dvN3zkew8BbHvdu9WV9sXunyGfj6iM4xzchz7ufqTEjTx',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0x85aa6652f62be290328fbe8b84e8603323b68b59#credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
            {
              type: 'BasicProfileInformation',
              name: 'Rotterdam Bank',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Rotterdam Bank.png',
              location: {
                countryCode: 'NL',
                regionCode: 'ZH',
              },
              founded: {
                year: 1950,
              },
            },
          ],
          created: '2021-05-11T09:03:13.095Z',
          updated: '2021-05-11T09:03:13.139Z',
          proof: {
            created: '2021-05-11T09:03:13.139Z',
            jws: '3044022007d0d3b62dd35a0b509d7c5201bcbd711ba4952ace7f57d3261750feb7b42b780220026da12122095f58066493fca23c540242795b3930b1deda5314237f9729fa3e',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Rotterdam Bank',
          location: {
            countryCode: 'NL',
            regionCode: 'ZH',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Rotterdam Bank.png',
          website: 'https://example.com',
          founded: '1950',
          permittedVelocityServiceCategory: ['Inspector', ''],
          did: 'did:velocity:0x85aa6652f62be290328fbe8b84e8603323b68b59',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x85aa6652f62be290328fbe8b84e8603323b68b59/resolve-vc/did:velocity:04780ad90be13d3358716ae5fb3bec7cd10f35dca9e485127ec8a7a9208427d3a344a504ef8de435137456f1cbe75e9158ea1ecdeb4f0b251e9dd07b10a72b63f6',
        },
      },
      {
        id: 'did:velocity:0xf63cc267f82e1ca403c01a74e5a474470b28e50c',
        didDoc: {
          id: 'did:velocity:0xf63cc267f82e1ca403c01a74e5a474470b28e50c',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xf63cc267f82e1ca403c01a74e5a474470b28e50c#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0xf63cc267f82e1ca403c01a74e5a474470b28e50c',
              publicKeyBase58:
                'S5u6P9rQvXcFZqoMdS8MN6BUZBLx3VYP8BYaz5CkZXY1EgxyVuB7sYUX9VJLzaAAM3nFM27x2aQonPUEgGymDMid',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0xf63cc267f82e1ca403c01a74e5a474470b28e50c#credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
            {
              type: 'BasicProfileInformation',
              name: 'Holland Union Bank',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Holland Union Bank.png',
              location: {
                countryCode: 'NL',
                regionCode: 'GR',
              },
              founded: {
                year: 1922,
              },
            },
          ],
          created: '2021-05-11T09:01:58.464Z',
          updated: '2021-05-11T09:01:58.469Z',
          proof: {
            created: '2021-05-11T09:01:58.469Z',
            jws: '3046022100ee138cc63dd778b0dc71a9b2fdceca24cc6f97d8ccd194fa2c1ef04cea16d13a022100e305bd821578a9392a2d6a641e7eb08891fc2976ec2970d38af94844d261d0af',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Holland Union Bank',
          location: {
            countryCode: 'NL',
            regionCode: 'GR',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Holland Union Bank.png',
          website: 'https://example.com',
          founded: '1922',
          permittedVelocityServiceCategory: ['Inspector', ''],
          did: 'did:velocity:0xf63cc267f82e1ca403c01a74e5a474470b28e50c',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xf63cc267f82e1ca403c01a74e5a474470b28e50c/resolve-vc/did:velocity:0482fab25772f7143cc55103b10951777fe355d8fe1d5cb5755b449270bce3ea86313b113f4af0081cae92d07d09cd9e5da3497d13181ad3a30caf3a6e8d0ba88f',
        },
      },
      {
        id: 'did:velocity:0x754da13ccf0b8a09ab45eeafee400a56ab5788f0',
        didDoc: {
          id: 'did:velocity:0x754da13ccf0b8a09ab45eeafee400a56ab5788f0',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x754da13ccf0b8a09ab45eeafee400a56ab5788f0#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x754da13ccf0b8a09ab45eeafee400a56ab5788f0',
              publicKeyBase58:
                'Na2T39d7tUXdupTQG8Vcmfty9CFjdxVGWnjjMwaqUbUESWu2pWmHHc1tEuw8qYwtm4fPqaH6GvQCiFbmmpk49trH',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0x754da13ccf0b8a09ab45eeafee400a56ab5788f0#credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              credentialTypes: ['Certification'],
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
            {
              type: 'BasicProfileInformation',
              name: 'Education Executive Agency (DUO)',
              logo: 'https://docs.velocitycareerlabs.io/Logos/DUO.png',
              location: {
                countryCode: 'NL',
                regionCode: 'GR',
              },
              founded: {
                year: 1954,
              },
            },
          ],
          created: '2021-05-11T09:00:44.959Z',
          updated: '2021-05-11T09:00:44.963Z',
          proof: {
            created: '2021-05-11T09:00:44.963Z',
            jws: '304502205c98ee7fe811c2a36f6c4a40477ba7d5e8bb7d15603f74faa5ca874109e4fcc7022100bdb7471e9aa2ec96e365b54aed1ff009db26f5fec5100c04959f63959f1a8747',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Education Executive Agency (DUO)',
          location: {
            countryCode: 'NL',
            regionCode: 'GR',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/DUO.png',
          website: 'https://example.com',
          founded: '1954',
          permittedVelocityServiceCategory: ['Issuer', ''],
          did: 'did:velocity:0x754da13ccf0b8a09ab45eeafee400a56ab5788f0',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x754da13ccf0b8a09ab45eeafee400a56ab5788f0/resolve-vc/did:velocity:0438525018bf928207dd276294cce909ceaf9379b9943e994cdd0eed43fef3171d0fc04009a8ad50b29e5643a797e8b19f4742c3cbf2389bc543b2588cb02e817b',
        },
      },
      {
        id: 'did:velocity:0x126f6c5c4906909e623f623bbf45998e83933e63',
        didDoc: {
          id: 'did:velocity:0x126f6c5c4906909e623f623bbf45998e83933e63',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x126f6c5c4906909e623f623bbf45998e83933e63#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x126f6c5c4906909e623f623bbf45998e83933e63',
              publicKeyBase58:
                'Q4fweE5uau1y6zUYigNgy3wyCk6UoNR2MUeADcArUJo72DGA8ipMVParerBHpu1bkeTjNLycbdT4H1nthUNixeeW',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0x126f6c5c4906909e623f623bbf45998e83933e63#credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              credentialTypes: ['EducationDegree', 'Badge', 'Course'],
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
            {
              type: 'BasicProfileInformation',
              name: 'Den Haag University',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Den Haag University.png',
              location: {
                countryCode: 'NL',
                regionCode: 'ZH',
              },
              founded: {
                year: 1961,
              },
            },
          ],
          created: '2021-05-11T08:58:57.030Z',
          updated: '2021-05-11T08:58:57.056Z',
          proof: {
            created: '2021-05-11T08:58:57.056Z',
            jws: '304402206e4236614ef22bc5f5e22d6a17fce0f743adfd0ef0b5a56313188e83c9bfbb4402200bdf274a2b02db47e2ee450d15de46c3ce35567abf2f9ecc6baf211cc9b2f91b',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Den Haag University',
          location: {
            countryCode: 'NL',
            regionCode: 'ZH',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Den Haag University.png',
          website: 'https://example.com',
          founded: '1961',
          permittedVelocityServiceCategory: ['Issuer', ''],
          did: 'did:velocity:0x126f6c5c4906909e623f623bbf45998e83933e63',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x126f6c5c4906909e623f623bbf45998e83933e63/resolve-vc/did:velocity:04b8085a9272815ed3f08d43fe7031c02bc3ba4ce82d4c410abbb82abe88faf79b9d223be464fae203ee773f41005fe9d8fc57813a1804a308b184562d7c5bd6e5',
        },
      },
      {
        id: 'did:velocity:0x67b57899ccb81e4de4b17acb8632b421dd65c056',
        didDoc: {
          id: 'did:velocity:0x67b57899ccb81e4de4b17acb8632b421dd65c056',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x67b57899ccb81e4de4b17acb8632b421dd65c056#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x67b57899ccb81e4de4b17acb8632b421dd65c056',
              publicKeyBase58:
                'Q2FiWANx6JXZnPEV3c7ibqPkjMEBpueW6mpwRFzidqNVoNPLXFa1Yd6Ziwp8RAtepmDVMGWqPzDJnbwCaWSnotwu',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0x67b57899ccb81e4de4b17acb8632b421dd65c056#credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
            {
              id: 'did:velocity:0x67b57899ccb81e4de4b17acb8632b421dd65c056#credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['PastEmploymentPosition', 'CurrentEmploymentPosition', 'Badge'],
            },
            {
              type: 'BasicProfileInformation',
              name: 'Banco de Badalona',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Banco de Badalona.png',
              location: {
                countryCode: 'ES',
                regionCode: 'CAT',
              },
              founded: {
                year: 1955,
              },
            },
          ],
          created: '2021-05-11T08:54:12.152Z',
          updated: '2021-05-11T08:54:12.342Z',
          proof: {
            created: '2021-05-11T08:54:12.342Z',
            jws: '304402207737782436432ddb9bb089eabaedc95b34eaa5b5e602bc4ca98ef72b545c4f1d022018f1476c2f642af0c6e1b13f24d9b8121b7701a98fac8fdf128fc0ba7c77e258',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Banco de Badalona',
          location: {
            countryCode: 'ES',
            regionCode: 'CAT',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Banco de Badalona.png',
          website: 'https://example.com',
          founded: '1955',
          permittedVelocityServiceCategory: ['Inspector', 'Issuer', ''],
          did: 'did:velocity:0x67b57899ccb81e4de4b17acb8632b421dd65c056',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x67b57899ccb81e4de4b17acb8632b421dd65c056/resolve-vc/did:velocity:042f535c5b0605e6889ff668ae3b77f21a745865a8ff891c9a57434fdd6d572645f40bf36ba24f28efe10426a01f3a5d1cadc159dbb15a57feb1299af04e6be7b0',
        },
      },
      {
        id: 'did:velocity:0x97c0de9f82fda633b149d4acea5d3ca1511b6d83',
        didDoc: {
          id: 'did:velocity:0x97c0de9f82fda633b149d4acea5d3ca1511b6d83',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x97c0de9f82fda633b149d4acea5d3ca1511b6d83#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x97c0de9f82fda633b149d4acea5d3ca1511b6d83',
              publicKeyBase58:
                'PjpqZhfxG9Umq12215Nr5NAs3YtkPGr6tfX3g6Vd9whLoKhTVq1scCWnKSnQvNCFU8o4vAjMPS4ujFC8Lm1GPgPm',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Octagon Bank',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Octagon Bank-320px.png',
              location: {
                countryCode: 'UK',
                regionCode: 'ENG',
              },
              founded: {
                year: 1978,
              },
            },
            {
              id: 'did:velocity:0x97c0de9f82fda633b149d4acea5d3ca1511b6d83#velocity-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2021-04-08T13:20:04.054Z',
          updated: '2021-04-08T16:41:20.981Z',
          proof: {
            created: '2021-04-08T16:41:20.981Z',
            jws: '30450221009d95fd178a25708ef3a6e4823d7b7d78faab47bafba9c60fd7e1716119fedada02206dcea0ef4bb3c74c05135d460858400b49d25cb5c463354fc594710a5661c88a',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Octagon Bank',
          location: {
            countryCode: 'UK',
            regionCode: 'ENG',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Octagon Bank-320px.png',
          website: 'https://example.com',
          founded: '1978',
          permittedVelocityServiceCategory: ['', 'Inspector'],
          did: 'did:velocity:0x97c0de9f82fda633b149d4acea5d3ca1511b6d83',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x97c0de9f82fda633b149d4acea5d3ca1511b6d83/resolve-vc/did:velocity:04925d30dcf0109f844154b229e98d4ad152721a038581ba0f004d3206e651653bb366257a25cb662ca563c0c198d4d20e3eed32ecde6ea03b635bf003beeda89d',
        },
      },
      {
        id: 'did:velocity:0x636d7dc91c10720bd79b8d6974fa6d1fdf588597',
        didDoc: {
          id: 'did:velocity:0x636d7dc91c10720bd79b8d6974fa6d1fdf588597',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x636d7dc91c10720bd79b8d6974fa6d1fdf588597#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x636d7dc91c10720bd79b8d6974fa6d1fdf588597',
              publicKeyBase58:
                'QDpTpSuohfy3zUpkQrC9p4i1H6hwerQ9m314g47vAetcTZmXGq6guMef6gqxkMCmwS8HsamqYCs8R8WD4jqTHQcW',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Flaxman Training Center',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Flaxman Training center-320px.png',
              location: {
                countryCode: 'UK',
                regionCode: 'ENG',
              },
              founded: {
                year: 1990,
              },
            },
            {
              id: 'did:velocity:0x636d7dc91c10720bd79b8d6974fa6d1fdf588597#velocity-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Course', 'Badge'],
            },
          ],
          created: '2021-04-08T13:17:44.836Z',
          updated: '2021-04-08T16:40:02.778Z',
          proof: {
            created: '2021-04-08T16:40:02.778Z',
            jws: '3045022100a81deba04cf793727b0c8d04f37fe1ef4237595b95fa2bf6cb391b3196a8723b022001f014765bcf39bdccfd70c2dbf6496e05e01a6f9ec05e92b63da4501fa39eaf',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Flaxman Training Center',
          location: {
            countryCode: 'UK',
            regionCode: 'ENG',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Flaxman Training center-320px.png',
          website: 'https://example.com',
          founded: '1990',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0x636d7dc91c10720bd79b8d6974fa6d1fdf588597',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x636d7dc91c10720bd79b8d6974fa6d1fdf588597/resolve-vc/did:velocity:0480af357e1fb3c1701ce68075462d2e99fbdec05578101b46e234f4dff6be4006811a466f08f37fe702a8fec693d7564e0f48dcec70cc70d0ea8acc078a8b7df0',
        },
      },
      {
        id: 'did:velocity:0xafba2221d9c003acf33c68b22363fd433a76ce66',
        didDoc: {
          id: 'did:velocity:0xafba2221d9c003acf33c68b22363fd433a76ce66',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xafba2221d9c003acf33c68b22363fd433a76ce66#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0xafba2221d9c003acf33c68b22363fd433a76ce66',
              publicKeyBase58:
                'RJ1ZTakaThdPYVyKM9AMGd7NF8jvr4ABpxgM9rbJHor57mA4RCQg93CUDYotRugvHoZUpaGHU64zQsQeqjaAeW2N',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Precheck',
              logo: 'https://docs.velocitycareerlabs.io/Logos/PreCheck_a-Cisive-company.png',
              location: {
                countryCode: 'US',
                regionCode: 'TX',
              },
              founded: {
                year: 1983,
              },
            },
            {
              id: 'did:velocity:0xafba2221d9c003acf33c68b22363fd433a76ce66#velocity-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: [
                'Certification',
                'PastEmploymentPosition',
                'CurrentEmploymentPosition',
              ],
            },
          ],
          created: '2021-04-08T13:16:34.841Z',
          updated: '2021-04-08T16:39:28.551Z',
          proof: {
            created: '2021-04-08T16:39:28.551Z',
            jws: '3046022100c0b3b2e44462b7b4d3d3e04ac78cbd7bb3c9f8ff4aab15136d1c52558e569b9e022100cbd8837da0aba3b7893c5ccd93b000af84dad270481750028f1adc47e45b2acd',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Precheck',
          location: {
            countryCode: 'US',
            regionCode: 'TX',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/PreCheck_a-Cisive-company.png',
          website: 'https://example.com',
          founded: '1983',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0xafba2221d9c003acf33c68b22363fd433a76ce66',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xafba2221d9c003acf33c68b22363fd433a76ce66/resolve-vc/did:velocity:04c1aa41a26b1271d3a5baaedcbbe37e2deabef20b0ed97392d7de0ebfc9d2a37c70eaf786a2a7d55972e394aa9fdfdea9dac09a3919b4e470c5e431a07b57fd64',
        },
      },
      {
        id: 'did:velocity:0x4acd559a568973e9f99705beccc088348f77431d',
        didDoc: {
          id: 'did:velocity:0x4acd559a568973e9f99705beccc088348f77431d',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x4acd559a568973e9f99705beccc088348f77431d#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x4acd559a568973e9f99705beccc088348f77431d',
              publicKeyBase58:
                'R1Sf6jkxPD5KQcJrDo2mgshgZFmQk9iapu6JZJHfR8Lgwg64Jxd5nDXQY3Ji2EqhjQ2St6XYsPQoM2URRhMht1KN',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Wakefield University',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Wakefield University-320px.png',
              location: {
                countryCode: 'UK',
                regionCode: 'ENG',
              },
              founded: {
                year: 1929,
              },
            },
            {
              id: 'did:velocity:0x4acd559a568973e9f99705beccc088348f77431d#velocity-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Course', 'EducationDegree', 'Badge'],
            },
          ],
          created: '2021-04-08T13:14:33.242Z',
          updated: '2021-04-08T16:37:46.646Z',
          proof: {
            created: '2021-04-08T16:37:46.646Z',
            jws: '304502203d4c23894bf9590fcfe02439a74c94edfff57977576a711251011f13d4d3869c022100f8900197af34ad60eea42624e54f5e491d7ff29947d072b8ed7ec4bd3c1bc607',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Wakefield University',
          location: {
            countryCode: 'UK',
            regionCode: 'ENG',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Wakefield University-320px.png',
          website: 'https://example.com',
          founded: '1929',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0x4acd559a568973e9f99705beccc088348f77431d',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x4acd559a568973e9f99705beccc088348f77431d/resolve-vc/did:velocity:04d2f1d7e293cb4e868bb54906e905adf750885e84961d0a001911709640ea1b8f2df6eccd21585dc5adddaefe555fdada77c3aae8d683de7f45d3e2e6b8621e48',
        },
      },
      {
        id: 'did:velocity:0x0b44025529c568865ecc326da3f3178fee67d475',
        didDoc: {
          id: 'did:velocity:0x0b44025529c568865ecc326da3f3178fee67d475',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x0b44025529c568865ecc326da3f3178fee67d475#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x0b44025529c568865ecc326da3f3178fee67d475',
              publicKeyBase58:
                'NRgQjpSEWP6h83FTkdU8THtWLuG8wtGYV47n9j6XyvyxVxqFwp7vCe2F7xQqyHJPMMRsXW2QPJU9wkH2ZTcScmn1',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Wales Trade Bank',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Wales Trade Bank-320px.png',
              location: {
                countryCode: 'UK',
                regionCode: 'WLS',
              },
              founded: {
                year: 1931,
              },
            },
            {
              id: 'did:velocity:0x0b44025529c568865ecc326da3f3178fee67d475#velocity-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2021-04-08T13:10:50.242Z',
          updated: '2021-04-08T16:36:54.666Z',
          proof: {
            created: '2021-04-08T16:36:54.666Z',
            jws: '304402207e2c77d84c4b601587e6b8323dd9d9e88f5a170aea2d19cae53274782df3273f022025b7d2689c54be42b878939fd9bb232bd71e4564537334aaeba150aa98d42da7',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Wales Trade Bank',
          location: {
            countryCode: 'UK',
            regionCode: 'WLS',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Wales Trade Bank-320px.png',
          website: 'https://example.com',
          founded: '1931',
          permittedVelocityServiceCategory: ['', 'Inspector'],
          did: 'did:velocity:0x0b44025529c568865ecc326da3f3178fee67d475',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x0b44025529c568865ecc326da3f3178fee67d475/resolve-vc/did:velocity:049921e60b4238d3b9defadd748aca8588c4d2c93c7f09dfd77bd963ed0c74f7c11c2e3f084e49a925b38af7e9f2701973e32dd33d4dcc64399c162bf437d873f0',
        },
      },
      {
        id: 'did:velocity:0x5b4a5d2fdfdbd34e73904a0c8022ed4c22136add',
        didDoc: {
          id: 'did:velocity:0x5b4a5d2fdfdbd34e73904a0c8022ed4c22136add',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x5b4a5d2fdfdbd34e73904a0c8022ed4c22136add#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x5b4a5d2fdfdbd34e73904a0c8022ed4c22136add',
              publicKeyBase58:
                'PsTUfFXFKQNg82TyFJHWJfnUmwDqf3DN8cRHXbHC8CrxYZFpSiy39yJfHBpyiuNWbxgDfQ2QjG9YBLsb9onhGWgL',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Association of Chartered Certified Accountants',
              logo: 'https://docs.velocitycareerlabs.io/Logos/ACCA.png',
              location: {
                countryCode: 'UK',
                regionCode: 'ENG',
              },
              founded: {
                year: 1904,
              },
            },
            {
              id: 'did:velocity:0x5b4a5d2fdfdbd34e73904a0c8022ed4c22136add#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Certification'],
            },
          ],
          created: '2021-04-08T12:58:42.367Z',
          updated: '2021-04-08T16:35:55.945Z',
          proof: {
            created: '2021-04-08T16:35:55.945Z',
            jws: '3046022100e43741f88fc9c74dd38b2be21d4425c75d0f415664aa05ca4d2ca1992eada622022100c8c98e7f418ce8e6f850c5451dde5e45bd8d6d9c322ff8695e328115b45a9d27',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Association of Chartered Certified Accountants',
          location: {
            countryCode: 'UK',
            regionCode: 'ENG',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/ACCA.png',
          website: 'https://example.com',
          founded: '1904',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0x5b4a5d2fdfdbd34e73904a0c8022ed4c22136add',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x5b4a5d2fdfdbd34e73904a0c8022ed4c22136add/resolve-vc/did:velocity:047dea52b4f39e8060fc2395c6a5040f4031433ceec91ec3ca30bba0c4608ddae8cf506038b205a572a38e7538c924d805777b5a883a735cb0af8fcb5d08dc5456',
        },
      },
      {
        id: 'did:velocity:0x87c2cb074fe18ccfdeff4d93b8bfb3cfa9ea9c3a',
        didDoc: {
          id: 'did:velocity:0x87c2cb074fe18ccfdeff4d93b8bfb3cfa9ea9c3a',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x87c2cb074fe18ccfdeff4d93b8bfb3cfa9ea9c3a#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x87c2cb074fe18ccfdeff4d93b8bfb3cfa9ea9c3a',
              publicKeyBase58:
                'N6jvamogeFkcsWw3Jy6qJRNvZpNU7g8G2r4CtTEykmToEeCiWiwTmwyDC4V9UFKtkZzsAx9v7guPj1eHEeLZ8NZ4',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0x87c2cb074fe18ccfdeff4d93b8bfb3cfa9ea9c3a#credential-agent-issuer-1',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              type: 'VelocityCredentialAgentIssuer_v1.0',
            },
            {
              type: 'BasicProfileInformation',
              name: 'Test_UpdSrv',
              location: {
                countryCode: 'BY',
                regionCode: 'MN',
              },
              founded: {
                year: 2021,
              },
              logo: 'https://example.com/logo.png',
            },
            {
              id: 'velocity-credential-agent-issuer-2',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['CurrentEmploymentPosition', 'PastEmploymentPosition'],
            },
            {
              id: 'credential-agent-provider-1',
              type: 'VelocityCredentialAgentServiceProvider_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['CurrentEmploymentPosition', 'PastEmploymentPosition'],
            },
            {
              id: 'did:velocity:0x87c2cb074fe18ccfdeff4d93b8bfb3cfa9ea9c3a#credential-agent-provider-1',
              type: 'VelocityCredentialAgentServiceProvider_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['PastEmploymentPosition', 'CurrentEmploymentPosition', 'Course'],
            },
          ],
          created: '2021-04-06T10:13:12.835Z',
          updated: '2021-04-07T14:13:32.684Z',
          proof: {
            created: '2021-04-07T14:13:32.685Z',
            jws: '3044022048ee0364918211211916959c3d43d869ce29c0f1ad56b3d44ebcdb67a4ee584f02201a5b42ee070bc924d5f10a776eb968721ce1f47bda8219b5b91855e0a7cb4dd1',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Test_UpdSrv',
          location: {
            countryCode: 'BY',
            regionCode: 'MN',
          },
          logo: 'https://example.com/logo.png',
          website: 'https://example.com',
          founded: '2021',
          permittedVelocityServiceCategory: ['Issuer', ''],
          did: 'did:velocity:0x87c2cb074fe18ccfdeff4d93b8bfb3cfa9ea9c3a',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x87c2cb074fe18ccfdeff4d93b8bfb3cfa9ea9c3a/resolve-vc/did:velocity:04cd12962a144a733afbb082ceaa689a1aac1275fdd8dca5a05f8f48e743af9cbc3c640bddad9867205f2512bafdd6c1ff8ccc34200302b1f52ec4c1bcba7962f4',
        },
      },
      {
        id: 'did:velocity:0x8a4e0530e8b7ea1e9fef3f5f68f686f328d5ca09',
        didDoc: {
          id: 'did:velocity:0x8a4e0530e8b7ea1e9fef3f5f68f686f328d5ca09',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x8a4e0530e8b7ea1e9fef3f5f68f686f328d5ca09#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x8a4e0530e8b7ea1e9fef3f5f68f686f328d5ca09',
              publicKeyBase58:
                'NA8KUuJaSZMttBfw13pLVXPPPsqx8APn9PYHoGEfKAHrsi2fAe1yApaHvjXiQYgsZ7tB46hXjXVWQTgmYX7JnE2j',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              id: 'did:velocity:0x8a4e0530e8b7ea1e9fef3f5f68f686f328d5ca09#credential-agent-holder-app-provider-1',
              type: 'VelocityHolderAppProvider_v1.0',
              credentialTypes: [
                'CurrentEmploymentPosition',
                'PastEmploymentPosition',
                'Course',
                'EducationDegree',
              ],
            },
            {
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              id: 'did:velocity:0x8a4e0530e8b7ea1e9fef3f5f68f686f328d5ca09#credential-agent-notary-issuer-1',
              type: 'VelocityNotaryIssuer_v1.0',
              credentialTypes: [
                'CurrentEmploymentPosition',
                'PastEmploymentPosition',
                'Course',
                'EducationDegree',
              ],
            },
            {
              type: 'BasicProfileInformation',
              name: 'Test.Bus Issuer - samleorganization withtoolongnamefortesting1046task linked to 1085 UI bugs ticket',
              logo: 'https://example.com/logo.png',
              location: {
                countryCode: 'US',
                regionCode: 'NY',
              },
              founded: {
                year: 1987,
              },
            },
            {
              id: 'did:velocity:0x8a4e0530e8b7ea1e9fef3f5f68f686f328d5ca09#credential-agent-issuer-1',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              credentialTypes: [
                'PastEmploymentPosition',
                'CurrentEmploymentPosition',
                'Course',
                'Badge',
                'Assessment',
                'EducationDegree',
              ],
            },
          ],
          created: '2021-04-02T06:21:25.090Z',
          updated: '2021-08-06T11:12:34.774Z',
          proof: {
            created: '2021-08-06T11:12:34.774Z',
            jws: '3046022100eb1966a17fa5c5af85ae6bc4976bc5d1475e12450d3c687cc8d660722ebe8be302210089e5220db0dac5a696c2002b8ef3725dab1cdf334c1075259ac0b411b8866039',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Test.Bus Issuer - samleorganization withtoolongnamefortesting1046task linked to 1085 UI bugs ticket',
          location: {
            countryCode: 'US',
            regionCode: 'NY',
          },
          logo: 'https://example.com/logo.png',
          website: 'https://example.com',
          founded: '1987',
          permittedVelocityServiceCategory: ['HolderAppProvider', 'NotaryIssuer', '', 'Issuer'],
          did: 'did:velocity:0x8a4e0530e8b7ea1e9fef3f5f68f686f328d5ca09',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x8a4e0530e8b7ea1e9fef3f5f68f686f328d5ca09/resolve-vc/did:velocity:0435262fed9688199f544d94332e17489e4e2412b6c6e837b3226cd90b940ce48439b72ffade26167fa0f4dce24c8bd3f3d4add84c94072233c9e7d52078732027',
        },
      },
      {
        id: 'did:velocity:0x531faa2de3ccf428475d087de4d92d8885a724ce',
        didDoc: {
          id: 'did:velocity:0x531faa2de3ccf428475d087de4d92d8885a724ce',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x531faa2de3ccf428475d087de4d92d8885a724ce#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x531faa2de3ccf428475d087de4d92d8885a724ce',
              publicKeyBase58:
                'QVRXLZAuzit9paqRvTznUKr7EX3gXtqBTFcreg1vQqB4iQTftPkrHwDgquTm5GtmHbVhMVcpxR8BzktGP3NCKkAy',
            },
            {
              id: 'did:velocity:0x531faa2de3ccf428475d087de4d92d8885a724ce#key-2',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x531faa2de3ccf428475d087de4d92d8885a724ce',
              publicKeyBase58:
                'RtHfGSMnj8MyW8kVv5d5hkAseJAxMyFbMLuhwgS9RaUwrhcpNtQ6YG8d3noceGHNb1pXNAP3iG12U7P6Eg12rTKg',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Test.Bus',
              logo: 'https://example.com/logo.png',
              location: {
                countryCode: 'BY',
                regionCode: 'MN',
              },
              founded: {
                year: 2021,
              },
            },
            {
              id: 'did:velocity:0x531faa2de3ccf428475d087de4d92d8885a724ce#credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
            {
              id: 'did:velocity:0x531faa2de3ccf428475d087de4d92d8885a724ce#credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: [
                'PastEmploymentPosition',
                'CurrentEmploymentPosition',
                'Course',
                'Badge',
                'Assessment',
                'EducationDegree',
              ],
            },
            {
              id: 'did:velocity:0x531faa2de3ccf428475d087de4d92d8885a724ce#credential-agent-provider-1',
              type: 'VelocityCredentialAgentServiceProvider_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2021-04-01T15:19:24.682Z',
          updated: '2021-07-14T11:03:43.276Z',
          proof: {
            created: '2021-07-14T11:03:43.276Z',
            jws: '304502203054f840b5e0e6b7beb29eb4d6f92aee5e9e59fb3f6d3ac87f4ccfc4c2f11745022100895e0a129238d8310628dc3b995a824b6a53aa20833e8ea50a840b3a1d5a6c58',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Test.Bus',
          location: {
            countryCode: 'BY',
            regionCode: 'MN',
          },
          logo: 'https://example.com/logo.png',
          website: 'https://example.com',
          founded: '2021',
          permittedVelocityServiceCategory: ['', 'Inspector', 'Issuer'],
          did: 'did:velocity:0x531faa2de3ccf428475d087de4d92d8885a724ce',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x531faa2de3ccf428475d087de4d92d8885a724ce/resolve-vc/did:velocity:04cf308229ef69c3534bb58519a3c7c8ef85488c606019aacd952addd2a610da0a84d7e70db854069933ad829e01c619e275be06b0d7fb88521c57c364aa99cac2',
        },
      },
      {
        id: 'did:velocity:0xeb85db0ea07f898777d44ac8664309eccebe0c84',
        didDoc: {
          id: 'did:velocity:0xeb85db0ea07f898777d44ac8664309eccebe0c84',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xeb85db0ea07f898777d44ac8664309eccebe0c84#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0xeb85db0ea07f898777d44ac8664309eccebe0c84',
              publicKeyBase58:
                'MzNEhYPJoVA9c2VXfTBazp5Zc4xiAThdJpffgz5s36WLGknU95iv1it7XSuZhqxjFMF3WSobnpPncbT8V7PmYtrT',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Test.org',
              location: {
                countryCode: 'BY',
                regionCode: 'MN',
              },
              founded: {
                year: 2020,
              },
              logo: 'https://example.com/logo.png',
            },
          ],
          created: '2021-04-01T08:10:22.933Z',
          updated: '2021-04-01T13:53:32.646Z',
          proof: {
            created: '2021-04-01T13:53:32.646Z',
            jws: '304502210096c24d1005fd63153f347de22bb5536c05f4dc051727634b3cd9f1056f6f81b8022002db7e8c61c7e7736fbc1ae33f6dfa323cf5cc943dd89847866a739aacc67345',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Test.org',
          location: {
            countryCode: 'BY',
            regionCode: 'MN',
          },
          logo: 'https://example.com/logo.png',
          website: 'https://example.com',
          founded: '2020',
          permittedVelocityServiceCategory: [''],
          did: 'did:velocity:0xeb85db0ea07f898777d44ac8664309eccebe0c84',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xeb85db0ea07f898777d44ac8664309eccebe0c84/resolve-vc/did:velocity:04e6866cc4b715f5b29af900e150b827f553076699464b199b037e0c758d4e10bab9d6bb82f4b738cfe99b1915f063fe58892353284cc817072f4120016a64335d',
        },
      },
      {
        id: 'did:velocity:0x32c42c283dfe0803dd2b827dd5a0a2b1714aac97',
        didDoc: {
          id: 'did:velocity:0x32c42c283dfe0803dd2b827dd5a0a2b1714aac97',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x32c42c283dfe0803dd2b827dd5a0a2b1714aac97#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x32c42c283dfe0803dd2b827dd5a0a2b1714aac97',
              publicKeyBase58:
                'N6rvmB26Kwd2wThS4z7p5Cb3vPViUoAzh7YqQUGbHZY2PTsPPDY5vvjwaZCrRSuGzRXgDTgJiz27LsU95YehYrjC',
            },
            {
              id: 'did:velocity:0x32c42c283dfe0803dd2b827dd5a0a2b1714aac97#key-2',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x32c42c283dfe0803dd2b827dd5a0a2b1714aac97',
              publicKeyBase58:
                'PYbr51MnEwvVEWF8esohKxLz9v2HKUEyXEcBXvbVvMypfZP7Zc83QynSGWprjwfZuY16NgqJSiiEzXBixtZ75VjN',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Test.org',
              logo: 'https://example.com/logo.png',
              location: {
                countryCode: 'PL',
                regionCode: 'GD',
              },
              founded: {
                year: 1984,
              },
            },
            {
              id: '#credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: [
                'PastEmploymentPosition',
                'CurrentEmploymentPosition',
                'Course',
                'Badge',
                'Assessment',
                'EducationDegree',
                'Certification',
              ],
            },
          ],
          created: '2021-04-01T06:32:36.344Z',
          updated: '2021-07-23T06:42:58.537Z',
          proof: {
            created: '2021-07-23T06:42:58.537Z',
            jws: '30450221008199236656fa185b9de71cae375d9b6a55488c95ae584eab271d4b321b58749902205fc09c585f4b6a7fe9f23209eefdb818dde5387b605aeb53fc8e6e5f37b04d87',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Test.org',
          location: {
            countryCode: 'PL',
            regionCode: 'GD',
          },
          logo: 'https://example.com/logo.png',
          website: 'https://example.com',
          founded: '1984',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0x32c42c283dfe0803dd2b827dd5a0a2b1714aac97',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x32c42c283dfe0803dd2b827dd5a0a2b1714aac97/resolve-vc/did:velocity:0437d912be10aaf5fe7e24f79ffa8a0eec4e615f1ac5e98b463e9b677f64f72e07858e1c3bc26b2813306cee3cfbf934813b70100d57eb0a37f6ef9de5d2249007',
        },
      },
      {
        id: 'did:velocity:0xe59ca17da7afbd6f1aaf8d9c0ee65262ff9a724a',
        didDoc: {
          id: 'did:velocity:0xe59ca17da7afbd6f1aaf8d9c0ee65262ff9a724a',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xe59ca17da7afbd6f1aaf8d9c0ee65262ff9a724a#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0xe59ca17da7afbd6f1aaf8d9c0ee65262ff9a724a',
              publicKeyBase58:
                'MjFiXxcdtYzuxdfFGkHMuG1QXE8aG2Hxz1XakSN1jfY5K95wQs6zAZe591LocU7CPDCjsFES6D9yrB2uxajn9UjB',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0xe59ca17da7afbd6f1aaf8d9c0ee65262ff9a724a#credential-agent-inspector-1',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              type: 'VelocityCredentialAgentInspector_v1.0',
            },
            {
              id: 'did:velocity:0xe59ca17da7afbd6f1aaf8d9c0ee65262ff9a724a#credential-agent-provider-1',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              type: 'VelocityCredentialAgentServiceProvider_v1.0',
            },
            {
              type: 'BasicProfileInformation',
              name: '<Vizi>',
              location: {
                countryCode: 'US',
                regionCode: 'GA',
              },
              founded: {
                year: 2000,
              },
              logo: 'https://example.com/logo.png',
            },
          ],
          created: '2021-03-30T09:37:58.653Z',
          updated: '2021-03-31T14:08:41.831Z',
          proof: {
            created: '2021-03-31T14:08:41.831Z',
            jws: '3045022004344007a38084acbd90ab061e0b00eec3ac0d5552e4b2a70275aa8b54fc887602210084883a80b36c2204b77424ca6a474c3f46a8110dbb3ce298963587c470552f8a',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: '<Vizi>',
          location: {
            countryCode: 'US',
            regionCode: 'GA',
          },
          logo: 'https://example.com/logo.png',
          website: 'https://example.com',
          founded: '2000',
          permittedVelocityServiceCategory: ['Inspector', ''],
          did: 'did:velocity:0xe59ca17da7afbd6f1aaf8d9c0ee65262ff9a724a',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xe59ca17da7afbd6f1aaf8d9c0ee65262ff9a724a/resolve-vc/did:velocity:04fff165d4c552c032ada9ec39ea0aa9a5ec5f868e6b8a9a3f4e5acd88cd7ecf0731aa0afd9ca57af1f3b415bb5a30d29b2bcdea1fdb2ea7e248e27857a7544196',
        },
      },
      {
        id: 'did:velocity:0x83152f626c518d34febfe5ead8d20660d63600f8',
        didDoc: {
          id: 'did:velocity:0x83152f626c518d34febfe5ead8d20660d63600f8',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x83152f626c518d34febfe5ead8d20660d63600f8#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x83152f626c518d34febfe5ead8d20660d63600f8',
              publicKeyBase58:
                'RgtDsgB3VTh66yHQougw3BTGWWBRLeJo4vECXqjD9qmYsbePVKGGLY5LCPbRc8jMdEMbaD2HHnBpQ3UMVULBUbob',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0xcb5240c2669747d6bec163636aaae49b25bb240d#credentialtypes',
              type: 'VelocityCredentialAgentServiceProvider_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
            {
              type: 'BasicProfileInformation',
              name: 'Velocity Testnet Vendor',
              logo: 'https://velocitynetwork.foundation/logo.png',
              location: {
                countryCode: 'US',
                regionCode: 'DE',
              },
              founded: {
                day: 1,
                month: 1,
                year: 2018,
              },
            },
          ],
          created: '2020-09-29T11:41:05.462Z',
          updated: '2020-12-14T14:17:20.180Z',
          proof: {
            created: '2021-01-24T11:39:33.179Z',
            jws: '304502207c242b715e3ba843c2e0e3bf3487487d015e5de94150dcf783d675eadfecea4b022100e27c3540f50869c156355a68f84df80422beb0210fb6f30fa7a70f4bf4a71dce',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Velocity Testnet Vendor',
          location: {
            countryCode: 'US',
            regionCode: 'DE',
          },
          logo: 'https://velocitynetwork.foundation/logo.png',
          website: 'https://example.com',
          founded: '2018-01-01',
          permittedVelocityServiceCategory: [''],
          did: 'did:velocity:0x83152f626c518d34febfe5ead8d20660d63600f8',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x83152f626c518d34febfe5ead8d20660d63600f8/resolve-vc/did:velocity:040ea7b6b5a4d96464e5363b2060e0647813ffc889ea690877a643ef62543eee39fd0c393c289db34f8147bae0ffddbae3151e2adfc8cae913fb3254c2b5f49c37',
        },
      },
      {
        id: 'did:velocity:0x373cecacbac5b6eecbd840e0378c546fbf4c004e',
        didDoc: {
          id: 'did:velocity:0x373cecacbac5b6eecbd840e0378c546fbf4c004e',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x373cecacbac5b6eecbd840e0378c546fbf4c004e#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x373cecacbac5b6eecbd840e0378c546fbf4c004e',
              publicKeyBase58:
                'PV1Cens9KviWdikLTuthbRH95svMF7nRupyuhHvnUgNxbzZmmB3xxqBNRW9f1oQNYuMaERNjefE49M7fjPWh1Jnq',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Apple Inc.',
              logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/200px-Apple_logo_black.svg.png',
              location: {
                countryCode: 'US',
                regionCode: 'AA',
              },
            },
            {
              id: 'did:velocity:0x373cecacbac5b6eecbd840e0378c546fbf4c004e#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: [
                'CurrentEmploymentPosition',
                'PastEmploymentPosition',
                'Certification',
                'Badge',
              ],
            },
            {
              id: 'did:velocity:0x373cecacbac5b6eecbd840e0378c546fbf4c004e#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:06.415Z',
          updated: '2020-11-24T20:52:42.715Z',
          proof: {
            created: '2021-01-24T11:39:33.176Z',
            jws: '3046022100992e4c13b7cd89cd5ffbbf718f9e6a605d860c95416b757d37cd985f8037fb90022100c489d7e0158e782e1bedbfcf0ac05ee39af5d05a0609141ca7283522a2e9c60d',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Apple Inc.',
          location: {
            countryCode: 'US',
            regionCode: 'AA',
          },
          logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/200px-Apple_logo_black.svg.png',
          website: 'https://example.com',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0x373cecacbac5b6eecbd840e0378c546fbf4c004e',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x373cecacbac5b6eecbd840e0378c546fbf4c004e/resolve-vc/did:velocity:04cfef9025e5b9c565bc0bc5f6993008f4bef671a9c3863a57e99c32d7183588c030c604e45a7e59299565a607ebde4b8150ba9d38ef46aa25edce8967c9ab0d9f',
        },
      },
      {
        id: 'did:velocity:0x161975e1b77ed82e18c8ad0c7067dbdaad1703c1',
        didDoc: {
          id: 'did:velocity:0x161975e1b77ed82e18c8ad0c7067dbdaad1703c1',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x161975e1b77ed82e18c8ad0c7067dbdaad1703c1#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x161975e1b77ed82e18c8ad0c7067dbdaad1703c1',
              publicKeyBase58:
                'NaRsgrn5HztSfL6vGcJhxwJqHVDH6C4jaTQgPDQo9nKqE4Q5kPUFgb65ADVEAHhAQnBRi9cdRRnVpTPDVb7KDKXF',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Deutsche Hochschule für Verwaltungswissenschaften Speyer',
              logo: 'https://www.fh-studiengang.de/images/fh-studiengang_mobile_seyeq.jpg',
              location: {
                countryCode: 'DE',
              },
            },
            {
              id: 'did:velocity:0x161975e1b77ed82e18c8ad0c7067dbdaad1703c1#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['EducationDegree', 'Certification'],
            },
            {
              id: 'did:velocity:0x161975e1b77ed82e18c8ad0c7067dbdaad1703c1#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:06.489Z',
          updated: '2020-11-24T20:53:15.932Z',
          proof: {
            created: '2021-01-24T11:39:33.173Z',
            jws: '30460221008c54b747456e66d83472a2e4e40b6467073e22a6343983b99370f56961eb6d4c022100aa1f54781acfc4bfee24a16f8b2e66171b57442abe86e2e7cb8209e0d7d96a1c',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Deutsche Hochschule für Verwaltungswissenschaften Speyer',
          location: {
            countryCode: 'DE',
          },
          logo: 'https://www.fh-studiengang.de/images/fh-studiengang_mobile_seyeq.jpg',
          website: 'https://example.com',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0x161975e1b77ed82e18c8ad0c7067dbdaad1703c1',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x161975e1b77ed82e18c8ad0c7067dbdaad1703c1/resolve-vc/did:velocity:048bac9369a75082613df17be58c68cdca6d35d1af5c40a032847b0117b38e431ab6e8d16d12239b9394328a508dd3aca7395b4cb16c34a51dc24d8b9b7df2889c',
        },
      },
      {
        id: 'did:velocity:0xaae01dc7cad0dc787b9388ed9cf27c480db89a22',
        didDoc: {
          id: 'did:velocity:0xaae01dc7cad0dc787b9388ed9cf27c480db89a22',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xaae01dc7cad0dc787b9388ed9cf27c480db89a22#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xaae01dc7cad0dc787b9388ed9cf27c480db89a22',
              publicKeyBase58:
                'S3vxs7E9Lq4C9ddYbRu5s2nEMEmBLnC8CqQGsXa1WZ4fynxRp3mGqWsuWRKniqcDcQyCnSmBj2KTV7DXfJp17wYM',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Belarusian National Technical University',
              logo: 'https://times.bntu.by/data/uploads/logos/logo_BNTU.png',
              location: {
                countryCode: 'BY',
              },
            },
            {
              id: 'did:velocity:0xaae01dc7cad0dc787b9388ed9cf27c480db89a22#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['EducationDegree', 'Certification'],
            },
            {
              id: 'did:velocity:0xaae01dc7cad0dc787b9388ed9cf27c480db89a22#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:06.502Z',
          updated: '2020-11-24T20:53:53.643Z',
          proof: {
            created: '2021-01-24T11:39:33.170Z',
            jws: '3045022100c2243a0aa564d78a77def5b782b11a3feaf64107ea6c088c190fd7e283ad1a8e022039674ce163b33165852ee8075e70175bfbd6d3a4ebf0b74cfc95789aae16d157',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Belarusian National Technical University',
          location: {
            countryCode: 'BY',
          },
          logo: 'https://times.bntu.by/data/uploads/logos/logo_BNTU.png',
          website: 'https://example.com',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0xaae01dc7cad0dc787b9388ed9cf27c480db89a22',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xaae01dc7cad0dc787b9388ed9cf27c480db89a22/resolve-vc/did:velocity:04b1e567d45812774960bc158b6ed76b5c3e39e0fd2b68abe96918f263660959cf2e3984f12f02e366bac09b1471bf57cd2d9d117d91767103eb399ad66b1fa7c7',
        },
      },
      {
        id: 'did:velocity:0x160cd834d125fd5b42f2612a71a9ef10581e0b1c',
        didDoc: {
          id: 'did:velocity:0x160cd834d125fd5b42f2612a71a9ef10581e0b1c',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x160cd834d125fd5b42f2612a71a9ef10581e0b1c#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x160cd834d125fd5b42f2612a71a9ef10581e0b1c',
              publicKeyBase58:
                'RbQA6z5RginFDiu1sJUnwNKeyzAap7bqDy7hA6jFJrseUhu83aNdi2Seb8nHg5P5ae8krPw6bmm6iKhFN7wi6YfS',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Northeast Community College',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Northeast_Community_College-320px.png',
              location: {
                countryCode: 'US',
                regionCode: 'NJ',
              },
              founded: {
                year: 1956,
              },
            },
            {
              id: 'did:velocity:0x160cd834d125fd5b42f2612a71a9ef10581e0b1c#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Course', 'EducationDegree'],
            },
          ],
          created: '2020-09-29T11:41:06.514Z',
          updated: '2020-11-24T20:18:20.294Z',
          proof: {
            created: '2021-01-24T11:39:33.168Z',
            jws: '3046022100998d7ab028388228c3d8446a76610941d38b1f3ffd0f3f79002dd5509def72700221008fbce90126aad1d927d66fe87cb53b006ece97e1f9bf0162e66e522cd569fda3',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Northeast Community College',
          location: {
            countryCode: 'US',
            regionCode: 'NJ',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Northeast_Community_College-320px.png',
          website: 'https://example.com',
          founded: '1956',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0x160cd834d125fd5b42f2612a71a9ef10581e0b1c',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x160cd834d125fd5b42f2612a71a9ef10581e0b1c/resolve-vc/did:velocity:0466999d3bb65c38151f32de8630622db6574b39b46ca25dcd50f6b98e175b2a831dc82765087bcf50ae70e0e4973627dd3631da282856b9ed84963a21615c68a2',
        },
      },
      {
        id: 'did:velocity:0x1939d3d15a0ecdf3f1888a65667e55d1382b6ba2',
        didDoc: {
          id: 'did:velocity:0x1939d3d15a0ecdf3f1888a65667e55d1382b6ba2',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x1939d3d15a0ecdf3f1888a65667e55d1382b6ba2#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x1939d3d15a0ecdf3f1888a65667e55d1382b6ba2',
              publicKeyBase58:
                'N9Y5Pa1JzHPU1h9c3Byu8gaUSjdAUJ1bWoVFMc6ab6BH66NArHLkeFhv9fBYwQpaFLgSJHxktz6rwUXVsjfejeog',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Amazon.com, Inc.',
              logo: 'https://images-na.ssl-images-amazon.com/images/G/01/gc/designs/livepreview/amazon_drkblue_noto_printfold_v2016_us-main._CB468920742_.png',
              location: {
                countryCode: 'IL',
                regionCode: 'AA',
              },
            },
            {
              id: 'did:velocity:0x1939d3d15a0ecdf3f1888a65667e55d1382b6ba2#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: [
                'CurrentEmploymentPosition',
                'PastEmploymentPosition',
                'Certification',
                'Badge',
              ],
            },
            {
              id: 'did:velocity:0x1939d3d15a0ecdf3f1888a65667e55d1382b6ba2#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:06.565Z',
          updated: '2020-11-24T20:54:53.300Z',
          proof: {
            created: '2021-01-24T11:39:33.165Z',
            jws: '3046022100d43130e717a87524b72b8937e6712fa56c49ed122ad5698a01b2b5b1797161f4022100d070098d66bfada5528b584ea734d99050c0783af6eeb1d41f52aaebd132f2ae',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Amazon.com, Inc.',
          location: {
            countryCode: 'IL',
            regionCode: 'AA',
          },
          logo: 'https://images-na.ssl-images-amazon.com/images/G/01/gc/designs/livepreview/amazon_drkblue_noto_printfold_v2016_us-main._CB468920742_.png',
          website: 'https://example.com',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0x1939d3d15a0ecdf3f1888a65667e55d1382b6ba2',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x1939d3d15a0ecdf3f1888a65667e55d1382b6ba2/resolve-vc/did:velocity:0459e8b105a85dff2170fbf08a6d5635c5ef96d356f89d627b9a14eac535e3fe30f23de5033d1a3634603a9e8b19b6628fee31fc45d143d118028bef5c0cbcd30e',
        },
      },
      {
        id: 'did:velocity:0x6e28efa97a0a4dd472e7a8560d70c98d0c47d0e2',
        didDoc: {
          id: 'did:velocity:0x6e28efa97a0a4dd472e7a8560d70c98d0c47d0e2',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x6e28efa97a0a4dd472e7a8560d70c98d0c47d0e2#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x6e28efa97a0a4dd472e7a8560d70c98d0c47d0e2',
              publicKeyBase58:
                'SPUPh29HSaCVqrPASzL2e2TMyWny5bK49QZo1jY2AZ3wLQrVh2xBxYmYFtefQiWi1V6MFLpGEmfuKPwFh3PbJeU4',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'EPAM Systems, Inc.',
              logo: 'https://img.favpng.com/8/8/19/logo-epam-systems-portable-network-graphics-computer-software-organization-png-favpng-4FXnDgTThvQZVMt8t7iWuPDiS.jpg',
              location: {
                countryCode: 'US',
                regionCode: 'CA',
              },
              founded: {
                day: 1,
                month: 1,
                year: 1993,
              },
            },
            {
              id: 'did:velocity:0x6e28efa97a0a4dd472e7a8560d70c98d0c47d0e2#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
            {
              id: 'did:velocity:0x6e28efa97a0a4dd472e7a8560d70c98d0c47d0e2#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: [
                'CurrentEmploymentPosition',
                'PastEmploymentPosition',
                'Certification',
                'Badge',
              ],
            },
          ],
          created: '2020-09-29T11:41:06.657Z',
          updated: '2020-11-24T21:16:47.546Z',
          proof: {
            created: '2021-01-24T11:39:33.160Z',
            jws: '30440220630d57b70e04817f9a40cd23e5c02d2caf6a18d206e9026b1462dd5d479336cc0220297b92d3f143b5f7c198106e968000d4c1ef5af551e29004a302a3ed0dc809aa',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'EPAM Systems, Inc.',
          location: {
            countryCode: 'US',
            regionCode: 'CA',
          },
          logo: 'https://img.favpng.com/8/8/19/logo-epam-systems-portable-network-graphics-computer-software-organization-png-favpng-4FXnDgTThvQZVMt8t7iWuPDiS.jpg',
          website: 'https://example.com',
          founded: '1993-01-01',
          permittedVelocityServiceCategory: ['', 'Inspector', 'Issuer'],
          did: 'did:velocity:0x6e28efa97a0a4dd472e7a8560d70c98d0c47d0e2',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x6e28efa97a0a4dd472e7a8560d70c98d0c47d0e2/resolve-vc/did:velocity:04fa29433fe43269e88ac026b407b0e05243339f20c91f16a312da1586d58be95e88e8868b9f0808d6882b203d631404997a33fc085ce63905507d27c50afdc3e0',
        },
      },
      {
        id: 'did:velocity:0xba86caa3903ce87af07d206e30b3b6fb89fb258c',
        didDoc: {
          id: 'did:velocity:0xba86caa3903ce87af07d206e30b3b6fb89fb258c',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xba86caa3903ce87af07d206e30b3b6fb89fb258c#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xba86caa3903ce87af07d206e30b3b6fb89fb258c',
              publicKeyBase58:
                'SADM6YjfZD6Tc13yYVpdBfebo7QnYq4ZrfdCe7ze1QQftrvgRm5cfJQ4dsGzTNWYTGskDeW8B9bnid6DJ65RJNwP',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'University of Basel',
              logo: 'https://logos-download.com/wp-content/uploads/2018/09/University_of_Basel_Logo-700x223.png',
              location: {
                countryCode: 'CH',
              },
            },
            {
              id: 'did:velocity:0xba86caa3903ce87af07d206e30b3b6fb89fb258c#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['EducationDegree', 'Certification'],
            },
            {
              id: 'did:velocity:0xba86caa3903ce87af07d206e30b3b6fb89fb258c#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:06.668Z',
          updated: '2020-11-24T21:05:32.516Z',
          proof: {
            created: '2021-01-24T11:39:33.157Z',
            jws: '304402200229c0e10048da41ff6839c8f5c673b320682ae0280d95b0a47956ba416e4793022073c5606b09822291aede6f8a8543f1157bc93dbf528a358b7ed59500c4e67d5f',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'University of Basel',
          location: {
            countryCode: 'CH',
          },
          logo: 'https://logos-download.com/wp-content/uploads/2018/09/University_of_Basel_Logo-700x223.png',
          website: 'https://example.com',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0xba86caa3903ce87af07d206e30b3b6fb89fb258c',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xba86caa3903ce87af07d206e30b3b6fb89fb258c/resolve-vc/did:velocity:04c921854aa3ad01bbd3faee75561719897605c9fd5fe523d4d7269b35312702831780dffa9e3a282309c8360d2e811023639c8131cfb980a20fcf58db9e0db805',
        },
      },
      {
        id: 'did:velocity:0x34f920d451efef03e350973d968c34a92ab9d4b0',
        didDoc: {
          id: 'did:velocity:0x34f920d451efef03e350973d968c34a92ab9d4b0',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x34f920d451efef03e350973d968c34a92ab9d4b0#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x34f920d451efef03e350973d968c34a92ab9d4b0',
              publicKeyBase58:
                'Nun5jNznzhaY81YWN51f3LeYfNykmwWkQqdErebhUypwTSicoaffEYjJUm9zFpSDfgBKJcvNSjGfqJebpZNLa6k5',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Aetsoft',
              logo: 'https://cdn-images-1.medium.com/max/1200/1*bzsvaTiwa1zw8LS1TPWQNg.jpeg',
              location: {
                countryCode: 'BY',
              },
            },
            {
              id: 'did:velocity:0x34f920d451efef03e350973d968c34a92ab9d4b0#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: [
                'CurrentEmploymentPosition',
                'PastEmploymentPosition',
                'Certification',
                'Badge',
              ],
            },
            {
              id: 'did:velocity:0x34f920d451efef03e350973d968c34a92ab9d4b0#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:06.759Z',
          updated: '2020-11-24T20:56:57.704Z',
          proof: {
            created: '2021-01-24T11:39:33.155Z',
            jws: '3046022100d2073dc1e65486086b247607127a4e06fcdc834b51627b9874635c6b52702a6f022100d54deb8650ab596b0bae9f87193ed9de0dbb68920bc6e5103ebd079319a2f2ba',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Aetsoft',
          location: {
            countryCode: 'BY',
          },
          logo: 'https://cdn-images-1.medium.com/max/1200/1*bzsvaTiwa1zw8LS1TPWQNg.jpeg',
          website: 'https://example.com',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0x34f920d451efef03e350973d968c34a92ab9d4b0',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x34f920d451efef03e350973d968c34a92ab9d4b0/resolve-vc/did:velocity:043e9e6c6b478aa0ffbf3d49ac4b3445d1f28d5afdb32b8892657b24e86d8d743992e8abf027fd849d5716bc3800ca20bbca6a2470f2d088a532c9d68a0900918c',
        },
      },
      {
        id: 'did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692',
        didDoc: {
          id: 'did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692',
              publicKeyBase58:
                'QgoGQdmte9fqqYvxNVa62A2zphWrmFjeqZRmEg91x5Yo1t69NMzxjxqaj3q3m9wAa1xSBd2i7PTa2jBLe881fdy4',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Microsoft Corporation',
              logo: 'https://agsol.com/wp-content/uploads/2018/09/new-microsoft-logo-SIZED-SQUARE.jpg',
              location: {
                countryCode: 'US',
                regionCode: 'WA',
              },
              founded: {
                day: 1,
                month: 1,
                year: 1976,
              },
            },
            {
              id: 'did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
            {
              id: 'did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: [
                'CurrentEmploymentPosition',
                'PastEmploymentPosition',
                'Certification',
                'Badge',
                'Assessment',
                'Course',
              ],
            },
          ],
          created: '2020-09-29T11:41:06.770Z',
          updated: '2021-05-06T07:39:54.263Z',
          proof: {
            created: '2021-05-06T07:39:54.263Z',
            jws: '304502203052d4d88bbd6de9d5a17c84f30592bfd32dd0110d87fc82745f3587906302380221009b7b2f38d244b3c7481b4662a2ec45a55b0c980552647674d41b1e5168e27985',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Microsoft Corporation',
          location: {
            countryCode: 'US',
            regionCode: 'WA',
          },
          logo: 'https://agsol.com/wp-content/uploads/2018/09/new-microsoft-logo-SIZED-SQUARE.jpg',
          website: 'https://example.com',
          founded: '1976-01-01',
          permittedVelocityServiceCategory: ['', 'Inspector', 'Issuer'],
          did: 'did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692/resolve-vc/did:velocity:047cf68abcf1c58a78ebc5fbaab20e548cda87443917d529c87399c87706c34d3581f0f5f148e71c7c4c95157f8d4dd3601c1d10586e4e9af9817b6a2fd7e1dd85',
        },
      },
      {
        id: 'did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88',
        didDoc: {
          id: 'did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88',
              publicKeyBase58:
                'NYUXszLAwWyZvf9b613uBHpEf4Hogv9N59ve4waDsmQQynZKCAPwt4g3YGRwmYHTytuk7q9iGJtMVJAuHVLgaS1C',
            },
            {
              id: 'did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88#key-2',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88',
              publicKeyBase58:
                'S8LMi98BT5HgK48e52FvZwwoc7XbSNi4tmtaBn7VzcChzkxpxDHNdZj2NpDMzQiExGrSwkXhisukNgxo4RnGBb1S',
            },
            {
              id: 'did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88#key-3',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88',
              publicKeyBase58:
                'NMa2sCJ973j5ijktqqrewxYpgdhyKhEg2RohrMCC5xn9LdL8fnuTVeWcoFZKQSoksoUjZtByW5DG3e4WiZo4ZPxA',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'University of Massachusetts Amherst',
              logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4f/University_of_Massachusetts_Amherst_seal.svg/1200px-University_of_Massachusetts_Amherst_seal.svg.png',
              location: {
                countryCode: 'US',
                regionCode: 'MA',
              },
            },
            {
              id: 'did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['EducationDegree', 'Certification'],
            },
            {
              id: 'did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:06.857Z',
          updated: '2021-05-24T13:42:03.584Z',
          proof: {
            created: '2021-05-24T13:42:03.585Z',
            jws: '3045022077b40a855db0212570be1926b8f44bb4b3165619468f6bf11da6401b266155d5022100892291db584153d58dc623ede22ddd1469f95516e9f6b19e5a165fe4a9bd0e4b',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'University of Massachusetts Amherst',
          location: {
            countryCode: 'US',
            regionCode: 'MA',
          },
          logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4f/University_of_Massachusetts_Amherst_seal.svg/1200px-University_of_Massachusetts_Amherst_seal.svg.png',
          website: 'https://example.com',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88/resolve-vc/did:velocity:04f2a2f40eedb048921054383849ebd2fd1a63909a5cb8df4b1264e27341716d5c9a4ae11e3163116ba68e25cd16927a93a685b3cbb5e320604af84d21d769511e',
        },
      },
      {
        id: 'did:velocity:0x32ccfe4b9b502020beec18d06c33ecce605f0eec',
        didDoc: {
          id: 'did:velocity:0x32ccfe4b9b502020beec18d06c33ecce605f0eec',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x32ccfe4b9b502020beec18d06c33ecce605f0eec#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x32ccfe4b9b502020beec18d06c33ecce605f0eec',
              publicKeyBase58:
                'R6KAumnUSP79R9anZUnyxQwgoaEqVhWQn1tvuQoKPF5dduEEZa76rMyrEYZdUHLeq8woiPc4UsBDaVLYY7Pgpmi8',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'University of Cambridge',
              logo: 'https://i.pinimg.com/originals/42/05/21/42052103233f42bd3efabc68d0e11b8f.jpg',
              location: {
                countryCode: 'UK',
              },
            },
            {
              id: 'did:velocity:0x32ccfe4b9b502020beec18d06c33ecce605f0eec#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['EducationDegree', 'Certification'],
            },
            {
              id: 'did:velocity:0x32ccfe4b9b502020beec18d06c33ecce605f0eec#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:06.867Z',
          updated: '2020-11-24T21:04:40.729Z',
          proof: {
            created: '2021-01-24T11:39:33.140Z',
            jws: '3045022036980e2e072525b043ef7cd7a81ecc1aadd503fe1ac6eaeb5fdc07f0175f02fa02210093ad0819503bbabf97d52c07af19e01c9239783af91dfcc88556b5b0aa98ceb7',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'University of Cambridge',
          location: {
            countryCode: 'UK',
          },
          logo: 'https://i.pinimg.com/originals/42/05/21/42052103233f42bd3efabc68d0e11b8f.jpg',
          website: 'https://example.com',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0x32ccfe4b9b502020beec18d06c33ecce605f0eec',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x32ccfe4b9b502020beec18d06c33ecce605f0eec/resolve-vc/did:velocity:04f6e7403dd1780c812560940edc2cf7d75347a0e557e279e42da418183329fe6069be7199ef6803bad425d8388f04d3a9ad6dd8253d49d1314ca28fab2b72963a',
        },
      },
      {
        id: 'did:velocity:0x0ef48622023389ab8533fd92ea28aefce2e989e5',
        didDoc: {
          id: 'did:velocity:0x0ef48622023389ab8533fd92ea28aefce2e989e5',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x0ef48622023389ab8533fd92ea28aefce2e989e5#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x0ef48622023389ab8533fd92ea28aefce2e989e5',
              publicKeyBase58:
                'PycKs1ieVLeW2Xi17Bpi6rRx3c6KUD8phcHTmZ1nUKB6XEvh92gF2itRwk9nM1mgeLUVYRiTtDCiKafNzqacJ7AG',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Tel-Aviv University Israel',
              logo: 'https://banner2.cleanpng.com/20180901/szv/kisspng-tel-aviv-university-college-professor-interdiscipl-portfolio-ileviathan-internet-marketing-5b8a879bcca6d6.4627522115358053398383.jpg',
              location: {
                countryCode: 'IL',
                regionCode: 'IL',
              },
            },
            {
              id: 'did:velocity:0x0ef48622023389ab8533fd92ea28aefce2e989e5#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Certification', 'EducationDegree'],
            },
            {
              id: 'did:velocity:0x0ef48622023389ab8533fd92ea28aefce2e989e5#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Certification', 'EducationDegree'],
            },
          ],
          created: '2020-09-29T11:41:06.953Z',
          updated: '2020-11-24T20:58:08.876Z',
          proof: {
            created: '2021-01-24T11:39:33.137Z',
            jws: '3045022004987518b598eef815555c11f476f8633c3e9841311357c2adb76c4cdac108fd02210094424dcf94d53d64d76279cd477222f3d7f3f07b4d5d23d37d2c910718b3a53d',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Tel-Aviv University Israel',
          location: {
            countryCode: 'IL',
            regionCode: 'IL',
          },
          logo: 'https://banner2.cleanpng.com/20180901/szv/kisspng-tel-aviv-university-college-professor-interdiscipl-portfolio-ileviathan-internet-marketing-5b8a879bcca6d6.4627522115358053398383.jpg',
          website: 'https://example.com',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0x0ef48622023389ab8533fd92ea28aefce2e989e5',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x0ef48622023389ab8533fd92ea28aefce2e989e5/resolve-vc/did:velocity:04bfa4b6e620c6b801be8040c56ae64d5a1e90887a7bf5f194e570cf764ac6118898dc3e461904eb4072b823b5e5f2fafca71a810d1321a7548faee246cc4f2886',
        },
      },
      {
        id: 'did:velocity:0x6080337a5a3cbf5fc05b88bde02b1483f6278a09',
        didDoc: {
          id: 'did:velocity:0x6080337a5a3cbf5fc05b88bde02b1483f6278a09',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x6080337a5a3cbf5fc05b88bde02b1483f6278a09#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x6080337a5a3cbf5fc05b88bde02b1483f6278a09',
              publicKeyBase58:
                'R2ee3PJuzXCdhZrhRYCF96UwWJ38tnbP1EN9v4TXMqqTTAofwyGAQrUFZ5iqxhXp1KTtNJm71iWoeaAYCvepPLwm',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'New Jersey Department of Health',
              logo: 'https://www.nj.gov/health/assets/img/seal.png',
              location: {
                countryCode: 'US',
                regionCode: 'NJ',
              },
              founded: {
                year: 1947,
              },
              website: 'https://www.nj.gov/health/',
            },
            {
              id: 'did:velocity:0x6080337a5a3cbf5fc05b88bde02b1483f6278a09#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Certification'],
            },
            {
              id: 'did:velocity:0x6080337a5a3cbf5fc05b88bde02b1483f6278a09#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:06.964Z',
          updated: '2020-11-24T21:06:14.185Z',
          proof: {
            created: '2021-01-24T11:39:33.134Z',
            jws: '3044022009977663515590f8610e8fdcde9eed4fb1591878417a8c9b1d36944d07d0026d02202698c23b0ef7573269c1f1c4afcdb25832e9ab67e5d54f33b8258a89fb0544b3',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'New Jersey Department of Health',
          location: {
            countryCode: 'US',
            regionCode: 'NJ',
          },
          logo: 'https://www.nj.gov/health/assets/img/seal.png',
          website: 'https://www.nj.gov/health/',
          founded: '1947',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0x6080337a5a3cbf5fc05b88bde02b1483f6278a09',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x6080337a5a3cbf5fc05b88bde02b1483f6278a09/resolve-vc/did:velocity:04a1fddfe1b061d1a5b84ecd6d074ff54948013fc7d83a5fcbc76b2ce599dbd948258c39ed01279b2fc4fea8206c2b05f8869c04743671d55f719e90baa5895894',
        },
      },
      {
        id: 'did:velocity:0xf645d2eb09e2ed478f28ea6ce8019c50002bffa0',
        didDoc: {
          id: 'did:velocity:0xf645d2eb09e2ed478f28ea6ce8019c50002bffa0',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xf645d2eb09e2ed478f28ea6ce8019c50002bffa0#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xf645d2eb09e2ed478f28ea6ce8019c50002bffa0',
              publicKeyBase58:
                'Np1R37VZbWvMq4rn9bF6k1dTMTRzUXXpmTCjXRBAdey1pxaNRbLm2T7uMNpiEcCnUpGoV7jFdGWDZKoJ4v3LpeGh',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Northwest Hospital',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Northwest_Hospital-320px.png',
              location: {
                countryCode: 'US',
                regionCode: 'FL',
              },
              founded: {
                year: 1972,
              },
            },
            {
              id: 'did:velocity:0xf645d2eb09e2ed478f28ea6ce8019c50002bffa0#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Course', 'CurrentEmploymentPosition', 'PastEmploymentPosition'],
            },
            {
              id: 'did:velocity:0xf645d2eb09e2ed478f28ea6ce8019c50002bffa0#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:06.974Z',
          updated: '2020-11-24T21:07:24.858Z',
          proof: {
            created: '2021-01-24T11:39:33.131Z',
            jws: '3045022100a67f9467713c270ee5fa07085bdd1e45c6982d991a25163059891646bec3983c0220224eea354c4e5fa25f07948682a808b810be95c129672361a963e045dcdb586c',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Northwest Hospital',
          location: {
            countryCode: 'US',
            regionCode: 'FL',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Northwest_Hospital-320px.png',
          website: 'https://example.com',
          founded: '1972',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0xf645d2eb09e2ed478f28ea6ce8019c50002bffa0',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xf645d2eb09e2ed478f28ea6ce8019c50002bffa0/resolve-vc/did:velocity:04863bba1915445392b9fd7a8ede786278790b7dbe8d56d5dc3cb49194b689fb2fa90d01f43e0558cdeee041a371e774b74c426e27fd2f83dc69e8a17f067202d0',
        },
      },
      {
        id: 'did:velocity:0xdbe53a95c58781febf526870e886cd37c9878de7',
        didDoc: {
          id: 'did:velocity:0xdbe53a95c58781febf526870e886cd37c9878de7',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xdbe53a95c58781febf526870e886cd37c9878de7#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xdbe53a95c58781febf526870e886cd37c9878de7',
              publicKeyBase58:
                'Px3BSKG9DkJEqFJFFZVEZbsexCSHiw5o8op4Cuz1NSjuaNVuZgwyNUeehtgVHzhPy6Tu8vAjC5y5By3j9NKHJNx8',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Essex County Care School',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Essex_County_Care_School-320px.png',
              location: {
                countryCode: 'US',
                regionCode: 'NJ',
              },
              founded: {
                year: 1974,
              },
            },
            {
              id: 'did:velocity:0xdbe53a95c58781febf526870e886cd37c9878de7#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Course', 'EducationDegree'],
            },
            {
              id: 'did:velocity:0xdbe53a95c58781febf526870e886cd37c9878de7#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:07.063Z',
          updated: '2020-11-24T21:07:56.021Z',
          proof: {
            created: '2021-01-24T11:39:33.126Z',
            jws: '304502202cce7c8b452acc2ddec681627c415f08f614e17ce45e998bc661db03ec81b5450221008842a64b446294c37f2aff2ccedf58390e13a9fbd88247bdbb748edd8f7285ea',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Essex County Care School',
          location: {
            countryCode: 'US',
            regionCode: 'NJ',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Essex_County_Care_School-320px.png',
          website: 'https://example.com',
          founded: '1974',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0xdbe53a95c58781febf526870e886cd37c9878de7',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xdbe53a95c58781febf526870e886cd37c9878de7/resolve-vc/did:velocity:047e4e2e88c0370f0d304447dddc227a780f28e393605d4249e9739e2c3efafdd108865bc6c8328c264f49aea060ae687533697b4369eda862c02376c479e3c867',
        },
      },
      {
        id: 'did:velocity:0x56507fc9802245640f1135654c1678f13523440b',
        didDoc: {
          id: 'did:velocity:0x56507fc9802245640f1135654c1678f13523440b',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x56507fc9802245640f1135654c1678f13523440b#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x56507fc9802245640f1135654c1678f13523440b',
              publicKeyBase58:
                'SEsy4REdRyRajmRaUPsBSdZp1yJaKKyShM2GJCqDWgasQqHQr4mA4QJLX3Q5kijyHnVTRKz4e2X73BE2FepUc26s',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Starfield College',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Starfield_College_NJ-320px.png',
              location: {
                countryCode: 'US',
                regionCode: 'NJ',
              },
              founded: {
                year: 1927,
              },
            },
            {
              id: 'did:velocity:0x56507fc9802245640f1135654c1678f13523440b#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Course', 'EducationDegree'],
            },
          ],
          created: '2020-09-29T11:41:07.160Z',
          updated: '2020-11-24T20:27:04.323Z',
          proof: {
            created: '2021-01-24T11:39:33.124Z',
            jws: '304502200b4e087f082512517edb8c610ac91381a3944e6062c809cf7cc913fa9ddf041c022100c021e7ae1288b8fabf91e510eb3d7676f796821e31ce68f7d6458ebfc8fd4bce',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Starfield College',
          location: {
            countryCode: 'US',
            regionCode: 'NJ',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Starfield_College_NJ-320px.png',
          website: 'https://example.com',
          founded: '1927',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0x56507fc9802245640f1135654c1678f13523440b',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x56507fc9802245640f1135654c1678f13523440b/resolve-vc/did:velocity:04c3adc7954535abb4def2adfc2a8e26657121634af7423555b000d90bad3cb96eecbceb41545aaf25f7dddbe9fe30a1a71f98a24f30333b84277f055fffa96af0',
        },
      },
      {
        id: 'did:velocity:0xd60231a3d0de0f197f1784f6f37ebcfaa291ab23',
        didDoc: {
          id: 'did:velocity:0xd60231a3d0de0f197f1784f6f37ebcfaa291ab23',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xd60231a3d0de0f197f1784f6f37ebcfaa291ab23#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xd60231a3d0de0f197f1784f6f37ebcfaa291ab23',
              publicKeyBase58:
                'RE8veCmhwKVGUKKaasnZBqx3zxCZBejUxWL8Kdt9YcAn9bdK36wgGB4SkkQGWHoanoFbuKbJrr6pNHifb6JAn2hG',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Google',
              logo: 'https://expresswriters.com/wp-content/uploads/2015/09/google-new-logo-1280x720.jpg',
              location: {
                countryCode: 'US',
                regionCode: 'CA',
              },
            },
            {
              id: 'did:velocity:0xd60231a3d0de0f197f1784f6f37ebcfaa291ab23#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: [
                'CurrentEmploymentPosition',
                'PastEmploymentPosition',
                'Certification',
                'Badge',
              ],
            },
            {
              id: 'did:velocity:0xd60231a3d0de0f197f1784f6f37ebcfaa291ab23#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:07.253Z',
          updated: '2020-11-24T21:08:31.428Z',
          proof: {
            created: '2021-01-24T11:39:33.121Z',
            jws: '304502210083e13baf8a13260030cd7bfaf902b06b93ea6ce69bc96eddaa7ed77fcab6458102201c29652983f04ca83b5fddfb98c375ae48d84612dbc6b950b0e2e5e308b31ae6',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Google',
          location: {
            countryCode: 'US',
            regionCode: 'CA',
          },
          logo: 'https://expresswriters.com/wp-content/uploads/2015/09/google-new-logo-1280x720.jpg',
          website: 'https://example.com',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0xd60231a3d0de0f197f1784f6f37ebcfaa291ab23',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xd60231a3d0de0f197f1784f6f37ebcfaa291ab23/resolve-vc/did:velocity:04e5994cf50e0f66dc0a5fbf4e7ca5a233c17a9a0f75ee729648b2bd4baf5a59ee85f1781368849a99edc4aead53cfc7cd6ed7b962e3ecf78434fd6c4b1a2b30b1',
        },
      },
      {
        id: 'did:velocity:0x050f313623c9502a54dbc85f8bf138d2d3061070',
        didDoc: {
          id: 'did:velocity:0x050f313623c9502a54dbc85f8bf138d2d3061070',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x050f313623c9502a54dbc85f8bf138d2d3061070#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x050f313623c9502a54dbc85f8bf138d2d3061070',
              publicKeyBase58:
                'Rqv8N344tGzLbZdHXPqtEMgvakzYSXPZxyymnuGaLirPtu5ZDBq53eUMadhg2cv5GFUWAYVBWdxAZ4RUVqbrsBHb',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: "St. George's Hospital",
              logo: 'https://docs.velocitycareerlabs.io/Logos/St._Georges_Hospital-320px.png',
              location: {
                countryCode: 'US',
                regionCode: 'NJ',
              },
              founded: {
                year: 1910,
              },
            },
            {
              id: 'did:velocity:0x050f313623c9502a54dbc85f8bf138d2d3061070#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:07.263Z',
          updated: '2020-11-24T21:06:49.859Z',
          proof: {
            created: '2021-01-24T11:39:33.117Z',
            jws: '304402204fcb8f0ade86977d57d2201fa0fc76d8e08c2b1063fa206b5db152fbfb25659b022021333aea61e9fa06299d5811db0e368f1cd06708acd91dfdadd842df03dfbf46',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: "St. George's Hospital",
          location: {
            countryCode: 'US',
            regionCode: 'NJ',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/St._Georges_Hospital-320px.png',
          website: 'https://example.com',
          founded: '1910',
          permittedVelocityServiceCategory: ['', 'Inspector'],
          did: 'did:velocity:0x050f313623c9502a54dbc85f8bf138d2d3061070',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x050f313623c9502a54dbc85f8bf138d2d3061070/resolve-vc/did:velocity:04f12907a00989fb8a3aa04f2ede7d3f70d30fa6ca6493040c54e67b6e6ae820b474f372fe49ecc5278558bb0828fca870d2dce9eb65a29bc9c355a89de20fa29d',
        },
      },
      {
        id: 'did:velocity:0xbad54148ae9f15999d53327482fa78de96abb36b',
        didDoc: {
          id: 'did:velocity:0xbad54148ae9f15999d53327482fa78de96abb36b',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xbad54148ae9f15999d53327482fa78de96abb36b#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xbad54148ae9f15999d53327482fa78de96abb36b',
              publicKeyBase58:
                'RykDcxaX8xrCrRejPghv3XThXw1o9b3rYkYpL9LbA7PY8DhyMqytqQX65ncLF854t4NzQSfWqoimWCoLxP3J7JdX',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'LBJ County Hospital',
              logo: 'https://docs.velocitycareerlabs.io/Logos/LBJ_County_Hospital-320px.png',
              location: {
                countryCode: 'US',
                regionCode: 'FL',
              },
              founded: {
                year: 1981,
              },
            },
            {
              id: 'did:velocity:0xbad54148ae9f15999d53327482fa78de96abb36b#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:07.271Z',
          updated: '2020-11-24T21:09:24.967Z',
          proof: {
            created: '2021-01-24T11:39:33.114Z',
            jws: '304502202d98e4bdd92ae1735231701f8029867c038e73eea13153c81e16772f9a4fff65022100ab8e0f50e14a6b8fb568f623130d1707e9f76c3ddb1bac3276c516cc6aafb415',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'LBJ County Hospital',
          location: {
            countryCode: 'US',
            regionCode: 'FL',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/LBJ_County_Hospital-320px.png',
          website: 'https://example.com',
          founded: '1981',
          permittedVelocityServiceCategory: ['', 'Inspector'],
          did: 'did:velocity:0xbad54148ae9f15999d53327482fa78de96abb36b',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xbad54148ae9f15999d53327482fa78de96abb36b/resolve-vc/did:velocity:04b62d83bc57f7b91a249326b63120ee572f38a55c51e26690ad45460a01ea6340bc5964e5a5ea9ffc64289328e56f69cc7d37cc3b22f3d379a60f8d1f08fee26f',
        },
      },
      {
        id: 'did:velocity:0x608131825b2b9e5425dea9d5237b0d6a4451eefd',
        didDoc: {
          id: 'did:velocity:0x608131825b2b9e5425dea9d5237b0d6a4451eefd',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x608131825b2b9e5425dea9d5237b0d6a4451eefd#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x608131825b2b9e5425dea9d5237b0d6a4451eefd',
              publicKeyBase58:
                'Q9VvndUAf1N2UU8p6kupP9WeyLUVPqDCzZqbv48HJD1GmWAF9Zg1TCEnhEttVsoY1fLjnrvNLdN1dpYWFZo7RY4g',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'ACME Corporation',
              logo: 'https://vignette.wikia.nocookie.net/looneytunes/images/5/56/Comp_2.jpg/revision/latest/scale-to-width-down/250?cb=20121102161419',
              location: {
                countryCode: 'US',
                regionCode: 'CA',
              },
            },
            {
              id: 'did:velocity:0x608131825b2b9e5425dea9d5237b0d6a4451eefd#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: [
                'CurrentEmploymentPosition',
                'PastEmploymentPosition',
                'Certification',
                'Badge',
              ],
            },
            {
              id: 'did:velocity:0x608131825b2b9e5425dea9d5237b0d6a4451eefd#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:07.355Z',
          updated: '2020-11-24T21:12:38.823Z',
          proof: {
            created: '2021-01-24T11:39:33.111Z',
            jws: '3045022100e9a7e9c4a4ff9f7df1c046dd6d95884f617b11c70139475064f6ea388c2400240220063b55355fbb702565cf87cc0e623263b1f1373e80bacaa1eb5020509d731b78',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'ACME Corporation',
          location: {
            countryCode: 'US',
            regionCode: 'CA',
          },
          logo: 'https://vignette.wikia.nocookie.net/looneytunes/images/5/56/Comp_2.jpg/revision/latest/scale-to-width-down/250?cb=20121102161419',
          website: 'https://example.com',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0x608131825b2b9e5425dea9d5237b0d6a4451eefd',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x608131825b2b9e5425dea9d5237b0d6a4451eefd/resolve-vc/did:velocity:04abeeb5aef2806694ac8fb468ad87a93dbf1b29552dbe8db59726770acbc78a9633e500728a6986b007af6682a334faa6edb7d21d94094a4670af86feecc16642',
        },
      },
      {
        id: 'did:velocity:0xcc83376a5a675bedc59001c7db071d8a9ee4df2a',
        didDoc: {
          id: 'did:velocity:0xcc83376a5a675bedc59001c7db071d8a9ee4df2a',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xcc83376a5a675bedc59001c7db071d8a9ee4df2a#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xcc83376a5a675bedc59001c7db071d8a9ee4df2a',
              publicKeyBase58:
                'MmueNNeBjGhzKxnuhJvX3sdN961Vw1ZWcqvJDHb2K1ntQc9DhG21w3ydHc1c87VjHkDXdCAAyW5ftw5iEb4G7WJ3',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Mount Sinai Nursing Home',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Mount_Sinai_Nursing_Home-320px.png',
              location: {
                countryCode: 'US',
                regionCode: 'NJ',
              },
              founded: {
                year: 1955,
              },
            },
            {
              id: 'did:velocity:0xcc83376a5a675bedc59001c7db071d8a9ee4df2a#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['CurrentEmploymentPosition', 'PastEmploymentPosition'],
            },
          ],
          created: '2020-09-29T11:41:07.365Z',
          updated: '2020-11-24T20:28:38.723Z',
          proof: {
            created: '2021-01-24T11:39:33.108Z',
            jws: '30450221008b20792824b6135ec57838a8b049802d1fc948ed510f5816d04b16385378205a022021eae4840ece4f89947c22a46493f246510012ee8aed92e002567fa3c4c0dbc7',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Mount Sinai Nursing Home',
          location: {
            countryCode: 'US',
            regionCode: 'NJ',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Mount_Sinai_Nursing_Home-320px.png',
          website: 'https://example.com',
          founded: '1955',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0xcc83376a5a675bedc59001c7db071d8a9ee4df2a',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xcc83376a5a675bedc59001c7db071d8a9ee4df2a/resolve-vc/did:velocity:04456c38fb1cdc2182ac974c301f9fb9f58f0acd0419389a5d32ff151094b58fd7a65c114d2e8c790a324774f44903a1c5b8a0d6bb35ed153b17cb1c684077d7b9',
        },
      },
      {
        id: 'did:velocity:0x33860188c6ce1292f64be8d5e8849bc6b72e81f1',
        didDoc: {
          id: 'did:velocity:0x33860188c6ce1292f64be8d5e8849bc6b72e81f1',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x33860188c6ce1292f64be8d5e8849bc6b72e81f1#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x33860188c6ce1292f64be8d5e8849bc6b72e81f1',
              publicKeyBase58:
                'NbRAh9UCFAgX1rLrz3D5LiZGycaawriAdjtfGe1cqadvUUtbM8yj1FBuHDaq1JzATPnC3NG9S2xPssoKCvZrPJS1',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Korn Ferry',
              logo: 'https://kornferry.papirfly.co.uk/readimage.aspx/asset.png?pubid=-lhz6gIrZLUvl5Dsouz4lA',
              location: {
                countryCode: 'US',
              },
              founded: {
                year: 1969,
              },
              website: 'https://www.kornferry.com/',
            },
            {
              id: 'did:velocity:0x33860188c6ce1292f64be8d5e8849bc6b72e81f1#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Badge', 'Assessment'],
            },
          ],
          created: '2020-09-29T11:41:07.374Z',
          updated: '2020-12-31T09:55:22.392Z',
          proof: {
            created: '2021-01-24T11:39:33.106Z',
            jws: '3046022100889ab38912b2df1da10f59ed078eab5db755e9a9cac5d87180a55f1b57fc6cb5022100e8d59b450c3588c315f15aec7121c43d137ded31c19f3bd66218837999b85b01',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Korn Ferry',
          location: {
            countryCode: 'US',
          },
          logo: 'https://kornferry.papirfly.co.uk/readimage.aspx/asset.png?pubid=-lhz6gIrZLUvl5Dsouz4lA',
          website: 'https://www.kornferry.com/',
          founded: '1969',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0x33860188c6ce1292f64be8d5e8849bc6b72e81f1',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x33860188c6ce1292f64be8d5e8849bc6b72e81f1/resolve-vc/did:velocity:0404cf89766527ee1620266dc0b1575b3dd8ab25991a8597bb789cee06faff96c0e6af43a9a2c9d60c69c01ffa7064ce60d9a8113fe5cf6ac88df8aae45172c287',
        },
      },
      {
        id: 'did:velocity:0xe5e2eb80f25881e2949a6451d56bd8be87063e40',
        didDoc: {
          id: 'did:velocity:0xe5e2eb80f25881e2949a6451d56bd8be87063e40',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xe5e2eb80f25881e2949a6451d56bd8be87063e40#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xe5e2eb80f25881e2949a6451d56bd8be87063e40',
              publicKeyBase58:
                'N3Roy2moAkAFqynz18D8PqfNEyk6AVYkCN9kWMyCKbjD65UZq477iNZkAfggBWTxUSouzo5qTqABbygRz2UFRTck',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Florida Board of Nursing',
              logo: 'https://floridasnursing.gov/wp-content/uploads/2014/01/fbon-seal2.png',
              location: {
                countryCode: 'US',
                regionCode: 'FL',
              },
              founded: {
                year: 1914,
              },
              website: 'https://floridasnursing.gov/',
            },
            {
              id: 'did:velocity:0xe5e2eb80f25881e2949a6451d56bd8be87063e40#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Certification'],
            },
            {
              id: 'did:velocity:0xe5e2eb80f25881e2949a6451d56bd8be87063e40#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:07.454Z',
          updated: '2020-11-24T21:11:14.579Z',
          proof: {
            created: '2021-01-24T11:39:33.097Z',
            jws: '30450221008016e7dd162171a8a2160bbe29f44ee1ed2f30579ad166b4f7332a363e2b39a9022009ffb4890e79093229b6177dc727364b53cb9652c0b38aea7a4611183161bd08',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Florida Board of Nursing',
          location: {
            countryCode: 'US',
            regionCode: 'FL',
          },
          logo: 'https://floridasnursing.gov/wp-content/uploads/2014/01/fbon-seal2.png',
          website: 'https://floridasnursing.gov/',
          founded: '1914',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0xe5e2eb80f25881e2949a6451d56bd8be87063e40',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xe5e2eb80f25881e2949a6451d56bd8be87063e40/resolve-vc/did:velocity:04bb7dd5b7b454dab18f1628111f9006b516131e3019df230f4b5b7a9b72f662ca7b4d7de61582e310ab575e41eef58fee1b6926ecd5272f920407693ff530f2ed',
        },
      },
      {
        id: 'did:velocity:0x7f9d4c13f75c5fb145f5cef6ab77534ba6f9ee64',
        didDoc: {
          id: 'did:velocity:0x7f9d4c13f75c5fb145f5cef6ab77534ba6f9ee64',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x7f9d4c13f75c5fb145f5cef6ab77534ba6f9ee64#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x7f9d4c13f75c5fb145f5cef6ab77534ba6f9ee64',
              publicKeyBase58:
                'NRGjE7T9MGuarGbo5V8tbSX5quhkZATtZFY89a6rbYdefZhDJwUrpqBPn9EfrL2jW2VJgEZ5DU9rmKQ1upLS74Us',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Relias',
              logo: 'https://static.reliaslearning.com/logo.png',
              location: {
                countryCode: 'US',
                regionCode: 'NC',
              },
              founded: {
                day: 1,
                month: 1,
                year: 2012,
              },
            },
            {
              id: 'did:velocity:0x7f9d4c13f75c5fb145f5cef6ab77534ba6f9ee64#credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Badge', 'Course'],
            },
          ],
          created: '2020-09-29T11:41:07.466Z',
          updated: '2020-11-24T21:18:55.192Z',
          proof: {
            created: '2021-01-24T11:39:33.094Z',
            jws: '30450220530e4ec390d2a8723b43a94cd52379fa933f6ae9c463477c713b5c08be503a550221008ccb1e78d70885a929eed3b24fda1900d05e16ac62e23486fbe59d29e3352dab',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Relias',
          location: {
            countryCode: 'US',
            regionCode: 'NC',
          },
          logo: 'https://static.reliaslearning.com/logo.png',
          website: 'https://example.com',
          founded: '2012-01-01',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0x7f9d4c13f75c5fb145f5cef6ab77534ba6f9ee64',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x7f9d4c13f75c5fb145f5cef6ab77534ba6f9ee64/resolve-vc/did:velocity:04b9ebc95a5fcf7846c42ed258869abe945ecfe6232f248f183309b39d28eaae0121d061a594e754a2d4fed08a6ac501e598f4b4a0e24339958a927398691748fa',
        },
      },
      {
        id: 'did:velocity:0xef16f6a9031478ff7f3f5885fd1d2cf1458a899b',
        didDoc: {
          id: 'did:velocity:0xef16f6a9031478ff7f3f5885fd1d2cf1458a899b',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xef16f6a9031478ff7f3f5885fd1d2cf1458a899b#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xef16f6a9031478ff7f3f5885fd1d2cf1458a899b',
              publicKeyBase58:
                'NFS81AxasPWwrmJJC5aFtfkDSa8Gjx2jfU7QdxrmEiHnCNqoysu6ZwbgRp6fzYi1r6xP8Y1RgQSvCVgo3b8bC4Xs',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Autumn Leaves Care Center',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Autumn_Leaves-Care_Center-320px.png',
              location: {
                countryCode: 'US',
                regionCode: 'FL',
              },
              founded: {
                year: 1959,
              },
            },
            {
              id: 'did:velocity:0xef16f6a9031478ff7f3f5885fd1d2cf1458a899b#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:07.555Z',
          updated: '2020-11-24T21:09:58.977Z',
          proof: {
            created: '2021-01-24T11:39:33.089Z',
            jws: '3046022100c4b93ceb9c79d917954f01455a2ce45ed9a08bef624fb956b8af5d03c4512dd9022100c7b88730351af2b9ac1dd1d40bc69fe30290297869fff0920dd40f578e4029fe',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Autumn Leaves Care Center',
          location: {
            countryCode: 'US',
            regionCode: 'FL',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Autumn_Leaves-Care_Center-320px.png',
          website: 'https://example.com',
          founded: '1959',
          permittedVelocityServiceCategory: ['', 'Inspector'],
          did: 'did:velocity:0xef16f6a9031478ff7f3f5885fd1d2cf1458a899b',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xef16f6a9031478ff7f3f5885fd1d2cf1458a899b/resolve-vc/did:velocity:0490a4e7852ef8f39670b2c68dfcbf0ecf2da997b4dfbb299b5fd619d31f4b96c86d69d946a6d71635acd969021ea7791d33e3c7fa0a51a3bc3b464ae2ef9bbf06',
        },
      },
      {
        id: 'did:velocity:0xa2d2214df3fbe8fb5fdb6563fbcd5f3297e40c8e',
        didDoc: {
          id: 'did:velocity:0xa2d2214df3fbe8fb5fdb6563fbcd5f3297e40c8e',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xa2d2214df3fbe8fb5fdb6563fbcd5f3297e40c8e#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xa2d2214df3fbe8fb5fdb6563fbcd5f3297e40c8e',
              publicKeyBase58:
                'PL3s3eW6y4xrpA3MLsArb4FAPQGc8o9rDYKj37FTJ9bYWnEXgPgZcG5sd6CjXU7uvhfDZUt81tqjwAasGQHD4WZb',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Randstad USA',
              logo: 'https://static.rusacdn.com/images/velocity/randstad_logo_blue.svg',
              location: {
                countryCode: 'US',
              },
              founded: {
                day: 1,
                month: 1,
                year: 1960,
              },
            },
            {
              id: 'did:velocity:0xa2d2214df3fbe8fb5fdb6563fbcd5f3297e40c8e#credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['CurrentEmploymentPosition', 'PastEmploymentPosition', 'Badge'],
            },
            {
              id: 'did:velocity:0xa2d2214df3fbe8fb5fdb6563fbcd5f3297e40c8e#credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:07.566Z',
          updated: '2020-11-24T21:19:58.266Z',
          proof: {
            created: '2021-01-24T11:39:33.083Z',
            jws: '304402204a009884f5c96ebd0a9451559cd68a0ee57a2760e5d76fd507f3a6440250bbbc02201d15188c0b0294ea3ec3a837044e8c6dee3d45054d95c716597b8208e057e46d',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Randstad USA',
          location: {
            countryCode: 'US',
          },
          logo: 'https://static.rusacdn.com/images/velocity/randstad_logo_blue.svg',
          website: 'https://example.com',
          founded: '1960-01-01',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0xa2d2214df3fbe8fb5fdb6563fbcd5f3297e40c8e',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xa2d2214df3fbe8fb5fdb6563fbcd5f3297e40c8e/resolve-vc/did:velocity:045238775f2c0b5b186dc141eea1643e1b02d1a32a044ee0ead533d9161c2c15970fcf34d4271c16165670034edc317668aad1294497aec92efab39246f3bd32ad',
        },
      },
      {
        id: 'did:velocity:0xcf2d80375135c0bc9a17f75f68d9a4a310e9f2ca',
        didDoc: {
          id: 'did:velocity:0xcf2d80375135c0bc9a17f75f68d9a4a310e9f2ca',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xcf2d80375135c0bc9a17f75f68d9a4a310e9f2ca#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xcf2d80375135c0bc9a17f75f68d9a4a310e9f2ca',
              publicKeyBase58:
                'Rz3A4SE2FgXvLU29LsF3tVx9sEdXMnGjHaN2j6uXijiuEyfiojRCbU5iDpfvnQTeb7ryQNupsFJMNLd8cfpHwECo',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'New Jersey Board of Nursing',
              logo: 'https://www.njconsumeraffairs.gov/_catalogs/masterpage/NJDCATHEME/img/logos/dca-logo.png',
              location: {
                countryCode: 'US',
                regionCode: 'NJ',
              },
              founded: {
                year: 1912,
              },
              website: 'https://www.njconsumeraffairs.gov/nur/Pages/default.aspx',
            },
            {
              id: 'did:velocity:0xcf2d80375135c0bc9a17f75f68d9a4a310e9f2ca#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Certification'],
            },
            {
              id: 'did:velocity:0xcf2d80375135c0bc9a17f75f68d9a4a310e9f2ca#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:07.662Z',
          updated: '2020-11-24T21:13:12.877Z',
          proof: {
            created: '2021-01-24T11:39:33.075Z',
            jws: '30450221008ab03eea0cb41e1d5c29edc3b6942a31a3f1849f58efe7747d3df50655a5865802202ada7951cd1b17f27bdf883cf6c1148cfbec8a6869dc0cb768759289b89ff7a6',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'New Jersey Board of Nursing',
          location: {
            countryCode: 'US',
            regionCode: 'NJ',
          },
          logo: 'https://www.njconsumeraffairs.gov/_catalogs/masterpage/NJDCATHEME/img/logos/dca-logo.png',
          website: 'https://www.njconsumeraffairs.gov/nur/Pages/default.aspx',
          founded: '1912',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0xcf2d80375135c0bc9a17f75f68d9a4a310e9f2ca',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xcf2d80375135c0bc9a17f75f68d9a4a310e9f2ca/resolve-vc/did:velocity:042decf8e6dd8258eb703731c30e511c958621995136d634a6c9fc97e45eb9b8a4adf422fd7c69e664421771c8a8c42e0329720eab2f1db505450550d72ea7b16b',
        },
      },
      {
        id: 'did:velocity:0xbf8db6230d983a9257f93c5cab056ecc1a1e2c7e',
        didDoc: {
          id: 'did:velocity:0xbf8db6230d983a9257f93c5cab056ecc1a1e2c7e',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xbf8db6230d983a9257f93c5cab056ecc1a1e2c7e#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xbf8db6230d983a9257f93c5cab056ecc1a1e2c7e',
              publicKeyBase58:
                'NbwXU3Hf2pZtu9njummYYDrr19VgcrsV4N4wRzarYCmGmx2nhNgjU4tVUok2SVBPZGF96hTFj79aZ3CgKujWpGoS',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'NAWCO',
              logo: 'https://www.nawccb.org/wp-content/themes/nawccb/logo.png',
              location: {
                countryCode: 'US',
                regionCode: 'IN',
              },
              founded: {
                year: 1955,
              },
              website: 'https://www.nawccb.org/',
            },
            {
              id: 'did:velocity:0xbf8db6230d983a9257f93c5cab056ecc1a1e2c7e#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Certification'],
            },
          ],
          created: '2020-09-29T11:41:07.757Z',
          updated: '2020-11-24T20:33:34.239Z',
          proof: {
            created: '2021-01-24T11:39:33.067Z',
            jws: '30440220323d9060e67cd3618fc35bda6d629424557968c8d1df68efcdd9e3d555a2676b02203ec1902c0b26ef094ce471ef498b5d7907dd5316e64cf2eb1a4cb723044c9b54',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'NAWCO',
          location: {
            countryCode: 'US',
            regionCode: 'IN',
          },
          logo: 'https://www.nawccb.org/wp-content/themes/nawccb/logo.png',
          website: 'https://www.nawccb.org/',
          founded: '1955',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0xbf8db6230d983a9257f93c5cab056ecc1a1e2c7e',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xbf8db6230d983a9257f93c5cab056ecc1a1e2c7e/resolve-vc/did:velocity:04ae60ae12ed9683e9e47ccf90517723f2d4a984d11ccd12fda914e109c779c1c03483d3a38ac5d5b69afff7c71975cbb4d47c439e18efbe4877a679882debc830',
        },
      },
      {
        id: 'did:velocity:0xc3102df5948d629329cef03c40221221d58b9345',
        didDoc: {
          id: 'did:velocity:0xc3102df5948d629329cef03c40221221d58b9345',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xc3102df5948d629329cef03c40221221d58b9345#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xc3102df5948d629329cef03c40221221d58b9345',
              publicKeyBase58:
                'MXgDChKtYGrHw65mpgWnFfe1goHvDWog1LuBaqB9LUNBJieiHyLSyW6W6Tg53YzgVJwihbPHCohqR1cut1SGp1eC',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'JFK Hospital',
              logo: 'https://docs.velocitycareerlabs.io/Logos/JFK_Hospital-320px.png',
              location: {
                countryCode: 'US',
                regionCode: 'NJ',
              },
              founded: {
                year: 1970,
              },
            },
            {
              id: 'did:velocity:0xc3102df5948d629329cef03c40221221d58b9345#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['CurrentEmploymentPosition', 'PastEmploymentPosition'],
            },
            {
              id: 'did:velocity:0xc3102df5948d629329cef03c40221221d58b9345#velocity-credential-agent-inspector-1',
              type: 'VelocityCredentialAgentInspector_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
            },
          ],
          created: '2020-09-29T11:41:07.854Z',
          updated: '2020-11-24T21:13:55.800Z',
          proof: {
            created: '2021-01-24T11:39:33.060Z',
            jws: '3045022100cd6d287a52e281f0e01366f3e3b83c8290930a1ba53deafb2a2d8e51c1b501f1022077e8ce1867b02b738ae56dd9e72dbe21a6eb23673d3bbe2caad519703a01e5f9',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'JFK Hospital',
          location: {
            countryCode: 'US',
            regionCode: 'NJ',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/JFK_Hospital-320px.png',
          website: 'https://example.com',
          founded: '1970',
          permittedVelocityServiceCategory: ['', 'Issuer', 'Inspector'],
          did: 'did:velocity:0xc3102df5948d629329cef03c40221221d58b9345',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xc3102df5948d629329cef03c40221221d58b9345/resolve-vc/did:velocity:04d03dfb96c022abb49813655fc548e560ba2c6fae23b07a7943fa898ee28b7d3ee013242c4862c068badd151bdb3ab0956ef04b5f32e81f8aad2754b7fc571fe4',
        },
      },
      {
        id: 'did:velocity:0x33c793e902e3e639f89c19cf991ca5c6d27af9a1',
        didDoc: {
          id: 'did:velocity:0x33c793e902e3e639f89c19cf991ca5c6d27af9a1',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x33c793e902e3e639f89c19cf991ca5c6d27af9a1#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x33c793e902e3e639f89c19cf991ca5c6d27af9a1',
              publicKeyBase58:
                'RwxACoDawqdyrwdSeLBTqx5UqmZHeugduDHZ3oMKDp14SWQUSMZTJewzXg2dYseZ73kdavtStHnJ2mHaHri7uUoj',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Wound Care Education Institute',
              logo: 'https://www.wcei.net/MediaLibraries/WCEI/WCEI/Design/WoundCare_Logo_RGB_with_endorser.png',
              location: {
                countryCode: 'US',
                regionCode: 'NC',
              },
              founded: {
                year: 2002,
              },
              website: 'https://www.wcei.net/courses/skin-wound-management/onsite-course',
            },
            {
              id: 'did:velocity:0x33c793e902e3e639f89c19cf991ca5c6d27af9a1#velocity-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Course'],
            },
          ],
          created: '2020-09-29T11:41:07.864Z',
          updated: '2020-11-24T20:32:59.455Z',
          proof: {
            created: '2021-01-24T11:39:33.049Z',
            jws: '3044022052e5f708c73ab5c1aab3ee7f906882ee4d9e04013fd9c3d465418b370f001a4a022011cd5a694aa69878dd57ab6baf49d7f1d865900f231b4782bc8ea25694f15bc5',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Wound Care Education Institute',
          location: {
            countryCode: 'US',
            regionCode: 'NC',
          },
          logo: 'https://www.wcei.net/MediaLibraries/WCEI/WCEI/Design/WoundCare_Logo_RGB_with_endorser.png',
          website: 'https://www.wcei.net/courses/skin-wound-management/onsite-course',
          founded: '2002',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0x33c793e902e3e639f89c19cf991ca5c6d27af9a1',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x33c793e902e3e639f89c19cf991ca5c6d27af9a1/resolve-vc/did:velocity:04f75e2443da1515dbb34df2f68bad93c5a3665006480f354749eb5cbf08b17b5e9054891f623f82280b41a4f2df4e161d26ac364785b8a8bdcae3fc99a9f32057',
        },
      },
      {
        id: 'did:velocity:0xb7123f075a2346b3dab094d1d7f723e65ee9c0dc',
        didDoc: {
          id: 'did:velocity:0xb7123f075a2346b3dab094d1d7f723e65ee9c0dc',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xb7123f075a2346b3dab094d1d7f723e65ee9c0dc#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0xb7123f075a2346b3dab094d1d7f723e65ee9c0dc',
              publicKeyBase58:
                'SATiwhrZacWNNk6nH77TMtU69axg4eEdexFLbBDwAWsLK2KXQezzQkruurWLC36mc8JGyUh4kWC91JvEcPiGueJZ',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Nurse.com',
              logo: 'https://okhqy6-qa9n4wisj6mm.cloudmaestro.com/vRrXjhhzg/media/logo/stores/1/aNurse_Relias.png.pagespeed.ic.o42QvjhTkJ.webp',
              location: {
                countryCode: 'US',
                regionCode: 'NC',
              },
              founded: {
                year: 2003,
              },
              website: 'https://www.nurse.com/',
            },
            {
              id: 'did:velocity:0xb7123f075a2346b3dab094d1d7f723e65ee9c0dc#issuer',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Course'],
            },
          ],
          created: '2020-10-13T12:31:00.667Z',
          updated: '2020-10-14T16:40:51.186Z',
          proof: {
            created: '2021-01-24T11:39:33.043Z',
            jws: '304502210090ffd144fdbdccf2a5909e51d3e6b6008fb6f00a6b3ed8f020bc2071cd5d367e022062311304324f5e667def466178e51c455ceaea889903750e7b8738aa2c1c674c',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Nurse.com',
          location: {
            countryCode: 'US',
            regionCode: 'NC',
          },
          logo: 'https://okhqy6-qa9n4wisj6mm.cloudmaestro.com/vRrXjhhzg/media/logo/stores/1/aNurse_Relias.png.pagespeed.ic.o42QvjhTkJ.webp',
          website: 'https://www.nurse.com/',
          founded: '2003',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0xb7123f075a2346b3dab094d1d7f723e65ee9c0dc',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xb7123f075a2346b3dab094d1d7f723e65ee9c0dc/resolve-vc/did:velocity:04e931ce9479805b30d7f5602d4b116a2f5e0f3ecf4f9c3942e72059364c3d619842bd91e6e34f09cdde7f331a64304bb7fff9af990fe93c1a7a4f1c2373a59165',
        },
      },
      {
        id: 'did:velocity:0x9d00e6bfd61d7b15502c5909aa621d5777fe445a',
        didDoc: {
          id: 'did:velocity:0x9d00e6bfd61d7b15502c5909aa621d5777fe445a',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x9d00e6bfd61d7b15502c5909aa621d5777fe445a#key-1',
              type: 'EcdsaSecp256k1Signature2019',
              controller: 'did:velocity:0x9d00e6bfd61d7b15502c5909aa621d5777fe445a',
              publicKeyBase58:
                'RPBrzsLr4eUSKuJTTjUETcwrN1yay17AmRPVRwfAmobdSDYKCqg4gdsdtdGhg4Am3XeYabCzYYtjNv3SyJMYx1qG',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              type: 'BasicProfileInformation',
              name: 'Campo Verde Nursing Home',
              logo: 'https://docs.velocitycareerlabs.io/Logos/Campo-Verde-320px.png',
              location: {
                countryCode: 'US',
                regionCode: 'FL',
              },
              founded: {
                year: 1998,
              },
            },
            {
              id: 'did:velocity:0x9d00e6bfd61d7b15502c5909aa621d5777fe445a#issuer',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['Badge'],
            },
          ],
          created: '2020-10-13T12:33:24.093Z',
          updated: '2020-11-24T21:21:24.858Z',
          proof: {
            created: '2021-01-24T11:39:33.037Z',
            jws: '3045022055b7e27efeb345d53fd4f70eb43125dab16863f394ed895849f324587f6ba8ca022100a90d5ed984bad51e19e6d1c826a05ce90c9a61b51a54b2e87dd3e1146aa26b7e',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Campo Verde Nursing Home',
          location: {
            countryCode: 'US',
            regionCode: 'FL',
          },
          logo: 'https://docs.velocitycareerlabs.io/Logos/Campo-Verde-320px.png',
          website: 'https://example.com',
          founded: '1998',
          permittedVelocityServiceCategory: ['', 'Issuer'],
          did: 'did:velocity:0x9d00e6bfd61d7b15502c5909aa621d5777fe445a',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x9d00e6bfd61d7b15502c5909aa621d5777fe445a/resolve-vc/did:velocity:04134d318d2658e5b88248c31251ff776ee472417a55edb08c3ddb582d3d41733d3b4ce13ec5609514c1c3387ec8f37ee6f13110bfa0d8497b4b80c2f31ce23ecb',
        },
      },
      {
        id: 'did:velocity:0xd09d3ef30e96b0decc78ddc661137b89b3b5abd4',
        didDoc: {
          id: 'did:velocity:0xd09d3ef30e96b0decc78ddc661137b89b3b5abd4',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xd09d3ef30e96b0decc78ddc661137b89b3b5abd4#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0xd09d3ef30e96b0decc78ddc661137b89b3b5abd4',
              publicKeyBase58:
                'PPNjkbtKTw9tUXN97DLTGG1AXDrJGMYc44XPJAvqCKSvY8bVKjCEy15URZJCsTNhpH3K67UcZgiciSyZGNqKLDp1',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0xd09d3ef30e96b0decc78ddc661137b89b3b5abd4#velocity-id-verification-credential-agent-issuer-1',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devidverifagent.velocitycareerlabs.io',
              credentialTypes: ['IdDocumentV1.0'],
            },
            {
              id: 'did:velocity:0xd09d3ef30e96b0decc78ddc661137b89b3b5abd4#issuer',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              credentialTypes: ['EmailV1.0', 'PhoneV1.0'],
            },
            {
              type: 'BasicProfileInformation',
              name: 'Velocity Identity Verification',
              logo: 'https://www.velocitycareerlabs.com/',
              location: {
                countryCode: 'IL',
              },
              founded: {
                day: 1,
                month: 1,
                year: 2020,
              },
            },
          ],
          created: '2020-12-01T12:04:04.578Z',
          updated: '2021-06-16T11:12:23.023Z',
          proof: {
            created: '2021-06-16T11:12:23.023Z',
            jws: '3045022054cd4490d22060961283d8e6f3e23685387958636bddf576525f321ddac4aa53022100bc6c286cc18ded6ab579aaf403bc820aa30f82732a7cb330fafb55eaab8204d2',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Velocity Identity Verification',
          location: {
            countryCode: 'IL',
          },
          logo: 'https://www.velocitycareerlabs.com/',
          website: 'https://example.com',
          founded: '2020-01-01',
          permittedVelocityServiceCategory: ['Issuer', ''],
          did: 'did:velocity:0xd09d3ef30e96b0decc78ddc661137b89b3b5abd4',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xd09d3ef30e96b0decc78ddc661137b89b3b5abd4/resolve-vc/did:velocity:0493d48256f8accedebe450227263172e5f03b640108a9d813b76eea5cbef8ec685725a605535755ed28f0065dc41c6f9b7e7a6acabd39442b91b13dd95ac06b0e',
        },
      },
      {
        id: 'did:velocity:0x2c20d6cf2565b31477984d9c51ab18122a02d971',
        didDoc: {
          id: 'did:velocity:0x2c20d6cf2565b31477984d9c51ab18122a02d971',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x2c20d6cf2565b31477984d9c51ab18122a02d971#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x2c20d6cf2565b31477984d9c51ab18122a02d971',
              publicKeyBase58:
                'PjSsJyDkLEnK8ste8MyDB9jNEChFxpfbwTRPoD2TpS3d3HWxRcxh8UDjng6A6bmEH2i6DiaHe5tWTN2SskDLymWx',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0x2c20d6cf2565b31477984d9c51ab18122a02d971#credential-agent-issuer-1',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              credentialTypes: [
                'PastEmploymentPosition',
                'CurrentEmploymentPosition',
                'Course',
                'Badge',
                'Assessment',
                'EducationDegree',
              ],
            },
            {
              id: 'did:velocity:0x2c20d6cf2565b31477984d9c51ab18122a02d971#credential-agent-inspector-1',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              type: 'VelocityCredentialAgentInspector_v1.0',
            },
            {
              id: 'did:velocity:0x2c20d6cf2565b31477984d9c51ab18122a02d971#credential-agent-provider-1',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              type: 'VelocityCredentialAgentServiceProvider_v1.0',
            },
            {
              type: 'BasicProfileInformation',
              name: '<API TEST>',
              location: {
                countryCode: 'US',
                regionCode: 'GA',
              },
              founded: {
                year: 2000,
              },
              logo: 'https://example.com/logo.png',
            },
          ],
          created: '2020-12-30T07:06:51.443Z',
          updated: '2020-12-30T07:06:51.569Z',
          proof: {
            created: '2021-01-24T11:39:33.022Z',
            jws: '30450221008d73977ac2d2b9607dc6685d8647e5e1a7abe454b3f116a4bccb12ad68a24bef0220498df2be594ca4519e158079aa7abdf78064aec076938d8cdfde5bd9cbdd1884',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: '<API TEST>',
          location: {
            countryCode: 'US',
            regionCode: 'GA',
          },
          logo: 'https://example.com/logo.png',
          website: 'https://example.com',
          founded: '2000',
          permittedVelocityServiceCategory: ['Issuer', 'Inspector', ''],
          did: 'did:velocity:0x2c20d6cf2565b31477984d9c51ab18122a02d971',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x2c20d6cf2565b31477984d9c51ab18122a02d971/resolve-vc/did:velocity:042b92d38561eba506bad6c85c830309858d43fe4a0f4b0c6bb6962a8add68544bf67e75ffc5419c0448a0b68ca0302d44ee91f5745c33bd53bdc464bd63834839',
        },
      },
      {
        id: 'did:velocity:0xce7530a0d9fe0fcf7957eced8d3e3e7985450978',
        didDoc: {
          id: 'did:velocity:0xce7530a0d9fe0fcf7957eced8d3e3e7985450978',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0xce7530a0d9fe0fcf7957eced8d3e3e7985450978#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0xce7530a0d9fe0fcf7957eced8d3e3e7985450978',
              publicKeyBase58:
                'MgyBj9PiEpk1n2kJMP4FXQBgjkTUw3kkDZTxE5Fa39eNb6iUcUSqeFf9rE4v8AtzgETvLBCQ3nGQSJ2UPHhwp7cy',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0xce7530a0d9fe0fcf7957eced8d3e3e7985450978#credential-agent-issuer-1',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              credentialTypes: [
                'PastEmploymentPosition',
                'CurrentEmploymentPosition',
                'Course',
                'Badge',
                'Assessment',
                'EducationDegree',
              ],
            },
            {
              type: 'BasicProfileInformation',
              name: '<Simple Issuer>',
              location: {
                countryCode: 'US',
                regionCode: 'GA',
              },
              founded: {
                year: 2002,
              },
              logo: 'https://example.com/logo.png',
            },
          ],
          created: '2020-12-30T07:56:39.068Z',
          updated: '2020-12-30T07:56:39.073Z',
          proof: {
            created: '2021-01-24T11:39:33.015Z',
            jws: '304502206d70abe0f785432333aa291c4ce8b385013cc9e2b5d1e5287c284569f0213627022100f965e3f5c3b187a9e549aaa4b33b21bd57f3663ca1492456ac5c62d77d4507c8',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: '<Simple Issuer>',
          location: {
            countryCode: 'US',
            regionCode: 'GA',
          },
          logo: 'https://example.com/logo.png',
          website: 'https://example.com',
          founded: '2002',
          permittedVelocityServiceCategory: ['Issuer', ''],
          did: 'did:velocity:0xce7530a0d9fe0fcf7957eced8d3e3e7985450978',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0xce7530a0d9fe0fcf7957eced8d3e3e7985450978/resolve-vc/did:velocity:04ef8ff728b8637b12cc33aaf618500a72f0302b76c5ac607d1b26a34032e4f10293299878015cc206664ec1ab0f61f7169353d2b1eb2d46e3e3fee61baa3c713e',
        },
      },
      {
        id: 'did:velocity:0x63d8ae6878f2182de7012ed983f271a6eff2c948',
        didDoc: {
          id: 'did:velocity:0x63d8ae6878f2182de7012ed983f271a6eff2c948',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x63d8ae6878f2182de7012ed983f271a6eff2c948#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x63d8ae6878f2182de7012ed983f271a6eff2c948',
              publicKeyBase58:
                'Q23LicJUxF8T5DiDfsZQgATBE3TLk36VpCXUZK7fFepgmKRWLjc5Cn9MguodK4Wr8T3wmjSUzMjo3LoCKTv69ud7',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0x63d8ae6878f2182de7012ed983f271a6eff2c948#credential-agent-inspector-1',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              type: 'VelocityCredentialAgentInspector_v1.0',
            },
            {
              type: 'BasicProfileInformation',
              name: 'Inspector',
              location: {
                countryCode: 'US',
                regionCode: 'CA',
              },
              founded: {
                year: 2019,
              },
              logo: 'https://example.com/logo.png',
            },
          ],
          created: '2020-12-30T08:04:09.196Z',
          updated: '2020-12-30T08:04:09.204Z',
          proof: {
            created: '2021-01-24T11:39:33.005Z',
            jws: '3045022100fe95c8097ca8c5185fba1541a98a382d4028ab6ec491c45cd596fa5160e80a750220416513ba1bee0577938cbf3022a94436771c9749be919dba84fb55fcccdf58f7',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Inspector',
          location: {
            countryCode: 'US',
            regionCode: 'CA',
          },
          logo: 'https://example.com/logo.png',
          website: 'https://example.com',
          founded: '2019',
          permittedVelocityServiceCategory: ['Inspector', ''],
          did: 'did:velocity:0x63d8ae6878f2182de7012ed983f271a6eff2c948',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x63d8ae6878f2182de7012ed983f271a6eff2c948/resolve-vc/did:velocity:04d57bf4023b778a1d5e6eda05e6307cf7ac07f924e2b60380558fbb01acbf3920bfe6dad5e4accd69c9e7e9b22ae8cf1c4e894834497603ca454377a6f401ea20',
        },
      },
      {
        id: 'did:velocity:0x547cb9fc23c47c8df6aa60825aa9f3b671fe234e',
        didDoc: {
          id: 'did:velocity:0x547cb9fc23c47c8df6aa60825aa9f3b671fe234e',
          controller: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
          publicKey: [
            {
              id: 'did:velocity:0x547cb9fc23c47c8df6aa60825aa9f3b671fe234e#key-1',
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: 'did:velocity:0x547cb9fc23c47c8df6aa60825aa9f3b671fe234e',
              publicKeyBase58:
                'MwuzdY2fQcDhW4ouBSWXsj618T1hhSkJeewAdeRo4WxA9PohomcskarpjecZ9eyemBRx57dbNEjeMr1SwSFo2YUM',
            },
          ],
          authentication: ['did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1'],
          service: [
            {
              id: 'did:velocity:0x547cb9fc23c47c8df6aa60825aa9f3b671fe234e#credential-agent-issuer-1',
              serviceEndpoint: 'https://devagent.velocitycareerlabs.io',
              type: 'VelocityCredentialAgentIssuer_v1.0',
              credentialTypes: [
                'PastEmploymentPosition',
                'CurrentEmploymentPosition',
                'Course',
                'Badge',
                'Assessment',
                'EducationDegree',
              ],
            },
            {
              type: 'BasicProfileInformation',
              name: 'Test Issuer',
              location: {
                countryCode: 'US',
                regionCode: 'CA',
              },
              founded: {
                year: 2020,
              },
              logo: 'https://example.com/logo.png',
            },
          ],
          created: '2020-12-30T08:26:16.648Z',
          updated: '2021-04-02T06:17:07.482Z',
          proof: {
            created: '2021-04-02T06:17:07.482Z',
            jws: '3046022100a2ab2fea2b7d333ba5dc7b89b110cc4fce3043de45000005bf2c37cabb7ed16a022100fc858af04e2a868a840d6ec0207813a2f76d8066b64187e0c64e09af812aa190',
            proofPurpose: 'assertionMethod',
            type: 'EcdsaSecp256k1Signature2019',
            verificationMethod: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1#key-1',
          },
        },
        profile: {
          name: 'Test Issuer',
          location: {
            countryCode: 'US',
            regionCode: 'CA',
          },
          logo: 'https://example.com/logo.png',
          website: 'https://example.com',
          founded: '2020',
          permittedVelocityServiceCategory: ['Issuer', ''],
          did: 'did:velocity:0x547cb9fc23c47c8df6aa60825aa9f3b671fe234e',
          verifiableCredentialJwt:
            'https://devregistrar.velocitynetwork.foundation/api/v0.6/organizations/did:velocity:0x547cb9fc23c47c8df6aa60825aa9f3b671fe234e/resolve-vc/did:velocity:049dc109649517d7449c7e591b292e3df80cc10704d9f9e9dc292ad414e44ef5037fb0da54ae12174c15e2d8b501da2bc686f0056163c487d5a499f01c184b061c',
        },
      },
    ],
  },
});

export default dataProvider;
