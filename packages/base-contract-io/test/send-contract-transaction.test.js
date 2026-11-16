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
const ethers = require('ethers');

const { generateDisposablePrivateKey } = require('@verii/blockchain-functions');
const { wait } = require('@verii/common-functions');
const {
  initContractClient,
  initProvider,
  sendContractTransaction,
} = require('../index');
const { toEthersPrivateKey } = require('../src/private-key');
const { deployContract } = require('./helpers/deployContract');
const testNoEventsAbi = require('./data/test-no-events-abi.json');

const rpcUrl = 'http://localhost:8545';
const authenticate = () => 'TOKEN';
const targetAddress = '0x0000000000000000000000000000000000000001';
const context = { log: { info: () => {}, warn: () => {}, error: () => {} } };

const setUp = async () => {
  const privateKey = generateDisposablePrivateKey();
  const deployed = await deployContract(testNoEventsAbi, privateKey, rpcUrl);
  const rpcProvider = initProvider(rpcUrl, authenticate);
  const { contractClient } = await initContractClient(
    {
      privateKey,
      contractAddress: await deployed.getAddress(),
      rpcProvider,
      contractAbi: testNoEventsAbi,
    },
    context,
  );
  // Another server sending from the same account.
  const otherServerWallet = new ethers.Wallet(
    toEthersPrivateKey(privateKey),
    new ethers.JsonRpcProvider(rpcUrl),
  );
  return { contractClient, otherServerWallet, rpcProvider };
};

// The contract, except that the other server sends a transaction with the
// same nonce just after the first call is sent.
const raceFirstCall = (contractClient, buildOtherTransaction) => {
  const calls = [];
  const contract = {
    runner: contractClient.runner,
    interface: contractClient.interface,
    addAddressScope: async (...args) => {
      const tx = await contractClient.addAddressScope(...args);
      calls.push(tx.hash);
      if (calls.length === 1) {
        const other = await buildOtherTransaction(tx);
        calls.push(other.hash);
      }
      return tx;
    },
  };
  return { contract, calls };
};

// Resolves just after the node makes a block, so the race starts with most of
// a block period before the next one.
const waitForNewBlock = async (rpcProvider) => {
  const start = await rpcProvider.send('eth_blockNumber', []);
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    if ((await rpcProvider.send('eth_blockNumber', [])) !== start) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await wait(20);
  }
};

const freeTransaction = { type: 0, gasPrice: 0n, value: 0n };

describe('sendContractTransaction', { timeout: 60000 }, () => {
  it('returns the receipt once the call is mined', async () => {
    const { contractClient, rpcProvider } = await setUp();

    const receipt = await sendContractTransaction(
      {
        contract: contractClient,
        method: 'addAddressScope',
        args: [targetAddress, 'mined-scope'],
      },
      context,
    );

    expect(receipt).toBeInstanceOf(ethers.ContractTransactionReceipt);
    expect(receipt.status).toEqual(1);
    expect(
      await contractClient.checkAddressScope(targetAddress, 'mined-scope'),
    ).toEqual(true);
    rpcProvider.destroy();
  });

  it('sends the call again when another transaction takes its nonce', async () => {
    const { contractClient, otherServerWallet, rpcProvider } = await setUp();
    const { contract, calls } = raceFirstCall(contractClient, (tx) =>
      otherServerWallet.sendTransaction({
        ...freeTransaction,
        to: targetAddress,
        nonce: tx.nonce,
      }),
    );
    await waitForNewBlock(rpcProvider);

    const receipt = await sendContractTransaction(
      {
        contract,
        method: 'addAddressScope',
        args: [targetAddress, 'replaced-scope'],
      },
      context,
    );

    const [replacedHash, otherHash, resentHash] = calls;
    expect(calls).toHaveLength(3);
    expect(await rpcProvider.getTransactionReceipt(replacedHash)).toBeNull();
    expect((await rpcProvider.getTransactionReceipt(otherHash)).status).toEqual(
      1,
    );
    expect(receipt.hash).toEqual(resentHash);
    expect(receipt.status).toEqual(1);
    expect(
      await contractClient.checkAddressScope(targetAddress, 'replaced-scope'),
    ).toEqual(true);
    rpcProvider.destroy();
  });

  it('returns the other transaction when it made the same call', async () => {
    const { contractClient, otherServerWallet, rpcProvider } = await setUp();
    // A different gas limit, or the node treats it as the same transaction.
    const { contract, calls } = raceFirstCall(contractClient, (tx) =>
      otherServerWallet.sendTransaction({
        ...freeTransaction,
        to: tx.to,
        data: tx.data,
        nonce: tx.nonce,
        gasLimit: tx.gasLimit + 1n,
      }),
    );
    await waitForNewBlock(rpcProvider);

    const receipt = await sendContractTransaction(
      {
        contract,
        method: 'addAddressScope',
        args: [targetAddress, 'repriced-scope'],
      },
      context,
    );

    const [replacedHash, otherHash] = calls;
    expect(calls).toHaveLength(2);
    expect(await rpcProvider.getTransactionReceipt(replacedHash)).toBeNull();
    expect(receipt.hash).toEqual(otherHash);
    expect(
      await contractClient.checkAddressScope(targetAddress, 'repriced-scope'),
    ).toEqual(true);
    rpcProvider.destroy();
  });
});
