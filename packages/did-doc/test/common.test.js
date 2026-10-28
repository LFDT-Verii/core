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

const { describe, it } = require('node:test');
const { expect } = require('expect');

const { ECDH, generateKeyPairSync } = require('node:crypto');
const { default: bs58 } = require('bs58');
const { last } = require('lodash/fp');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const {
  generateKeyPair,
  hexFromJwk,
  signPayload,
  jwkFromSecp256k1Key,
} = require('@verii/crypto');

const {
  verificationKeyType,
  signatureKeyType,
  generateDidInfo,
  generatePublicKeySection,
  generateProof,
  extractVerificationJwk,
  extractVerificationKey,
} = require('../src/common');

describe('DID Documents Common', () => {
  describe('DID Information Generation', () => {
    it('Should generate valid DID information', () => {
      const { publicKey, did, kid } = generateDidInfo();

      const testOrgDid = `did:velocity:${toEthereumAddress(publicKey)}`;
      const testOrgKid = `${testOrgDid}#key-1`;

      expect(did).toEqual(testOrgDid);
      expect(kid).toEqual(testOrgKid);
    });
  });

  describe('extract public key', () => {
    const { publicKey: publicJwk } = generateKeyPair({ format: 'jwk' });
    const publicKey = hexFromJwk(publicJwk, false);
    const did = `did:key:${publicKey}`;
    const kidFragment = '#key-1';
    const kid = `${did}${kidFragment}`;

    it('should return null if kid doesnt exist', () => {
      const didDoc = {
        id: did,
        publicKey: [
          { id: kid, type: verificationKeyType, publicKeyHex: publicKey },
        ],
      };

      const didPublicKey = extractVerificationKey(didDoc, `${did}#key-2`);
      expect(didPublicKey).toEqual(null);
    });

    it('should extract publicKeyBase58', () => {
      const didDoc = {
        id: did,
        publicKey: [
          generatePublicKeySection(kid, 'did:key:0x12313131', publicKey),
        ],
      };

      const didPublicKey = extractVerificationKey(didDoc, kid);
      expect(didPublicKey).toEqual(publicKey);
    });

    it('should extract publicKeyHex', () => {
      const didDoc = {
        id: did,
        publicKey: [
          { id: kid, type: verificationKeyType, publicKeyHex: publicKey },
        ],
      };

      const didPublicKey = extractVerificationKey(didDoc, kid);
      expect(didPublicKey).toEqual(publicKey);
    });
    it('should extract publicKeyJwk for a assertionMethod', () => {
      const didDoc = {
        id: did,
        assertionMethod: [
          {
            id: kid,
            type: verificationKeyType,
            publicKeyJwk: jwkFromSecp256k1Key(publicKey, false),
          },
        ],
      };

      const didPublicKey = extractVerificationKey(didDoc, kid);
      expect(didPublicKey).toEqual(publicKey);
    });
    it('should extract publicKeyJwk using a relative url for a verificationKey', () => {
      const didDoc = {
        id: did,
        verificationMethod: [
          {
            id: `#${last(kid.split('#'))}`,
            type: verificationKeyType,
            publicKeyJwk: jwkFromSecp256k1Key(publicKey, false),
          },
        ],
      };

      const didPublicKey = extractVerificationKey(didDoc, kid);
      expect(didPublicKey).toEqual(publicKey);
    });

    it('should extract publicKey using a kidFragment with a kidFragment defined in the did doc', () => {
      const didDoc = {
        id: did,
        publicKey: [
          {
            id: kidFragment,
            type: verificationKeyType,
            publicKeyHex: publicKey,
          },
        ],
      };

      const didPublicKey = extractVerificationKey(didDoc, kidFragment);
      expect(didPublicKey).toEqual(publicKey);
    });
    it('should extract publicKey using a full kid with only a kidFragment defined in the did doc', () => {
      const didDoc = {
        id: did,
        publicKey: [
          {
            id: kidFragment,
            type: verificationKeyType,
            publicKeyHex: publicKey,
          },
        ],
      };

      const didPublicKey = extractVerificationKey(didDoc, kid);
      expect(didPublicKey).toEqual(publicKey);
    });

    it('should extract publicKey using a full kid with a full kid defined in the did doc', () => {
      const didDoc = {
        id: did,
        publicKey: [
          {
            id: kid,
            type: verificationKeyType,
            publicKeyHex: publicKey,
          },
        ],
      };

      const didPublicKey = extractVerificationKey(didDoc, kid);
      expect(didPublicKey).toEqual(publicKey);
    });

    it('should extract publicKey using a kidFragment with a full kid defined in the did doc', () => {
      const didDoc = {
        id: did,
        publicKey: [
          {
            id: kid,
            type: verificationKeyType,
            publicKeyHex: publicKey,
          },
        ],
      };

      const didPublicKey = extractVerificationKey(didDoc, kidFragment);
      expect(didPublicKey).toEqual(publicKey);
    });

    it('should throw for unrecognized encoding', () => {
      const didDoc = {
        id: did,
        publicKey: [
          {
            id: kid,
            type: verificationKeyType,
            publicKeyOther: publicKey,
          },
        ],
      };

      expect(() => extractVerificationKey(didDoc, kid)).toThrow(Error);
    });
  });

  describe('extractVerificationJwk', () => {
    const { publicKey: secp256k1Jwk } = generateKeyPair({ format: 'jwk' });
    const secp256k1Hex = hexFromJwk(secp256k1Jwk, false);
    const { publicKey: p256Jwk } = generateKeyPair({
      format: 'jwk',
      curve: 'P-256',
    });
    const did = 'did:web:example.com';
    const kid = `${did}#key-1`;

    it('should return null when no verification method matches the kid', () => {
      const didDoc = {
        id: did,
        verificationMethod: [
          { id: kid, type: signatureKeyType, publicKeyJwk: p256Jwk },
        ],
      };

      expect(extractVerificationJwk(didDoc, `${did}#key-2`)).toEqual(null);
    });

    it('should return a P-256 publicKeyJwk unchanged', () => {
      const didDoc = {
        id: did,
        verificationMethod: [
          { id: '#key-1', type: signatureKeyType, publicKeyJwk: p256Jwk },
        ],
      };

      const jwk = extractVerificationJwk(didDoc, kid);
      expect(jwk).toBe(p256Jwk);
      expect(jwk).toEqual({
        kty: 'EC',
        crv: 'P-256',
        x: p256Jwk.x,
        y: p256Jwk.y,
      });
    });

    it('should return a secp256k1 publicKeyJwk unchanged', () => {
      const didDoc = {
        id: did,
        assertionMethod: [
          { id: kid, type: verificationKeyType, publicKeyJwk: secp256k1Jwk },
        ],
      };

      expect(extractVerificationJwk(didDoc, kid)).toBe(secp256k1Jwk);
    });

    it('should prefer publicKeyJwk over legacy encodings', () => {
      const didDoc = {
        id: did,
        publicKey: [
          {
            id: kid,
            type: signatureKeyType,
            publicKeyJwk: p256Jwk,
            publicKeyHex: secp256k1Hex,
          },
        ],
      };

      expect(extractVerificationJwk(didDoc, kid)).toBe(p256Jwk);
    });

    it('should convert publicKeyHex to a secp256k1 jwk', () => {
      const didDoc = {
        id: did,
        publicKey: [
          { id: kid, type: verificationKeyType, publicKeyHex: secp256k1Hex },
        ],
      };

      expect(extractVerificationJwk(didDoc, kid)).toEqual({
        ...secp256k1Jwk,
        use: 'sig',
      });
    });

    it('should convert publicKeyBase58 to a secp256k1 jwk', () => {
      const didDoc = {
        id: did,
        publicKey: [generatePublicKeySection(kid, did, secp256k1Hex)],
      };

      expect(extractVerificationJwk(didDoc, kid)).toEqual({
        ...secp256k1Jwk,
        use: 'sig',
      });
    });

    it('should convert a compressed publicKeyHex to a secp256k1 jwk', () => {
      const didDoc = {
        id: did,
        publicKey: [
          {
            id: kid,
            type: verificationKeyType,
            publicKeyHex: ECDH.convertKey(
              secp256k1Hex,
              'secp256k1',
              'hex',
              'hex',
              'compressed',
            ),
          },
        ],
      };

      expect(extractVerificationJwk(didDoc, kid)).toEqual({
        ...secp256k1Jwk,
        use: 'sig',
      });
    });

    it('should throw a 400 when a legacy encoding does not hold a secp256k1 public key', () => {
      const ed25519PublicKey = Buffer.from(
        generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' }).x,
        'base64url',
      );
      const didDoc = {
        id: did,
        verificationMethod: [
          {
            id: kid,
            type: 'Ed25519VerificationKey2018',
            publicKeyBase58: bs58.encode(ed25519PublicKey),
          },
        ],
      };

      expect(() => extractVerificationJwk(didDoc, kid)).toThrow(
        expect.objectContaining({
          message: `Verification method ${kid} does not contain a secp256k1 public key`,
          status: 400,
          errorCode: 'unsupported_public_key',
        }),
      );
    });

    it('should throw when publicKeyJwk is not an object', () => {
      const didDoc = {
        id: did,
        verificationMethod: [
          {
            id: kid,
            type: signatureKeyType,
            publicKeyJwk: JSON.stringify(p256Jwk),
          },
        ],
      };

      expect(() => extractVerificationJwk(didDoc, kid)).toThrow(Error);
    });

    it('should throw for unrecognized encoding', () => {
      const didDoc = {
        id: did,
        verificationMethod: [
          {
            id: kid,
            type: signatureKeyType,
            publicKeyMultibase: 'zUnsupportedEncoding',
          },
        ],
      };

      expect(() => extractVerificationJwk(didDoc, kid)).toThrow(
        'unsupported public key encoding',
      );
    });
  });

  describe('DID Public Key Section Generation', () => {
    it('Should generate a valid public key section item', () => {
      const section = generatePublicKeySection(
        'KID',
        'CONTROLLER',
        'PUBLIC-KEY-HEX',
      );

      expect(section).toEqual({
        id: 'KID',
        type: verificationKeyType,
        controller: 'CONTROLLER',
        publicKeyBase58: bs58.encode(Buffer.from('PUBLIC-KEY-HEX', 'hex')),
      });
    });
  });

  describe('DID Proof Generation', () => {
    const { privateKey } = generateKeyPair({ format: 'jwk' });

    it('should throw when payload is undefined', () => {
      const result = () =>
        generateProof(undefined, privateKey, 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('should throw when payload is null', () => {
      const result = () =>
        generateProof(null, privateKey, 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('should throw when payload is an empty string', () => {
      const result = () => generateProof('', privateKey, 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('should throw when payload is not JSON', () => {
      const payload = 'NOT_JSON';
      const result = () =>
        generateProof(payload, privateKey, 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('should throw when private key is undefined', () => {
      const payload = { field: 'value' };
      const result = () =>
        generateProof(payload, undefined, 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('should throw when private key is null', () => {
      const payload = { field: 'value' };
      const result = () => generateProof(payload, null, 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('should throw when private key is an empty string', () => {
      const payload = { field: 'value' };
      const result = () => generateProof(payload, '', 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('should generate a JsonWebKey2020 proof signed with a private JWK', () => {
      const payload = { field: 'value' };
      const proof = generateProof(payload, privateKey, 'VERIFICATION-METHOD');
      const testProof = {
        type: signatureKeyType,
        proofPurpose: 'assertionMethod',
        created: proof.created,
        verificationMethod: 'VERIFICATION-METHOD',
      };
      const jws = signPayload(payload, hexFromJwk(privateKey), testProof);

      expect(proof).toEqual({ ...testProof, jws });
    });
  });
});
