/**
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
const { keyAlgorithmToJoseAlg } = require('./core');
const {
  getV2CredentialModelViolation,
} = require('./v2-credential-model-validator');

const V2_JOSE_CREDENTIAL_TYPE = 'vc+jwt';
const V2_JOSE_PAYLOAD_TYPE = 'vc';

const SUPPORTED_KEY_ALGORITHMS = new Set([
  KeyAlgorithms.ES256,
  KeyAlgorithms.RS256,
  KeyAlgorithms.SECP256K1,
]);

const V2_FORBIDDEN_DOCUMENT_PROPERTIES = Object.freeze([
  'expirationDate',
  'issuanceDate',
  'proof',
]);

const V2_FORBIDDEN_COMPATIBILITY_CLAIMS = Object.freeze([
  'aud',
  'exp',
  'iat',
  'iss',
  'jti',
  'nbf',
  'sub',
  'sub_jwk',
  'vc',
  'vp',
]);

/**
 * Builds the protected header and direct payload for the Velocity VC 2.0 JOSE
 * profile. The algorithm input uses the internal key-algorithm vocabulary;
 * secp256k1 is converted to ES256K only in the returned JOSE header.
 * @param {object} jsonLdCredential conforming VC Data Model 2.0 document
 * @param {string} signatureAlgorithm internal key algorithm
 * @param {string} kid anchored credential key identifier
 * @returns {{header: object, payload: object}} unsigned compact-JWS content
 */
const jsonLdToUnsignedVcV2JwsContent = (
  jsonLdCredential,
  signatureAlgorithm,
  kid,
) => {
  assertV2Credential(jsonLdCredential);
  assertSignatureAlgorithm(signatureAlgorithm);
  assertCredentialKid(jsonLdCredential, kid);

  return {
    header: {
      alg: keyAlgorithmToJoseAlg(signatureAlgorithm),
      kid,
      typ: V2_JOSE_CREDENTIAL_TYPE,
      cty: V2_JOSE_PAYLOAD_TYPE,
    },
    payload: jsonLdCredential,
  };
};

const assertCredentialKid = (credential, kid) => {
  if (typeof credential.id !== 'string' || kid !== `${credential.id}#key-1`) {
    throw new TypeError('VC 2.0 JOSE kid must identify the credential key');
  }
};

const assertSignatureAlgorithm = (signatureAlgorithm) => {
  if (!SUPPORTED_KEY_ALGORITHMS.has(signatureAlgorithm)) {
    throw new TypeError(
      `VC 2.0 JOSE signing algorithm is not supported: ${signatureAlgorithm}`,
    );
  }
};

const assertV2Credential = (credential) => {
  const forbiddenCompatibilityClaim = V2_FORBIDDEN_COMPATIBILITY_CLAIMS.find(
    (property) => credential != null && Object.hasOwn(credential, property),
  );
  if (forbiddenCompatibilityClaim != null) {
    throw new TypeError(
      `VC 2.0 JOSE payload violates the compatibility profile: ${forbiddenCompatibilityClaim}`,
    );
  }

  const forbiddenProperty = V2_FORBIDDEN_DOCUMENT_PROPERTIES.find(
    (property) => credential != null && Object.hasOwn(credential, property),
  );
  if (forbiddenProperty != null) {
    throw new TypeError(
      `VC 2.0 JOSE payload must not contain ${forbiddenProperty}`,
    );
  }

  const violation = getV2CredentialModelViolation(credential);
  if (violation != null) {
    const property =
      violation.property == null ? '' : `: ${violation.property}`;
    const profile =
      violation.type === 'profile'
        ? 'Velocity profile'
        : `${violation.type} profile`;
    throw new TypeError(
      `VC 2.0 JOSE payload violates the ${profile}${property}`,
    );
  }
};

module.exports = {
  V2_JOSE_CREDENTIAL_TYPE,
  V2_JOSE_PAYLOAD_TYPE,
  jsonLdToUnsignedVcV2JwsContent,
};
