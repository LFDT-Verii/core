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

const { describe, it } = require('node:test');
const { expect } = require('expect');

const {
  generateAccount,
  generateDisposablePrivateKey,
} = require('../src/generate-disposable-private-key');

describe('generate blockchain account helpers', () => {
  it('generates an ethers wallet account', () => {
    const wallet = generateAccount();
    expect({
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.signingKey.publicKey,
    }).toEqual({
      address: expect.stringMatching(/^0x[0-9a-fA-F]{40}$/),
      privateKey: expect.stringMatching(/^0x[0-9a-f]{64}$/),
      publicKey: expect.stringMatching(/^0x04[0-9a-f]{128}$/),
    });
  });

  it('generates an ethers private key hex string', () => {
    expect(generateDisposablePrivateKey()).toEqual(
      expect.stringMatching(/^0x[0-9a-f]{64}$/),
    );
  });
});
