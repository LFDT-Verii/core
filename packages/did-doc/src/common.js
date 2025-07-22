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

const newError = require('http-errors');
const { default: bs58 } = require('bs58');
const { find, isNil, reduce } = require('lodash/fp');
const { signPayload, generateKeyPair } = require('@verii/crypto');
const { hexFromJwk, jwkFromSecp256k1Key } = require('@verii/jwt');

const {
  toEthereumAddress,
} = require('@verii/blockchain-functions');

const { toRelativeKeyId } = require('./normalize-id');

const verificationKeyType = 'EcdsaSecp256k1VerificationKey2019';
const signatureKeyType = 'EcdsaSecp256k1Signature2019';

const generateDidInfo = (
  { did: existingDid, keyId } = { did: null, keyId: 'key-1' }
) => {
  const { privateKey, publicKey } = generateKeyPair();
  const did = existingDid || `did:velocity:${toEthereumAddress(publicKey)}`;
  const kid = `${did}#${keyId}`;

  return {
    publicKey,
    privateKey,
    did,
    kid,
  };
};

const generatePublicKeySection = (
  kid,
  keyController,
  publicKeyHex,
  immutable
) => {
  const publicKey = {
    id: kid,
    type: verificationKeyType,
    publicKeyBase58: bs58.encode(Buffer.from(publicKeyHex, 'hex')),
  };

  if (!immutable) {
    publicKey.controller = keyController;
  }

  return publicKey;
};

const generateProof = (payload, privateKey, verificationMethod) => {
  if (isNil(payload)) {
    throw newError('Payload is null or undefined', {
      payload,
      privateKey,
      verificationMethod,
    });
  }

  const options = {
    type: signatureKeyType,
    proofPurpose: 'assertionMethod',
    created: new Date().toISOString(),
    verificationMethod,
  };

  const jws = signPayload(payload, privateKey, options);

  return {
    ...options,
    jws,
  };
};

const extractPublicKeyMethod = (didDoc, kid, keyHolderProp) => {
  const normalizedKid = toRelativeKeyId(kid);
  const publicKey = find((keyHolder) => {
    const normalizedId = toRelativeKeyId(keyHolder.id ?? keyHolder);
    return normalizedId === normalizedKid;
  }, didDoc[keyHolderProp]);

  if (publicKey == null) {
    return null;
  }

  return publicKey;
};

const publicKeyToHex = (publicKey) => {
  if (publicKey.publicKeyHex) {
    return publicKey.publicKeyHex;
  }

  if (publicKey.publicKeyBase58) {
    return Buffer.from(bs58.decode(publicKey.publicKeyBase58)).toString('hex');
  }

  if (publicKey.publicKeyJwk) {
    return hexFromJwk(publicKey.publicKeyJwk, false);
  }

  throw newError(500, 'unsupported public key encoding', { publicKey });
};

const publicKeyToJwk = (publicKey) => {
  if (publicKey?.publicKeyHex) {
    return jwkFromSecp256k1Key(publicKey.publicKeyHex, false);
  }

  return publicKey?.publicKeyJwk;
};

const initExtractKeyByMethod = (keyHolderProp) => (didDoc, kid) => {
  const publicKey = extractPublicKeyMethod(didDoc, kid, keyHolderProp);
  if (publicKey == null) {
    return null;
  }
  return publicKeyToHex(publicKey);
};

const extractVerificationMethod = (didDoc, kid) => {
  const extractors = [
    () => extractPublicKeyMethod(didDoc, kid, 'publicKey'),
    () => extractPublicKeyMethod(didDoc, kid, 'verificationMethod'),
    () => extractPublicKeyMethod(didDoc, kid, 'assertionMethod'),
  ];

  return reduce((acc, extractor) => acc ?? extractor(), null, extractors);
};

const extractVerificationKey = (didDoc, kid) => {
  const extractors = [
    initExtractKeyByMethod('publicKey'),
    initExtractKeyByMethod('verificationMethod'),
    initExtractKeyByMethod('assertionMethod'),
  ];

  return reduce(
    (acc, extractor) => acc ?? extractor(didDoc, kid),
    null,
    extractors
  );
};

module.exports = {
  verificationKeyType,
  signatureKeyType,
  generateDidInfo,
  generatePublicKeySection,
  generateProof,
  extractVerificationKey,
  extractVerificationMethod,
  publicKeyToJwk,
};
