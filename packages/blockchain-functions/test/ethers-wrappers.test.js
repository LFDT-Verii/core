/**
 * Copyright 2023 Velocity Team
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

const { generateKeyPair } = require('@verii/crypto');
const {
  toEthereumAddress,
  toHexString,
  toNumber,
} = require('../src/ethers-wrappers');

describe('Ehters Wrappers', () => {
  describe('Ethereum Addresses', () => {
    it('Should return Ethereum address from public key', () => {
      const publicKey =
        '0419c9b7d53ba404b2981bf7285af97687faf545e29f21fd6a3209a7834470fb350852c3f60747780c06073e60c2388f99891db680769c84b7fc2418dfc4f60117';
      const expectedAddress = '0x68cd2FBCF4c506E7D1977520c6c80404fC849038';

      const result = toEthereumAddress(publicKey);

      expect(result).toEqual(expectedAddress);
    });

    it('Should return Ethereum address from private key key', () => {
      const { publicKey, privateKey } = generateKeyPair();

      const publicKeyAddress = toEthereumAddress(publicKey);
      const privateKeyAddress = toEthereumAddress(privateKey);

      expect(privateKeyAddress).toEqual(publicKeyAddress);
    });

    it('Should return Ethereum address from JWK', () => {
      const keyPair = generateKeyPair({ format: 'jwk' });
      const publicAddress = toEthereumAddress(keyPair.publicKey);
      const privateAddress = toEthereumAddress(keyPair.privateKey);
      expect(publicAddress).toEqual(privateAddress);
    });
  });

  describe('Hex Strings', () => {
    it('Should return hex string from big int', () => {
      expect(toHexString(1n)).toEqual('0x01');
    });
  });

  describe('Big Numbers', () => {
    it('Should return number from big int', () => {
      expect(toNumber(1n)).toEqual(1);
    });
  });
});
