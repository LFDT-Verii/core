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

const crypto = require('node:crypto');
const { generateCredentialJwt } = require('@verii/jwt');

const JoseAlgorithms = Object.freeze({
  'P-256': 'ES256',
  secp256k1: 'ES256K',
});

/**
 * Signs a VC 1.1 credential as a legacy jwt_vc_json-ld JWT.
 * @param {object} credential the unsigned VC 1.1 credential
 * @param {object} privateJwk the EC private JWK
 * @param {string} kid the protected-header kid
 * @returns {Promise<string>} the compact JWT
 */
const signV1Credential = (credential, privateJwk, kid) =>
  generateCredentialJwt(
    credential,
    privateJwk,
    kid,
    joseAlgorithmFor(privateJwk),
  );

/**
 * Signs a VC 2.0 credential as an independently secured vc+jwt envelope.
 * @param {object} credential the unsigned VC 2.0 credential
 * @param {object} privateJwk the EC private JWK
 * @param {string} kid the protected-header kid
 * @returns {string} the compact JWS
 */
const signV2Credential = (credential, privateJwk, kid) =>
  compactSign(credential, privateJwk, {
    alg: joseAlgorithmFor(privateJwk),
    cty: 'vc',
    kid,
    typ: 'vc+jwt',
  });

const compactSign = (payload, privateJwk, protectedHeader) => {
  const encodedHeader = Buffer.from(JSON.stringify(protectedHeader)).toString(
    'base64url',
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    dsaEncoding: 'ieee-p1363',
    key: crypto.createPrivateKey({ format: 'jwk', key: privateJwk }),
  });
  return `${signingInput}.${signature.toString('base64url')}`;
};

const joseAlgorithmFor = ({ crv }) => JoseAlgorithms[crv];

module.exports = { signV1Credential, signV2Credential };
