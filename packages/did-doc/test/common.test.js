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

const { default: bs58 } = require('bs58');
const { last } = require('lodash/fp');
const {
  toEthereumAddress,
} = require('@verii/blockchain-functions');
const { generateKeyPair, signPayload } = require('@verii/crypto');
const { jwkFromSecp256k1Key } = require('@verii/jwt');
const { rootPrivateKey } = require('@verii/sample-data');
const {
  verificationKeyType,
  signatureKeyType,
  generateDidInfo,
  generatePublicKeySection,
  generateProof,
  extractVerificationKey,
  publicKeyToJwk,
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
    const { publicKey } = generateKeyPair();
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

  describe('publicKeyToJwk', () => {
    const { publicKey: publicKeyHex } = generateKeyPair();
    const publicKeyJwk = jwkFromSecp256k1Key(publicKeyHex, false);

    it('should return publicKeyJwk when publicKeyHex is passed', () => {
      const publicKey = publicKeyToJwk({ publicKeyHex });
      expect(publicKey).toEqual(publicKeyJwk);
    });

    it('should return publicKeyJwk when publicKeyJwk is passed', () => {
      const publicKey = publicKeyToJwk({ publicKeyJwk });
      expect(publicKey).toEqual(publicKeyJwk);
    });
  });

  describe('DID Public Key Section Generation', () => {
    it('Should generate a valid public key section item', () => {
      const section = generatePublicKeySection(
        'KID',
        'CONTROLLER',
        'PUBLIC-KEY-HEX'
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
    it('Should throw error when payload is undefined', () => {
      const result = () =>
        generateProof(undefined, 'PRIVATE-KEY', 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('Should throw error when payload is null', () => {
      const result = () =>
        generateProof(null, 'PRIVATE-KEY', 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('Should throw error when payload is an empty string', () => {
      const result = () =>
        generateProof('', 'PRIVATE-KEY', 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('Should throw error when payload is not JSON', () => {
      const payload = 'NOT_JSON';
      const result = () =>
        generateProof(payload, 'PRIVATE-KEY', 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('Should throw error when private key is undefined', () => {
      const payload = { field: 'value' };
      const result = () =>
        generateProof(payload, undefined, 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('Should throw error when private key is null', () => {
      const payload = { field: 'value' };
      const result = () => generateProof(payload, null, 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('Should throw error when private key is an empty string', () => {
      const payload = { field: 'value' };
      const result = () => generateProof(payload, '', 'VERIFICATION-METHOD');

      expect(result).toThrow(Error);
    });

    it('Should generate a proof when passed parameters are valid', () => {
      const payload = { field: 'value' };
      const proof = generateProof(
        payload,
        rootPrivateKey,
        'VERIFICATION-METHOD'
      );
      const testProof = {
        type: signatureKeyType,
        proofPurpose: 'assertionMethod',
        created: proof.created,
        verificationMethod: 'VERIFICATION-METHOD',
      };
      const jws = signPayload(payload, rootPrivateKey, testProof);

      expect(proof).toEqual({ ...testProof, jws });
    });
  });
});
