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

const CredentialSigningProfiles = Object.freeze({
  ES256K: Object.freeze({
    algTypeName: 'HEX_AES_256',
    curve: 'secp256k1',
    joseAlgorithm: 'ES256K',
    keyAlgorithm: KeyAlgorithms.SECP256K1,
    keyType: 'EC',
  }),
  ES256: Object.freeze({
    algTypeName: 'COSEKEY_AES_256',
    curve: 'P-256',
    joseAlgorithm: 'ES256',
    keyAlgorithm: KeyAlgorithms.ES256,
    keyType: 'EC',
  }),
  RS256: Object.freeze({
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
const ResolvedCredentialSigningProfiles = new Map();

/**
 * Validates a generated credential signing key pair against the selected profile.
 * @param {object} keyPair the generated private and public JWK pair
 * @param {string} algorithm the requested signing algorithm
 * @returns {object} the validated key pair
 */
const assertCredentialSigningKeyPair = (keyPair, algorithm) => {
  const profile = getCredentialSigningProfile(algorithm);
  if (!isKeyPairValid(keyPair, profile)) {
    throw new Error(
      `Credential signing key pair is not valid for ${profile.joseAlgorithm}`,
    );
  }
  return keyPair;
};

/**
 * Resolves the complete execution profile for a supported signing algorithm.
 * @param {string} algorithm the requested signing algorithm
 * @returns {object} the resolved signing profile
 */
const getCredentialSigningProfile = (algorithm) => {
  const normalizedAlgorithm = normalizeCredentialSigningAlgorithm(algorithm);
  const profile = CredentialSigningProfiles[normalizedAlgorithm];
  if (profile == null) {
    throw new Error(
      `Credential signing algorithm is not supported: ${algorithm}`,
    );
  }
  return resolveAlgType(profile);
};

/**
 * Converts the legacy key-generation name to its JOSE algorithm alias.
 * @param {string} algorithm the signing algorithm
 * @returns {string} the normalized JOSE algorithm
 */
const normalizeCredentialSigningAlgorithm = (algorithm) =>
  algorithm === KeyAlgorithms.SECP256K1 ? 'ES256K' : algorithm;

/**
 * Adds the metadata registry encoding constant to a signing profile.
 * @param {object} profile the unresolved signing profile
 * @returns {object} the signing profile with its metadata algorithm type
 */
const resolveAlgType = (profile) => {
  const resolvedProfile = ResolvedCredentialSigningProfiles.get(
    profile.joseAlgorithm,
  );
  if (resolvedProfile != null) {
    return resolvedProfile;
  }
  const { ALG_TYPE } = require('@verii/metadata-registration');
  const profileWithAlgType = Object.freeze({
    ...profile,
    algType: ALG_TYPE[profile.algTypeName],
  });
  ResolvedCredentialSigningProfiles.set(
    profile.joseAlgorithm,
    profileWithAlgType,
  );
  return profileWithAlgType;
};

/**
 * Derives public JWK material from a private JWK.
 * @param {object} privateKey the private JWK
 * @param {object} profile the resolved signing profile
 * @returns {object} the derived public JWK
 */
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

/**
 * Checks a JWK's optional algorithm restriction.
 * @param {object} key the JWK
 * @param {object} profile the resolved signing profile
 * @returns {boolean} whether the restriction matches the profile
 */
const hasExpectedAlgorithm = (key, profile) =>
  key.alg == null || key.alg === profile.joseAlgorithm;

/**
 * Checks a JWK's optional operation restriction.
 * @param {object} key the JWK
 * @param {string} operation the required key operation
 * @returns {boolean} whether the operation is permitted
 */
const hasExpectedKeyOperation = (key, operation) =>
  key.key_ops == null || key.key_ops.includes(operation);

/**
 * Checks the key type, curve, and private-material shape of a JWK.
 * @param {object} key the JWK
 * @param {object} profile the resolved signing profile
 * @param {boolean} isPrivate whether private key material is required
 * @returns {boolean} whether the JWK has the expected shape
 */
const hasExpectedKeyShape = (key, profile, isPrivate) => {
  return [
    key?.kty === profile.keyType,
    hasExpectedPrivateMaterial(key, isPrivate),
    hasExpectedCurve(key, profile),
  ].every(Boolean);
};

/**
 * Checks a JWK's optional use restriction.
 * @param {object} key the JWK
 * @returns {boolean} whether the JWK permits signatures
 */
const hasExpectedUse = (key) => key.use == null || key.use === 'sig';

/**
 * Checks an EC JWK's curve against a signing profile.
 * @param {object} key the JWK
 * @param {object} profile the resolved signing profile
 * @returns {boolean} whether the curve matches or is not applicable
 */
const hasExpectedCurve = (key, profile) =>
  profile.keyType !== 'EC' || key?.crv === profile.curve;

/**
 * Checks that private JWK material is present only where expected.
 * @param {object} key the JWK
 * @param {boolean} isPrivate whether private material is required
 * @returns {boolean} whether private material has the expected presence
 */
const hasExpectedPrivateMaterial = (key, isPrivate) =>
  isPrivate ? key?.d != null : key?.d == null;

/**
 * Checks key metadata and proves that the private key derives the public key.
 * @param {object} keyPair the private and public JWK pair
 * @param {object} profile the resolved signing profile
 * @returns {boolean} whether the key pair matches the profile
 */
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

/**
 * Compares the public coordinates or modulus from two public JWKs.
 * @param {object} publicKey the generated public JWK
 * @param {object} derivedPublicKey the public JWK derived from private material
 * @param {object} profile the resolved signing profile
 * @returns {boolean} whether the public key material matches
 */
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
