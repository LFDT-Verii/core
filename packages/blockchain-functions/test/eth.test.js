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
const { describe, it, mock, after } = require('node:test');
const { expect } = require('expect');

const { initGetBlockNumber, initGetBlock, sendNoOpTx } = require('../src/eth');

class JsonRpcProvider {}
JsonRpcProvider.prototype.getBlockNumber = mock.fn(() =>
  Promise.resolve(blockNumberResult)
);
JsonRpcProvider.prototype.getBlock = mock.fn((blockNumber) =>
  Promise.resolve({ blockNumber })
);
mock.module('ethers', {
  namedExports: {
    JsonRpcProvider,
  },
});

const rpcUrl = 'RPC-URL';
const authenticate = () => Promise.resolve('TOKEN');
const blockNumberResult = 1;

describe.skip('ETH Suite', () => {
  after(() => {
    mock.reset();
  });
  describe('ETH Block Number', () => {
    it('Should return block number', async () => {
      const getBlockNumber = await initGetBlockNumber({
        rpcUrl,
        authenticate,
      });

      const result = await getBlockNumber();

      expect(result).toEqual(blockNumberResult);
    });
  });

  describe('ETH Block', () => {
    it('Should return block', async () => {
      const getBlock = await initGetBlock({
        rpcUrl,
        authenticate,
      });

      const result = await getBlock(blockNumberResult);

      expect(result).toEqual({ blockNumber: blockNumberResult });
    });
  });

  describe('Send No Op Transaction', () => {
    it('Should send transaction', async () => {
      const nonce = 10;
      const address = '0x0000000000000000000000000000000000000000';
      const value = '0x0';
      const mockSendTransaction = mock.fn();
      const mockGetTransactionCount = mock.fn(() => Promise.resolve(10));
      const mockGetNonce = mock.fn(() => Promise.resolve(nonce));
      const wallet = {
        address,
        sendTransaction: mockSendTransaction,
        getTransactionCount: mockGetTransactionCount,
        getNonce: mockGetNonce,
      };

      await sendNoOpTx(wallet, nonce);

      expect(
        mockSendTransaction.mock.calls.map((call) => call.arguments)
      ).toContainEqual([
        {
          to: address,
          value,
          nonce,
        },
      ]);
    });
  });
});
