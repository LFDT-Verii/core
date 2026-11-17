/**
 * Copyright 2025 Velocity Team
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

const { generateJWAKeyPair, KeyAlgorithms } = require('@verii/crypto');
const { privateJwkMatcher, publicJwkMatcher } = require('../src/jwk-matchers');

describe('jwk matchers', () => {
  it('privateJwkMatcher should match a generated RSA private jwk', () => {
    const { privateKey } = generateJWAKeyPair(KeyAlgorithms.RS256);

    expect(privateKey).toEqual(privateJwkMatcher(KeyAlgorithms.RS256));
  });

  it('publicJwkMatcher should match a generated RSA public jwk', () => {
    const { publicKey } = generateJWAKeyPair(KeyAlgorithms.RS256);

    expect(publicKey).toEqual(publicJwkMatcher(KeyAlgorithms.RS256));
  });

  it('privateJwkMatcher should match a generated P-256 private jwk', () => {
    const { privateKey } = generateJWAKeyPair(KeyAlgorithms.ES256);

    expect(privateKey).toEqual(privateJwkMatcher(KeyAlgorithms.ES256));
  });

  it('privateJwkMatcher should match a generated secp256k1 private jwk by default', () => {
    const { privateKey } = generateJWAKeyPair(KeyAlgorithms.SECP256K1);

    expect(privateKey).toEqual(privateJwkMatcher());
  });
});
