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
 *
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');
const { KeyAlgorithms } = require('@verii/crypto');
const { calcAlgTypeName } = require('../src/utils/calc-alg-type-name');

describe('calc alg type name', () => {
  [
    [
      'ES256',
      { defaultSignatureAlgorithm: KeyAlgorithms.ES256 },
      'COSEKEY_AES_256',
    ],
    [
      'RS256',
      { defaultSignatureAlgorithm: KeyAlgorithms.RS256 },
      'COSEKEY_AES_256',
    ],
    [
      'SECP256K1',
      { defaultSignatureAlgorithm: KeyAlgorithms.SECP256K1 },
      'HEX_AES_256',
    ],
    ['metadata without an algorithm', {}, 'COSEKEY_AES_256'],
    ['missing metadata', undefined, 'COSEKEY_AES_256'],
  ].forEach(([description, credentialTypeMetadata, expected]) => {
    it(`maps ${description} to ${expected}`, () => {
      expect(calcAlgTypeName(credentialTypeMetadata)).toEqual(expected);
    });
  });
});
