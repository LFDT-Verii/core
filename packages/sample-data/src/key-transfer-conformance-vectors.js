/*
 * Copyright 2026 Velocity Team
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

const { leadingZeroSecp256k1Keys } = require('./key-transfer-vectors');

// Conformance vectors for CAO receivers of the registrar's create_tenant
// secure message. Each vector is a complete message, and the result a receiver
// should reach when it imports the message's keys:
// - accepted: for each key, its kidFragment, whether its private key was
//   imported from `jwk` or `hex`, and the public JWK (kty, crv, x and y) the
//   receiver ends up with;
// - rejected: the key the receiver must refuse and the errorCode it reports. A
//   receiver that rejects a message imports none of its keys.
// The keys are test keys. Never use them outside tests.
const keyTransferConformanceVectors = {
  // A secp256k1 key sent as hex and as JWKs, as the registrar sends it to a CAO
  // that declared `encodings: ["hex", "jwk"]`. The JWK is imported.
  dualSecp256k1: {
    message: {
      messageType: 'create_tenant',
      messageId: 'conformance-dual-secp256k1',
      payload: {
        caoDid: 'did:web:cao.example.com',
        caoService: {
          id: 'did:web:cao.example.com#credential-agent-operator-1',
          type: 'VlcCredentialAgentOperator_v1',
          serviceEndpoint: 'https://agent.cao.example.com',
        },
        create_tenant: {
          did: 'did:web:org.example.com',
          serviceIds: ['#issuer-1'],
          keys: [
            {
              kidFragment: '#eth-account-key-1',
              algorithm: 'SECP256K1',
              purposes: ['DLT_TRANSACTIONS'],
              encoding: 'hex',
              key: '3119ceff58a468ab01007e1b14520a319f21105e0cd8f43b42713528bb8c7e24',
              publicKey:
                '0401f2b2577ee3a756151a62dd84b0899361c4fb53ce6efea5331aef97dc32e2afc03952dea4b1ad887c9f02a4fd6a554167c07378a97839405b0ce40b8a7dda0a',
              jwk: {
                kty: 'EC',
                crv: 'secp256k1',
                x: 'AfKyV37jp1YVGmLdhLCJk2HE-1PObv6lMxrvl9wy4q8',
                y: 'wDlS3qSxrYh8nwKk_WpVQWfAc3ipeDlAWwzkC4p92go',
                d: 'MRnO_1ikaKsBAH4bFFIKMZ8hEF4M2PQ7QnE1KLuMfiQ',
              },
              publicJwk: {
                kty: 'EC',
                crv: 'secp256k1',
                x: 'AfKyV37jp1YVGmLdhLCJk2HE-1PObv6lMxrvl9wy4q8',
                y: 'wDlS3qSxrYh8nwKk_WpVQWfAc3ipeDlAWwzkC4p92go',
              },
            },
          ],
        },
      },
    },
    expected: {
      accepted: true,
      keys: [
        {
          kidFragment: '#eth-account-key-1',
          importedFrom: 'jwk',
          publicJwk: {
            kty: 'EC',
            crv: 'secp256k1',
            x: 'AfKyV37jp1YVGmLdhLCJk2HE-1PObv6lMxrvl9wy4q8',
            y: 'wDlS3qSxrYh8nwKk_WpVQWfAc3ipeDlAWwzkC4p92go',
          },
        },
      ],
    },
  },

  // A secp256k1 key sent only as JWKs, as the registrar sends it to a CAO that
  // declared `encodings: ["jwk"]`.
  jwkOnlySecp256k1: {
    message: {
      messageType: 'create_tenant',
      messageId: 'conformance-jwk-only-secp256k1',
      payload: {
        caoDid: 'did:web:cao.example.com',
        caoService: {
          id: 'did:web:cao.example.com#credential-agent-operator-1',
          type: 'VlcCredentialAgentOperator_v1',
          serviceEndpoint: 'https://agent.cao.example.com',
        },
        create_tenant: {
          did: 'did:web:org.example.com',
          serviceIds: ['#issuer-1'],
          keys: [
            {
              kidFragment: '#eth-account-key-1',
              algorithm: 'SECP256K1',
              purposes: ['DLT_TRANSACTIONS'],
              encoding: 'jwk',
              jwk: {
                kty: 'EC',
                crv: 'secp256k1',
                x: '9AJnhXGfDPtpf2s4coAWJ41UVT0x5x4Q5s92psqgdrc',
                y: '-Twv8ud-sP4jIAaSTiJgD6AI7KfLTLvxvvg_CLdyWJU',
                d: 'Orm6LE7zWBGsFLMKhB9hi6UUWWSQWuCkZRWYEIFDyXY',
              },
              publicJwk: {
                kty: 'EC',
                crv: 'secp256k1',
                x: '9AJnhXGfDPtpf2s4coAWJ41UVT0x5x4Q5s92psqgdrc',
                y: '-Twv8ud-sP4jIAaSTiJgD6AI7KfLTLvxvvg_CLdyWJU',
              },
            },
          ],
        },
      },
    },
    expected: {
      accepted: true,
      keys: [
        {
          kidFragment: '#eth-account-key-1',
          importedFrom: 'jwk',
          publicJwk: {
            kty: 'EC',
            crv: 'secp256k1',
            x: '9AJnhXGfDPtpf2s4coAWJ41UVT0x5x4Q5s92psqgdrc',
            y: '-Twv8ud-sP4jIAaSTiJgD6AI7KfLTLvxvvg_CLdyWJU',
          },
        },
      ],
    },
  },

  // A P-256 key, which is always sent only as JWKs, and only to a CAO that
  // declared `algorithms: ["ES256"]`.
  jwkOnlyP256: {
    message: {
      messageType: 'create_tenant',
      messageId: 'conformance-jwk-only-p256',
      payload: {
        caoDid: 'did:web:cao.example.com',
        caoService: {
          id: 'did:web:cao.example.com#credential-agent-operator-1',
          type: 'VlcCredentialAgentOperator_v1',
          serviceEndpoint: 'https://agent.cao.example.com',
        },
        create_tenant: {
          did: 'did:web:org.example.com',
          serviceIds: ['#issuer-1'],
          keys: [
            {
              kidFragment: '#exchange-key-1',
              algorithm: 'ES256',
              purposes: ['EXCHANGES'],
              encoding: 'jwk',
              jwk: {
                kty: 'EC',
                crv: 'P-256',
                x: 'WyCvlrt-VKmK9l2lhvBoq0SODSh_h4VRi306wLlBXXY',
                y: 'UOr2cVPHkRt1vu2yGNODJYHIyN1uucsP1-i-jmWyXc8',
                d: 'ECbwNqgnFOad98rRuSQoqg_PapyejPA5X0Vnk2Y_M8g',
              },
              publicJwk: {
                kty: 'EC',
                crv: 'P-256',
                x: 'WyCvlrt-VKmK9l2lhvBoq0SODSh_h4VRi306wLlBXXY',
                y: 'UOr2cVPHkRt1vu2yGNODJYHIyN1uucsP1-i-jmWyXc8',
              },
            },
          ],
        },
      },
    },
    expected: {
      accepted: true,
      keys: [
        {
          kidFragment: '#exchange-key-1',
          importedFrom: 'jwk',
          publicJwk: {
            kty: 'EC',
            crv: 'P-256',
            x: 'WyCvlrt-VKmK9l2lhvBoq0SODSh_h4VRi306wLlBXXY',
            y: 'UOr2cVPHkRt1vu2yGNODJYHIyN1uucsP1-i-jmWyXc8',
          },
        },
      ],
    },
  },

  // The keys of an organization created with ES256_ORGANIZATION_KEYS on, as the
  // registrar sends them to a CAO that declared `algorithms: ["SECP256K1", "ES256"]`
  // and `encodings: ["hex", "jwk"]`: JWK-only P-256 issuing and exchange keys, and a
  // secp256k1 DLT key sent as hex and as JWKs.
  es256Organization: {
    message: {
      messageType: 'create_tenant',
      messageId: 'conformance-es256-organization',
      payload: {
        caoDid: 'did:web:cao.example.com',
        caoService: {
          id: 'did:web:cao.example.com#credential-agent-operator-1',
          type: 'VlcCredentialAgentOperator_v1',
          serviceEndpoint: 'https://agent.cao.example.com',
        },
        create_tenant: {
          did: 'did:web:org.example.com',
          serviceIds: ['#issuer-1'],
          keys: [
            {
              kidFragment: '#vc-signing-key-1',
              algorithm: 'ES256',
              purposes: ['ISSUING_METADATA'],
              encoding: 'jwk',
              jwk: {
                kty: 'EC',
                crv: 'P-256',
                x: 'pYi3DNvq8xQ-t8PieVB6fmCdYs3pNxB85ihsir0x31Y',
                y: 'GAWYOFA5y5j1PtPVlbi6lCPafVHrxOcThUeGr_JEW0M',
                d: 'LnFhFFHBleM1yVnnrkyaXkprGj_1XSgdYHMRfuIs6N8',
              },
              publicJwk: {
                kty: 'EC',
                crv: 'P-256',
                x: 'pYi3DNvq8xQ-t8PieVB6fmCdYs3pNxB85ihsir0x31Y',
                y: 'GAWYOFA5y5j1PtPVlbi6lCPafVHrxOcThUeGr_JEW0M',
              },
            },
            {
              kidFragment: '#eth-account-key-1',
              algorithm: 'SECP256K1',
              purposes: ['DLT_TRANSACTIONS'],
              encoding: 'hex',
              key: '1d4b77c8e6a583d72249c79d43fec3b6d6f04e7eb06180155f0310bf0c749802',
              publicKey:
                '04a38f14c54256bcb61a2fde7bf6c582c0b24a7c251cc512bde0cee3dd9ffe371c4a77670c6991c4e013b583ce40028c72e1e0bad7dd7c78620d25ba9ddba7846c',
              jwk: {
                kty: 'EC',
                crv: 'secp256k1',
                x: 'o48UxUJWvLYaL9579sWCwLJKfCUcxRK94M7j3Z_-Nxw',
                y: 'SndnDGmRxOATtYPOQAKMcuHgutfdfHhiDSW6ndunhGw',
                d: 'HUt3yOalg9ciScedQ_7DttbwTn6wYYAVXwMQvwx0mAI',
              },
              publicJwk: {
                kty: 'EC',
                crv: 'secp256k1',
                x: 'o48UxUJWvLYaL9579sWCwLJKfCUcxRK94M7j3Z_-Nxw',
                y: 'SndnDGmRxOATtYPOQAKMcuHgutfdfHhiDSW6ndunhGw',
              },
            },
            {
              kidFragment: '#exchange-key-1',
              algorithm: 'ES256',
              purposes: ['EXCHANGES'],
              encoding: 'jwk',
              jwk: {
                kty: 'EC',
                crv: 'P-256',
                x: 'Gr1chTzoiVcH-vCILW18rHpV1sVbfHbf5jOfUr47Sbk',
                y: 'XZ_SLpRS04oj6-sGc_LNHvvGXKi8DsQ6KoL-rm4HB-s',
                d: '5oCRqIsloSBTa0NSGM6zAtiDULvvjYlTC5viPA7Aboc',
              },
              publicJwk: {
                kty: 'EC',
                crv: 'P-256',
                x: 'Gr1chTzoiVcH-vCILW18rHpV1sVbfHbf5jOfUr47Sbk',
                y: 'XZ_SLpRS04oj6-sGc_LNHvvGXKi8DsQ6KoL-rm4HB-s',
              },
            },
          ],
        },
      },
    },
    expected: {
      accepted: true,
      keys: [
        {
          kidFragment: '#vc-signing-key-1',
          importedFrom: 'jwk',
          publicJwk: {
            kty: 'EC',
            crv: 'P-256',
            x: 'pYi3DNvq8xQ-t8PieVB6fmCdYs3pNxB85ihsir0x31Y',
            y: 'GAWYOFA5y5j1PtPVlbi6lCPafVHrxOcThUeGr_JEW0M',
          },
        },
        {
          kidFragment: '#eth-account-key-1',
          importedFrom: 'jwk',
          publicJwk: {
            kty: 'EC',
            crv: 'secp256k1',
            x: 'o48UxUJWvLYaL9579sWCwLJKfCUcxRK94M7j3Z_-Nxw',
            y: 'SndnDGmRxOATtYPOQAKMcuHgutfdfHhiDSW6ndunhGw',
          },
        },
        {
          kidFragment: '#exchange-key-1',
          importedFrom: 'jwk',
          publicJwk: {
            kty: 'EC',
            crv: 'P-256',
            x: 'Gr1chTzoiVcH-vCILW18rHpV1sVbfHbf5jOfUr47Sbk',
            y: 'XZ_SLpRS04oj6-sGc_LNHvvGXKi8DsQ6KoL-rm4HB-s',
          },
        },
      ],
    },
  },

  // secp256k1 keys whose d, x or y starts with a 0x00 byte, sent only as hex, as
  // the registrar sends them to a CAO that declared no encodings. Each imported
  // JWK member must keep all 32 bytes: 43 base64url characters.
  leadingZeroHexSecp256k1: {
    message: {
      messageType: 'create_tenant',
      messageId: 'conformance-leading-zero-hex-secp256k1',
      payload: {
        caoDid: 'did:web:cao.example.com',
        caoService: {
          id: 'did:web:cao.example.com#credential-agent-operator-1',
          type: 'VlcCredentialAgentOperator_v1',
          serviceEndpoint: 'https://agent.cao.example.com',
        },
        create_tenant: {
          did: 'did:web:org.example.com',
          serviceIds: ['#issuer-1'],
          keys: [
            {
              kidFragment: '#vc-signing-key-1',
              algorithm: 'SECP256K1',
              purposes: ['ISSUING_METADATA'],
              encoding: 'hex',
              key: leadingZeroSecp256k1Keys.d.privateKeyHex,
              publicKey: leadingZeroSecp256k1Keys.d.publicKeyHex,
            },
            {
              kidFragment: '#exchange-key-1',
              algorithm: 'SECP256K1',
              purposes: ['EXCHANGES'],
              encoding: 'hex',
              key: leadingZeroSecp256k1Keys.x.privateKeyHex,
              publicKey: leadingZeroSecp256k1Keys.x.publicKeyHex,
            },
            {
              kidFragment: '#eth-account-key-1',
              algorithm: 'SECP256K1',
              purposes: ['DLT_TRANSACTIONS'],
              encoding: 'hex',
              key: leadingZeroSecp256k1Keys.y.privateKeyHex,
              publicKey: leadingZeroSecp256k1Keys.y.publicKeyHex,
            },
          ],
        },
      },
    },
    expected: {
      accepted: true,
      keys: [
        {
          kidFragment: '#vc-signing-key-1',
          importedFrom: 'hex',
          publicJwk: leadingZeroSecp256k1Keys.d.publicJwk,
        },
        {
          kidFragment: '#exchange-key-1',
          importedFrom: 'hex',
          publicJwk: leadingZeroSecp256k1Keys.x.publicJwk,
        },
        {
          kidFragment: '#eth-account-key-1',
          importedFrom: 'hex',
          publicJwk: leadingZeroSecp256k1Keys.y.publicJwk,
        },
      ],
    },
  },

  // secp256k1 keys whose d, x or y starts with a 0x00 byte, sent as hex and as
  // JWKs. A receiver that compares the encodings must compare values, not strings
  // stripped of their leading zeros.
  leadingZeroDualSecp256k1: {
    message: {
      messageType: 'create_tenant',
      messageId: 'conformance-leading-zero-dual-secp256k1',
      payload: {
        caoDid: 'did:web:cao.example.com',
        caoService: {
          id: 'did:web:cao.example.com#credential-agent-operator-1',
          type: 'VlcCredentialAgentOperator_v1',
          serviceEndpoint: 'https://agent.cao.example.com',
        },
        create_tenant: {
          did: 'did:web:org.example.com',
          serviceIds: ['#issuer-1'],
          keys: [
            {
              kidFragment: '#vc-signing-key-1',
              algorithm: 'SECP256K1',
              purposes: ['ISSUING_METADATA'],
              encoding: 'hex',
              key: leadingZeroSecp256k1Keys.d.privateKeyHex,
              publicKey: leadingZeroSecp256k1Keys.d.publicKeyHex,
              jwk: leadingZeroSecp256k1Keys.d.privateJwk,
              publicJwk: leadingZeroSecp256k1Keys.d.publicJwk,
            },
            {
              kidFragment: '#exchange-key-1',
              algorithm: 'SECP256K1',
              purposes: ['EXCHANGES'],
              encoding: 'hex',
              key: leadingZeroSecp256k1Keys.x.privateKeyHex,
              publicKey: leadingZeroSecp256k1Keys.x.publicKeyHex,
              jwk: leadingZeroSecp256k1Keys.x.privateJwk,
              publicJwk: leadingZeroSecp256k1Keys.x.publicJwk,
            },
            {
              kidFragment: '#eth-account-key-1',
              algorithm: 'SECP256K1',
              purposes: ['DLT_TRANSACTIONS'],
              encoding: 'hex',
              key: leadingZeroSecp256k1Keys.y.privateKeyHex,
              publicKey: leadingZeroSecp256k1Keys.y.publicKeyHex,
              jwk: leadingZeroSecp256k1Keys.y.privateJwk,
              publicJwk: leadingZeroSecp256k1Keys.y.publicJwk,
            },
          ],
        },
      },
    },
    expected: {
      accepted: true,
      keys: [
        {
          kidFragment: '#vc-signing-key-1',
          importedFrom: 'jwk',
          publicJwk: leadingZeroSecp256k1Keys.d.publicJwk,
        },
        {
          kidFragment: '#exchange-key-1',
          importedFrom: 'jwk',
          publicJwk: leadingZeroSecp256k1Keys.x.publicJwk,
        },
        {
          kidFragment: '#eth-account-key-1',
          importedFrom: 'jwk',
          publicJwk: leadingZeroSecp256k1Keys.y.publicJwk,
        },
      ],
    },
  },

  // A message whose second key is sent as hex and as JWKs of two different keys.
  // The message must be rejected, and neither key imported, including the valid
  // first key.
  mismatchedDualSecp256k1: {
    message: {
      messageType: 'create_tenant',
      messageId: 'conformance-mismatched-dual-secp256k1',
      payload: {
        caoDid: 'did:web:cao.example.com',
        caoService: {
          id: 'did:web:cao.example.com#credential-agent-operator-1',
          type: 'VlcCredentialAgentOperator_v1',
          serviceEndpoint: 'https://agent.cao.example.com',
        },
        create_tenant: {
          did: 'did:web:org.example.com',
          serviceIds: ['#issuer-1'],
          keys: [
            {
              kidFragment: '#vc-signing-key-1',
              algorithm: 'SECP256K1',
              purposes: ['ISSUING_METADATA'],
              encoding: 'hex',
              key: '9212820e58fba4bc23caf7405471720dbd99a946d03b3fc1ad920d8d9f4eacae',
              publicKey:
                '041bdce03a02d4e6fa60238511df503b3ffcea0e1ec16ac2898c4d46bf621497bca40a14f33f71d635533820b2640656a30f5b315a7a31371bdc07f8cdb9bd50b7',
              jwk: {
                kty: 'EC',
                crv: 'secp256k1',
                x: 'G9zgOgLU5vpgI4UR31A7P_zqDh7BasKJjE1Gv2IUl7w',
                y: 'pAoU8z9x1jVTOCCyZAZWow9bMVp6MTcb3Af4zbm9ULc',
                d: 'khKCDlj7pLwjyvdAVHFyDb2ZqUbQOz_BrZINjZ9OrK4',
              },
              publicJwk: {
                kty: 'EC',
                crv: 'secp256k1',
                x: 'G9zgOgLU5vpgI4UR31A7P_zqDh7BasKJjE1Gv2IUl7w',
                y: 'pAoU8z9x1jVTOCCyZAZWow9bMVp6MTcb3Af4zbm9ULc',
              },
            },
            {
              kidFragment: '#eth-account-key-1',
              algorithm: 'SECP256K1',
              purposes: ['DLT_TRANSACTIONS'],
              encoding: 'hex',
              key: '5f7899e35ba6fccfbcd14f244b9a71c02ebd4b98f4187a28ed305297f5872b41',
              publicKey:
                '044f93b69bad0fb948b673e8e2dd28979269a1f528c27fad50957a7d7b1765d530624ea66823a2530c3a0d9a75b92b94553b5b5b5726e5b1366d173fc02c4b82eb',
              jwk: {
                kty: 'EC',
                crv: 'secp256k1',
                x: 'znaad0MlMVA5brhf6zzWn5GBWyH8kFU4-kuroAYGfP0',
                y: 'E1GSIcOI6gk2ktSu6zKDUBTCUqonTSNSwtjYSxhOBQ4',
                d: 'm6WEW886NNs-F3iPBNjOth9fEx8rqDujIAeYjAtYHM8',
              },
              publicJwk: {
                kty: 'EC',
                crv: 'secp256k1',
                x: 'znaad0MlMVA5brhf6zzWn5GBWyH8kFU4-kuroAYGfP0',
                y: 'E1GSIcOI6gk2ktSu6zKDUBTCUqonTSNSwtjYSxhOBQ4',
              },
            },
          ],
        },
      },
    },
    expected: {
      accepted: false,
      kidFragment: '#eth-account-key-1',
      errorCode: 'key_formats_mismatch',
    },
  },
};

module.exports = { keyTransferConformanceVectors };
