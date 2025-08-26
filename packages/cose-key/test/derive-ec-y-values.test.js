/*
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
 *
 */
const { describe, it } = require('node:test');
const { expect } = require('expect');

const { generateJWAKeyPair, KeyAlgorithms } = require('@verii/crypto');
const { isEcYValueEven, deriveEcYValue } = require('../src/derive-ec-y-values');

const threeThousand = Array.from(Array(3000).keys()).map((i) => [i]);
describe('Derive EC Y Coordinates', () => {
  threeThousand.forEach(([i]) => {
    const { publicKey } = generateJWAKeyPair(KeyAlgorithms.ES256);

    it(`derive EC Y coordinates ${i + 1}`, () => {
      const isYEven = isEcYValueEven(Buffer.from(publicKey.y, 'base64url'));

      expect(
        Buffer.from(publicKey.x, 'base64url').toString('hex').length
      ).toEqual(64);
      expect(
        Buffer.from(publicKey.y, 'base64url').toString('hex').length
      ).toEqual(64);

      expect(
        deriveEcYValue(
          publicKey.crv,
          Buffer.from(publicKey.x, 'base64url'),
          isYEven
        ).toString('hex')
      ).toEqual(Buffer.from(publicKey.y, 'base64url').toString('hex'));
    });
  });
});
