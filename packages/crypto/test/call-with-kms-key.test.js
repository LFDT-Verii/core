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
const { before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const { initCallWithKmsKey } = require('../src/call-with-kms-key');
const { generateKeyPair } = require('../src/crypto');

describe('kms key callback', () => {
  const mockKms = {
    exportKeyOrSecret: mock.fn(),
  };

  let callWithKmsKey;
  before(() => {
    mockKms.exportKeyOrSecret.mock.resetCalls();
    callWithKmsKey = initCallWithKmsKey({ kms: mockKms });
  });
  it('should throw an error if the key cannot be found', async () => {
    mockKms.exportKeyOrSecret.mock.mockImplementationOnce(() =>
      Promise.reject(new Error('Not Found'))
    );
    await expect(callWithKmsKey('1', mock.fn())).rejects.toEqual(
      new Error('Not Found')
    );
  });

  describe('key loaded', () => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    const callback = mock.fn();

    beforeEach(() => {
      mockKms.exportKeyOrSecret.mock.mockImplementation((keyId) => ({
        keyId,
        privateJwk: keyPair.privateKey,
      }));
    });
    it('should return the callback error', async () => {
      callback.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('Callback Error'))
      );
      await expect(callWithKmsKey('1', callback)).rejects.toEqual(
        new Error('Callback Error')
      );
    });
    it('should return callback result', async () => {
      callback.mock.mockImplementationOnce(() => Promise.resolve('Happy Days'));
      await expect(callWithKmsKey('1', callback)).resolves.toEqual(
        'Happy Days'
      );
    });
  });
});
