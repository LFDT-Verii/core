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

const { KeyAlgorithms } = require('@verii/crypto');

const CredentialSigningProfiles = Object.freeze({
  [KeyAlgorithms.SECP256K1]: Object.freeze({
    algTypeName: 'HEX_AES_256',
    joseAlgorithm: 'ES256K',
    keyAlgorithm: KeyAlgorithms.SECP256K1,
  }),
  [KeyAlgorithms.ES256]: Object.freeze({
    algTypeName: 'COSEKEY_AES_256',
    joseAlgorithm: 'ES256',
    keyAlgorithm: KeyAlgorithms.ES256,
  }),
  [KeyAlgorithms.RS256]: Object.freeze({
    algTypeName: 'COSEKEY_AES_256',
    joseAlgorithm: 'RS256',
    keyAlgorithm: KeyAlgorithms.RS256,
  }),
});

const CredentialSigningAlgorithms = Object.freeze([
  KeyAlgorithms.SECP256K1,
  KeyAlgorithms.ES256,
  KeyAlgorithms.RS256,
]);
const ResolvedCredentialSigningProfiles = new Map();

/**
 * Resolves the complete execution profile for a supported signing algorithm.
 * @param {string} algorithm the requested signing algorithm
 * @returns {object} the resolved signing profile
 */
const getCredentialSigningProfile = (algorithm) => {
  const profile = CredentialSigningProfiles[algorithm];
  if (profile == null) {
    throw new Error(
      `Credential signing algorithm is not supported: ${algorithm}`,
    );
  }
  return resolveAlgType(profile);
};

/**
 * Adds the metadata registry encoding constant to a signing profile.
 * @param {object} profile the unresolved signing profile
 * @returns {object} the signing profile with its metadata algorithm type
 */
const resolveAlgType = (profile) => {
  const resolvedProfile = ResolvedCredentialSigningProfiles.get(
    profile.keyAlgorithm,
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
    profile.keyAlgorithm,
    profileWithAlgType,
  );
  return profileWithAlgType;
};

module.exports = {
  CredentialSigningAlgorithms,
  getCredentialSigningProfile,
};
