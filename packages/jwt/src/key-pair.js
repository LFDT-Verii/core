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

const { CompactSign, compactVerify, importJWK } = require('jose');
const { findKey, omit } = require('lodash/fp');
const { AlgorithmKeyProfiles } = require('./credential-envelope-verifier');

const KEY_PAIR_PAYLOAD = new TextEncoder().encode('key-pair');

// The private members of EC and RSA JWKs (RFC 7518 sections 6.2.2 and 6.3.2).
const PRIVATE_JWK_MEMBERS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'];

const publicJwkFromPrivateJwk = (privateJwk) =>
  omit(PRIVATE_JWK_MEMBERS, privateJwk);

const algFromJwk = (jwk) =>
  findKey(
    ({ kty, crv }) => kty === jwk.kty && crv === jwk.crv,
    AlgorithmKeyProfiles,
  );

// Signs with the private JWK and verifies with the public JWK, so it holds
// only when both belong to the same key pair.
const isMatchingKeyPair = async (privateJwk, publicJwk) => {
  try {
    const alg = algFromJwk(privateJwk);
    const jws = await new CompactSign(KEY_PAIR_PAYLOAD)
      .setProtectedHeader({ alg })
      .sign(await importJWK(privateJwk, alg));
    await compactVerify(jws, await importJWK(publicJwk, alg));
    return true;
  } catch {
    return false;
  }
};

module.exports = { isMatchingKeyPair, publicJwkFromPrivateJwk };
