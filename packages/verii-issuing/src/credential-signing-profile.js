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
 */

const {
  createECDH,
  createPrivateKey,
  createPublicKey,
} = require('node:crypto');
const { KeyAlgorithms } = require('@verii/crypto');
const { ALG_TYPE } = require('@verii/metadata-registration');

const CredentialSigningProfiles = Object.freeze({
  ES256K: Object.freeze({
    algType: ALG_TYPE.HEX_AES_256,
    algTypeName: 'HEX_AES_256',
    curve: 'secp256k1',
    joseAlgorithm: 'ES256K',
    keyAlgorithm: KeyAlgorithms.SECP256K1,
    keyType: 'EC',
  }),
  ES256: Object.freeze({
    algType: ALG_TYPE.COSEKEY_AES_256,
    algTypeName: 'COSEKEY_AES_256',
    curve: 'P-256',
    joseAlgorithm: 'ES256',
    keyAlgorithm: KeyAlgorithms.ES256,
    keyType: 'EC',
  }),
  RS256: Object.freeze({
    algType: ALG_TYPE.COSEKEY_AES_256,
    algTypeName: 'COSEKEY_AES_256',
    joseAlgorithm: 'RS256',
    keyAlgorithm: KeyAlgorithms.RS256,
    keyType: 'RSA',
  }),
});

const CredentialSigningAlgorithms = Object.freeze([
  KeyAlgorithms.SECP256K1,
  KeyAlgorithms.ES256,
  KeyAlgorithms.RS256,
]);

const assertCredentialSigningKeyPair = (keyPair, algorithm) => {
  const profile = getCredentialSigningProfile(algorithm);
  if (!isKeyPairValid(keyPair, profile)) {
    throw new Error(
      `Credential signing key pair is not valid for ${profile.joseAlgorithm}`,
    );
  }
  return keyPair;
};

const getCredentialSigningProfile = (algorithm) => {
  const normalizedAlgorithm = normalizeCredentialSigningAlgorithm(algorithm);
  const profile = CredentialSigningProfiles[normalizedAlgorithm];
  if (profile == null) {
    throw new Error(
      `Credential signing algorithm is not supported: ${algorithm}`,
    );
  }
  return profile;
};

const normalizeCredentialSigningAlgorithm = (algorithm) =>
  algorithm === KeyAlgorithms.SECP256K1 ? 'ES256K' : algorithm;

const derivePublicJwk = (privateKey, profile) => {
  if (profile.keyType === 'EC') {
    const ecdh = createECDH(
      profile.curve === 'P-256' ? 'prime256v1' : profile.curve,
    );
    ecdh.setPrivateKey(Buffer.from(privateKey.d, 'base64url'));
    const uncompressedPublicKey = ecdh.getPublicKey();
    return {
      crv: profile.curve,
      kty: 'EC',
      x: uncompressedPublicKey.subarray(1, 33).toString('base64url'),
      y: uncompressedPublicKey.subarray(33, 65).toString('base64url'),
    };
  }
  return createPublicKey(
    createPrivateKey({ format: 'jwk', key: privateKey }),
  ).export({ format: 'jwk' });
};

const hasExpectedAlgorithm = (key, profile) =>
  key.alg == null || key.alg === profile.joseAlgorithm;

const hasExpectedKeyOperation = (key, operation) =>
  key.key_ops == null || key.key_ops.includes(operation);

const hasExpectedKeyShape = (key, profile, isPrivate) => {
  return [
    key?.kty === profile.keyType,
    hasExpectedPrivateMaterial(key, isPrivate),
    hasExpectedCurve(key, profile),
  ].every(Boolean);
};

const hasExpectedUse = (key) => key.use == null || key.use === 'sig';

const hasExpectedCurve = (key, profile) =>
  profile.keyType !== 'EC' || key?.crv === profile.curve;

const hasExpectedPrivateMaterial = (key, isPrivate) =>
  isPrivate ? key?.d != null : key?.d == null;

const isKeyPairValid = (keyPair, profile) => {
  const { privateKey, publicKey } = keyPair ?? {};
  const metadataIsValid = [
    hasExpectedKeyShape(privateKey, profile, true),
    hasExpectedKeyShape(publicKey, profile, false),
    hasExpectedAlgorithm(privateKey, profile),
    hasExpectedAlgorithm(publicKey, profile),
    hasExpectedUse(privateKey),
    hasExpectedUse(publicKey),
    hasExpectedKeyOperation(privateKey, 'sign'),
    hasExpectedKeyOperation(publicKey, 'verify'),
  ].every(Boolean);
  if (!metadataIsValid) {
    return false;
  }

  try {
    const derivedPublicKey = derivePublicJwk(privateKey, profile);
    return publicKeyMatchesProfile(publicKey, derivedPublicKey, profile);
  } catch {
    return false;
  }
};

const publicKeyMatchesProfile = (publicKey, derivedPublicKey, profile) => {
  if (profile.keyType === 'EC') {
    return [
      publicKey.x === derivedPublicKey.x,
      publicKey.y === derivedPublicKey.y,
    ].every(Boolean);
  }
  return [
    publicKey.n === derivedPublicKey.n,
    publicKey.e === derivedPublicKey.e,
  ].every(Boolean);
};

module.exports = {
  assertCredentialSigningKeyPair,
  CredentialSigningAlgorithms,
  getCredentialSigningProfile,
  normalizeCredentialSigningAlgorithm,
};
