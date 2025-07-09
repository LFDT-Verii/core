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

const { initGetBlockNumber, initGetBlock, sendNoOpTx } = require('../src/eth');

jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  JsonRpcProvider: jest.fn(() => ({
    getBlockNumber: () => Promise.resolve(blockNumberResult),
    getBlock: (blockNumber) => Promise.resolve({ blockNumber }),
  })),
}));

const rpcUrl = 'RPC-URL';
const authenticate = () => Promise.resolve('TOKEN');
const blockNumberResult = 1;

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
    const mockSendTransaction = jest.fn();
    const mockGetTransactionCount = jest.fn(() => Promise.resolve(10));
    const mockGetNonce = jest.fn(() => Promise.resolve(nonce));
    const wallet = {
      address,
      sendTransaction: mockSendTransaction,
      getTransactionCount: mockGetTransactionCount,
      getNonce: mockGetNonce,
    };

    await sendNoOpTx(wallet, nonce);

    expect(mockSendTransaction).toHaveBeenCalledWith({
      to: address,
      value,
      nonce,
    });
  });
});
