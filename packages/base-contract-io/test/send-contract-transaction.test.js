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

// The contract, except that the other server races the calls that have an
// entry in otherTransactions. It waits for a new block, so the race has most
// of a block period, and right after the call is sent it sends its own
// transaction with the call's nonce. Later calls aren't raced.
const raceCalls = (contractClient, rpcProvider, otherTransactions) => {
  const sent = { ours: [], others: [] };
  const contract = {
    runner: contractClient.runner,
    interface: contractClient.interface,
    addAddressScope: async (...args) => {
      const sendOther = otherTransactions[sent.ours.length];
      if (sendOther) {
        await waitForNewBlock(rpcProvider);
      }
      const tx = await contractClient.addAddressScope(...args);
      sent.ours.push(tx.hash);
      if (sendOther) {
        sent.others.push((await sendOther(tx)).hash);
      }
      return tx;
    },
  };
  return { contract, sent };
};

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

// A different transaction from the other server, with the call's nonce.
const differentTransaction = (wallet) => (tx) =>
  wallet.sendTransaction({
    ...freeTransaction,
    to: targetAddress,
    nonce: tx.nonce,
  });

// The same call from the other server, with the call's nonce. Its gas limit
// differs, or the node treats it as the same transaction.
const sameCall =
  (wallet, gasLimit = (tx) => tx.gasLimit + 1n) =>
  (tx) =>
    wallet.sendTransaction({
      ...freeTransaction,
      to: tx.to,
      data: tx.data,
      nonce: tx.nonce,
      gasLimit: gasLimit(tx),
    });

// Enough gas for the node to accept the transaction, but not to run it: the
// base cost, plus calldata at the highest per-byte price of any fork, plus
// 1,000. The call's storage write alone needs 20,000.
const tooLittleGas = (tx) =>
  ethers
    .getBytes(tx.data)
    .reduce((gas, byte) => gas + (byte === 0 ? 4n : 68n), 22000n);

const isMined = async (rpcProvider, hash) =>
  (await rpcProvider.getTransactionReceipt(hash)) != null;

const addScope = (contract, scope) =>
  sendContractTransaction(
    { contract, method: 'addAddressScope', args: [targetAddress, scope] },
    context,
  );

describe('sendContractTransaction', { timeout: 120000 }, () => {
  it('returns the receipt once the call is mined', async () => {
    const { contractClient, rpcProvider } = await setUp();

    const receipt = await addScope(contractClient, 'mined-scope');

    expect(receipt).toBeInstanceOf(ethers.ContractTransactionReceipt);
    expect(receipt.status).toEqual(1);
    expect(
      await contractClient.checkAddressScope(targetAddress, 'mined-scope'),
    ).toEqual(true);
    rpcProvider.destroy();
  });

  it('sends the call again when another transaction takes its nonce', async () => {
    const { contractClient, otherServerWallet, rpcProvider } = await setUp();
    const { contract, sent } = raceCalls(contractClient, rpcProvider, [
      differentTransaction(otherServerWallet),
    ]);

    const receipt = await addScope(contract, 'replaced-scope');

    expect(sent.ours).toHaveLength(2);
    expect(await isMined(rpcProvider, sent.ours[0])).toEqual(false);
    expect(
      (await rpcProvider.getTransactionReceipt(sent.others[0])).status,
    ).toEqual(1);
    expect(receipt.hash).toEqual(sent.ours[1]);
    expect(receipt.status).toEqual(1);
    expect(
      await contractClient.checkAddressScope(targetAddress, 'replaced-scope'),
    ).toEqual(true);
    rpcProvider.destroy();
  });

  it('returns the other transaction when it made the same call', async () => {
    const { contractClient, otherServerWallet, rpcProvider } = await setUp();
    const { contract, sent } = raceCalls(contractClient, rpcProvider, [
      sameCall(otherServerWallet),
    ]);

    const receipt = await addScope(contract, 'repriced-scope');

    expect(sent.ours).toHaveLength(1);
    expect(await isMined(rpcProvider, sent.ours[0])).toEqual(false);
    expect(receipt.hash).toEqual(sent.others[0]);
    expect(
      await contractClient.checkAddressScope(targetAddress, 'repriced-scope'),
    ).toEqual(true);
    rpcProvider.destroy();
  });

  it('throws when the same call from the other transaction reverted', async () => {
    const { contractClient, otherServerWallet, rpcProvider } = await setUp();
    const { contract, sent } = raceCalls(contractClient, rpcProvider, [
      sameCall(otherServerWallet, tooLittleGas),
    ]);

    await expect(addScope(contract, 'reverted-scope')).rejects.toMatchObject({
      code: 'CALL_EXCEPTION',
    });

    expect(sent.ours).toHaveLength(1);
    expect(
      (await rpcProvider.getTransactionReceipt(sent.others[0])).status,
    ).toEqual(0);
    expect(
      await contractClient.checkAddressScope(targetAddress, 'reverted-scope'),
    ).toEqual(false);
    rpcProvider.destroy();
  });

  it('returns the same call when it replaces the last attempt', async () => {
    const { contractClient, otherServerWallet, rpcProvider } = await setUp();
    const { contract, sent } = raceCalls(contractClient, rpcProvider, [
      differentTransaction(otherServerWallet),
      differentTransaction(otherServerWallet),
      sameCall(otherServerWallet),
    ]);

    const receipt = await addScope(contract, 'last-attempt-scope');

    expect(sent.ours).toHaveLength(3);
    expect(
      await Promise.all(sent.ours.map((hash) => isMined(rpcProvider, hash))),
    ).toEqual([false, false, false]);
    expect(receipt.hash).toEqual(sent.others[2]);
    expect(receipt.status).toEqual(1);
    expect(
      await contractClient.checkAddressScope(
        targetAddress,
        'last-attempt-scope',
      ),
    ).toEqual(true);
    rpcProvider.destroy();
  });
});
