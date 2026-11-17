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

const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const { forEach, map, omit } = require('lodash/fp');
const {
  didServiceSchema,
  modifyDidServiceSchema,
  registrarMessage,
  registrarMessageResponse,
} = require('@verii/common-schemas');
const {
  generateKeyPair,
  hexFromJwk,
  jwkFromSecp256k1Key,
  KeyPurposes,
} = require('@verii/crypto');
const { leadingZeroSecp256k1Keys } = require('@verii/sample-data');

const buildFastify = require('./helpers/build-fastify');
const { buildCaoKeyTransfer } = require('../src/entities');

const generateKmsEntry = (curve = 'secp256k1') => ({
  privateJwk: generateKeyPair({ format: 'jwk', curve }).privateKey,
});

const publicJwkOf = (privateJwk) => omit(['d'], privateJwk);

const createTenantMessage = (keys) => ({
  messageType: 'create_tenant',
  messageId: 'message-1',
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
      keys,
    },
  },
});

// The key set #1143 generates for a new custodied organization with
// ES256_ORGANIZATION_KEYS on.
const es256OrganizationKeys = [
  {
    id: '#vc-signing-key-1',
    algorithm: 'ES256',
    purposes: [KeyPurposes.ISSUING_METADATA],
    curve: 'P-256',
  },
  {
    id: '#eth-account-key-1',
    algorithm: 'SECP256K1',
    purposes: [KeyPurposes.DLT_TRANSACTIONS],
    curve: 'secp256k1',
  },
  {
    id: '#exchange-key-1',
    algorithm: 'ES256',
    purposes: [KeyPurposes.EXCHANGES],
    curve: 'P-256',
  },
];

const dltKey = {
  id: '#eth-account-key-1',
  algorithm: 'SECP256K1',
  purposes: [KeyPurposes.DLT_TRANSACTIONS],
};

