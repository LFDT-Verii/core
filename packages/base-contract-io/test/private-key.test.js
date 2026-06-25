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

const { describe, it } = require('node:test');
const { expect } = require('expect');

const { generateKeyPair, hexFromJwk } = require('@verii/crypto');
const { toEthersPrivateKey } = require('../src/private-key');

describe('private key normalizer', () => {
  it('returns prefixed hex private keys unchanged', () => {
    const privateKey =
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    expect(toEthersPrivateKey(privateKey)).toEqual(privateKey);
  });

  it('normalizes uppercase hex prefixes', () => {
    const privateKey =
      '0Xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    expect(toEthersPrivateKey(privateKey)).toEqual(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
  });

  it('prefixes unprefixed hex private keys', () => {
    const privateKey =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    expect(toEthersPrivateKey(privateKey)).toEqual(`0x${privateKey}`);
  });

  it('converts private JWKs to prefixed hex private keys', () => {
    const { privateKey } = generateKeyPair({ format: 'jwk' });

    expect(toEthersPrivateKey(privateKey)).toEqual(
      `0x${hexFromJwk(privateKey)}`,
    );
  });

  it('rejects public JWKs', () => {
    const { publicKey } = generateKeyPair({ format: 'jwk' });

    expect(() => toEthersPrivateKey(publicKey)).toThrow(
      'Expected private JWK with d property',
    );
  });
});