describe('buildCaoKeyTransfer', () => {
  let fastify;
  let validateMessage;
  let validateResponse;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    // The oracle validates every message with these schemas before sending it.
    forEach(
      (schema) => fastify.addDocSchema(schema, true),
      [
        modifyDidServiceSchema,
        didServiceSchema,
        registrarMessage,
        registrarMessageResponse,
      ],
    );
    validateMessage = fastify.getDocValidator('registrar-message');
    validateResponse = fastify.getDocValidator('registrar-message-response');
  });

  after(async () => {
    await fastify.close();
  });

  const validationResult = (validate, document) => {
    const valid = validate(document);
    return { valid, errors: validate.errors };
  };

  const expectValidMessage = (keys) =>
    expect(
      validationResult(validateMessage, createTenantMessage(keys)),
    ).toEqual({ valid: true, errors: null });

  const expectInvalidMessage = (keys) =>
    expect(
      validationResult(validateMessage, createTenantMessage(keys)).valid,
    ).toEqual(false);

  const dualDeclaration = { encodings: ['hex', 'jwk'] };

  describe('without a declaration from the CAO', () => {
    it('should send a secp256k1 key only as hex, as the registrar does today', () => {
      const kmsEntry = generateKmsEntry();

      const key = buildCaoKeyTransfer(dltKey, kmsEntry);

      expect(key).toEqual({
        kidFragment: '#eth-account-key-1',
        algorithm: 'SECP256K1',
        purposes: [KeyPurposes.DLT_TRANSACTIONS],
        encoding: 'hex',
        key: hexFromJwk(kmsEntry.privateJwk),
        publicKey: hexFromJwk(kmsEntry.privateJwk, false),
      });
      expectValidMessage([key]);
    });

    it('should refuse a P-256 key', () => {
      expect(() =>
        buildCaoKeyTransfer(
          es256OrganizationKeys[0],
          generateKmsEntry('P-256'),
        ),
      ).toThrow(
        expect.objectContaining({
          statusCode: 400,
          errorCode: 'key_algorithm_not_accepted',
          message: "The CAO hasn't declared that it accepts ES256 keys",
        }),
      );
    });

    it('should treat empty declarations as no declaration', () => {
      const kmsEntry = generateKmsEntry();
      expect(
        buildCaoKeyTransfer(dltKey, kmsEntry, {
          algorithms: [],
          encodings: [],
        }),
      ).toEqual(buildCaoKeyTransfer(dltKey, kmsEntry));
    });

    it('should treat declarations of only unknown values as no declaration', () => {
      const kmsEntry = generateKmsEntry();
      expect(
        buildCaoKeyTransfer(dltKey, kmsEntry, {
          algorithms: ['ML-DSA-65'],
          encodings: ['cbor'],
        }),
      ).toEqual(buildCaoKeyTransfer(dltKey, kmsEntry));
    });
  });

  describe('with a declaration from the CAO', () => {
    it('should send a secp256k1 key as hex and as JWKs when the CAO reads both', () => {
      const kmsEntry = generateKmsEntry();

      const key = buildCaoKeyTransfer(dltKey, kmsEntry, dualDeclaration);

      expect(key).toEqual({
        kidFragment: '#eth-account-key-1',
        algorithm: 'SECP256K1',
        purposes: [KeyPurposes.DLT_TRANSACTIONS],
        encoding: 'hex',
        key: hexFromJwk(kmsEntry.privateJwk),
        publicKey: hexFromJwk(kmsEntry.privateJwk, false),
        jwk: kmsEntry.privateJwk,
        publicJwk: publicJwkOf(kmsEntry.privateJwk),
      });
      expect(omit(['use'], jwkFromSecp256k1Key(key.key))).toEqual(key.jwk);
      expectValidMessage([key]);
    });

    it('should send a secp256k1 key only as JWKs when the CAO reads only JWKs', () => {
      const kmsEntry = generateKmsEntry();

      const key = buildCaoKeyTransfer(dltKey, kmsEntry, {
        encodings: ['jwk'],
      });

      expect(key).toEqual({
        kidFragment: '#eth-account-key-1',
        algorithm: 'SECP256K1',
        purposes: [KeyPurposes.DLT_TRANSACTIONS],
        encoding: 'jwk',
        jwk: kmsEntry.privateJwk,
        publicJwk: publicJwkOf(kmsEntry.privateJwk),
      });
      expectValidMessage([key]);
    });

    it('should send P-256 keys only as JWKs to a CAO that declared ES256', () => {
      const kmsEntries = map(
        ({ curve }) => generateKmsEntry(curve),
        es256OrganizationKeys,
      );

      const keys = es256OrganizationKeys.map((organizationKey, i) =>
        buildCaoKeyTransfer(organizationKey, kmsEntries[i], {
          algorithms: ['SECP256K1', 'ES256'],
          encodings: ['hex', 'jwk'],
        }),
      );

      expect(keys).toEqual([
        {
          kidFragment: '#vc-signing-key-1',
          algorithm: 'ES256',
          purposes: [KeyPurposes.ISSUING_METADATA],
          encoding: 'jwk',
          jwk: kmsEntries[0].privateJwk,
          publicJwk: publicJwkOf(kmsEntries[0].privateJwk),
        },
        {
          kidFragment: '#eth-account-key-1',
          algorithm: 'SECP256K1',
          purposes: [KeyPurposes.DLT_TRANSACTIONS],
          encoding: 'hex',
          key: hexFromJwk(kmsEntries[1].privateJwk),
          publicKey: hexFromJwk(kmsEntries[1].privateJwk, false),
          jwk: kmsEntries[1].privateJwk,
          publicJwk: publicJwkOf(kmsEntries[1].privateJwk),
        },
        {
          kidFragment: '#exchange-key-1',
          algorithm: 'ES256',
          purposes: [KeyPurposes.EXCHANGES],
          encoding: 'jwk',
          jwk: kmsEntries[2].privateJwk,
          publicJwk: publicJwkOf(kmsEntries[2].privateJwk),
        },
      ]);
      expectValidMessage(keys);
    });

    it('should send P-256 keys as JWKs to a CAO that declared ES256 but no encodings', () => {
      const kmsEntry = generateKmsEntry('P-256');

      const key = buildCaoKeyTransfer(es256OrganizationKeys[0], kmsEntry, {
        algorithms: ['SECP256K1', 'ES256'],
      });

      expect(key).toEqual({
        kidFragment: '#vc-signing-key-1',
        algorithm: 'ES256',
        purposes: [KeyPurposes.ISSUING_METADATA],
        encoding: 'jwk',
        jwk: kmsEntry.privateJwk,
        publicJwk: publicJwkOf(kmsEntry.privateJwk),
      });
      expectValidMessage([key]);
    });

    it('should ignore declared values it does not know', () => {
      const kmsEntry = generateKmsEntry();
      expect(
        buildCaoKeyTransfer(dltKey, kmsEntry, {
          algorithms: ['SECP256K1', 'ML-DSA-65'],
          encodings: ['hex', 'jwk', 'cbor'],
        }),
      ).toEqual(buildCaoKeyTransfer(dltKey, kmsEntry, dualDeclaration));
    });
  });

  describe('key material', () => {
    it('should send only the key members of the KMS JWK', () => {
      const kmsEntry = generateKmsEntry();
      const decoratedJwk = {
        ...kmsEntry.privateJwk,
        use: 'sig',
        kid: '#eth-account-key-1',
        alg: 'ES256K',
      };

      const key = buildCaoKeyTransfer(
        dltKey,
        { privateJwk: decoratedJwk },
        dualDeclaration,
      );

      expect(key.jwk).toEqual(kmsEntry.privateJwk);
      expect(key.publicJwk).toEqual(publicJwkOf(kmsEntry.privateJwk));
    });

    it('should derive the algorithm from the curve of a key stored without one', () => {
      const kmsEntry = generateKmsEntry();
      expect(
        buildCaoKeyTransfer(omit(['algorithm'], dltKey), kmsEntry),
      ).toEqual(buildCaoKeyTransfer(dltKey, kmsEntry));
    });

    it('should throw when the algorithm does not match the curve', () => {
      expect(() =>
        buildCaoKeyTransfer(
          { ...dltKey, algorithm: 'ES256' },
          generateKmsEntry(),
          { algorithms: ['SECP256K1', 'ES256'] },
        ),
      ).toThrow("Key algorithm ES256 doesn't match its secp256k1 key");
    });

    it('should throw for a curve that cannot be transferred', () => {
      expect(() =>
        buildCaoKeyTransfer(dltKey, {
          privateJwk: generateKeyPair({ format: 'jwk', curve: 'P-384' })
            .privateKey,
        }),
      ).toThrow("Keys on curve P-384 can't be transferred");
    });

    Object.entries(leadingZeroSecp256k1Keys).forEach(([member, vector]) => {
      it(`should keep every byte of a key whose ${member} starts with a zero byte`, () => {
        const key = buildCaoKeyTransfer(
          dltKey,
          { privateJwk: vector.privateJwk },
          dualDeclaration,
        );

        expect(key).toEqual(
          expect.objectContaining({
            key: vector.privateKeyHex,
            publicKey: vector.publicKeyHex,
            jwk: vector.privateJwk,
            publicJwk: vector.publicJwk,
          }),
        );
        expectValidMessage([key]);
      });
    });
  });

  describe('registrar-message schema', () => {
    it('should accept a legacy hex-only key', () => {
      const { privateJwk } = generateKmsEntry();
      expectValidMessage([
        {
          kidFragment: '#eth-account-key-1',
          purposes: [KeyPurposes.DLT_TRANSACTIONS],
          algorithm: 'SECP256K1',
          encoding: 'hex',
          key: hexFromJwk(privateJwk),
          publicKey: hexFromJwk(privateJwk, false),
        },
      ]);
    });

    it('should reject an ES256 key sent as hex', () => {
      const { privateJwk } = generateKmsEntry('P-256');
      expectInvalidMessage([
        {
          kidFragment: '#vc-signing-key-1',
          purposes: [KeyPurposes.ISSUING_METADATA],
          algorithm: 'ES256',
          encoding: 'hex',
          key: hexFromJwk(privateJwk),
          publicKey: hexFromJwk(privateJwk, false),
        },
      ]);
    });

    it('should reject an ES256 key that carries hex alongside its JWKs', () => {
      const { privateJwk } = generateKmsEntry('P-256');
      expectInvalidMessage([
        {
          kidFragment: '#vc-signing-key-1',
          purposes: [KeyPurposes.ISSUING_METADATA],
          algorithm: 'ES256',
          encoding: 'jwk',
          key: hexFromJwk(privateJwk),
          jwk: privateJwk,
          publicJwk: publicJwkOf(privateJwk),
        },
      ]);
    });

    it('should reject an ES256 key without a private JWK', () => {
      const { privateJwk } = generateKmsEntry('P-256');
      expectInvalidMessage([
        {
          kidFragment: '#vc-signing-key-1',
          purposes: [KeyPurposes.ISSUING_METADATA],
          algorithm: 'ES256',
          encoding: 'jwk',
          publicJwk: publicJwkOf(privateJwk),
        },
      ]);
    });

    it('should reject a public JWK that carries the private key', () => {
      const { privateJwk } = generateKmsEntry();
      expectInvalidMessage([
        {
          ...buildCaoKeyTransfer(dltKey, { privateJwk }, dualDeclaration),
          publicJwk: privateJwk,
        },
      ]);
    });

    it('should accept an ack declaring capabilities, including unknown values', () => {
      expect(
        validationResult(validateResponse, {
          messageType: 'ack',
          messageId: '1234',
          keyTransfer: {
            algorithms: ['SECP256K1', 'ES256', 'ML-DSA-65'],
            encodings: ['jwk'],
          },
        }),
      ).toEqual({ valid: true, errors: null });
    });
  });
});
