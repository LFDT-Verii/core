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

const { generateKeyPair } = require('@verii/crypto');
const { initContractClient, initProvider } = require('../index');
const { deployContract } = require('./helpers/deployContract');
const testNoEventsAbi = require('./data/test-no-events-abi.json');

const rpcUrl = 'http://localhost:8545';
const authenticate = () => 'TOKEN';
const targetAddress = '0x0000000000000000000000000000000000000001';
const attemptsCount = 20;
const retryRoundsCount = 5;

const nonceCollisionCodes = new Set([
  'NONCE_EXPIRED',
  'REPLACEMENT_UNDERPRICED',
]);
const nonceCollisionRegex = /nonce|replacement fee too low/i;

const getErrorCode = (error) => (error && error.code) || '';

const getErrorMessage = (error) => {
  const shortMessage =
    error && error.shortMessage ? String(error.shortMessage) : '';
  const message = error && error.message ? String(error.message) : '';
  return `${shortMessage} ${message}`;
};

const hasNonceCollisionError = (error) =>
  nonceCollisionCodes.has(getErrorCode(error)) ||
  nonceCollisionRegex.test(getErrorMessage(error));

const collectConcurrentScopeWriteFailures = async ({
  privateKey,
  contractAddress,
  rpcProvider,
  cacheSigner,
}) => {
  const writes = Array.from({ length: attemptsCount }).map(async (_, i) => {
    const { contractClient } = await initContractClient(
      {
        privateKey,
        contractAddress,
        rpcProvider,
        contractAbi: testNoEventsAbi,
        cacheSigner,
      },
      {
        log: {
          info: () => {},
          error: () => {},
        },
      },
    );

    return contractClient.addAddressScope(
      targetAddress,
      `nonce-race-scope-${Date.now()}-${i}`,
    );
  });

  const settled = await Promise.allSettled(writes);
  return settled
    .filter(({ status }) => status === 'rejected')
    .map(({ reason }) => reason);
};

const detectsNonceCollisionWithRetries = async ({
  roundsLeft,
  privateKey,
  contractAddress,
  rpcProvider,
}) => {
  if (roundsLeft <= 0) {
    return false;
  }

  const failures = await collectConcurrentScopeWriteFailures({
    privateKey,
    contractAddress,
    rpcProvider,
    cacheSigner: false,
  });

  if (failures.some(hasNonceCollisionError)) {
    return true;
  }

  return detectsNonceCollisionWithRetries({
    roundsLeft: roundsLeft - 1,
    privateKey,
    contractAddress,
    rpcProvider,
  });
};

describe('Contract Client Nonce Management', { timeout: 120000 }, () => {
  it('reproduces nonce collisions when signer caching is disabled', async () => {
    const { privateKey: deployerPrivateKey } = generateKeyPair();
    const rpcProvider = initProvider(rpcUrl, authenticate);
    const contract = await deployContract(
      testNoEventsAbi,
      deployerPrivateKey,
      rpcUrl,
    );

    const nonceCollisionDetected = await detectsNonceCollisionWithRetries({
      roundsLeft: retryRoundsCount,
      privateKey: deployerPrivateKey,
      contractAddress: await contract.getAddress(),
      rpcProvider,
    });

    expect(nonceCollisionDetected).toEqual(true);
  });

  it('avoids nonce collisions with the default signer cache', async () => {
    const { privateKey: deployerPrivateKey } = generateKeyPair();
    const rpcProvider = initProvider(rpcUrl, authenticate);
    const contract = await deployContract(
      testNoEventsAbi,
      deployerPrivateKey,
      rpcUrl,
    );

    const failures = await collectConcurrentScopeWriteFailures({
      privateKey: deployerPrivateKey,
      contractAddress: await contract.getAddress(),
      rpcProvider,
      cacheSigner: true,
    });

    expect(failures).toEqual([]);
  });

  it('resyncs cached signer nonce after external wallet transactions', async () => {
    const { privateKey: deployerPrivateKey } = generateKeyPair();
    const rpcProvider = initProvider(rpcUrl, authenticate);
    const contract = await deployContract(
      testNoEventsAbi,
      deployerPrivateKey,
      rpcUrl,
    );

    const { contractClient } = await initContractClient(
      {
        privateKey: deployerPrivateKey,
        contractAddress: await contract.getAddress(),
        rpcProvider,
        contractAbi: testNoEventsAbi,
        cacheSigner: true,
      },
      {
        log: {
          info: () => {},
          error: () => {},
        },
      },
    );

    await (
      await contractClient.addAddressScope(
        targetAddress,
        `nonce-sync-initial-${Date.now()}`,
      )
    ).wait();

    const externalWallet = new ethers.Wallet(
      `0x${deployerPrivateKey}`,
      new ethers.JsonRpcProvider(rpcUrl),
    );
    await (
      await externalWallet.sendTransaction({
        to: targetAddress,
        value: 0n,
      })
    ).wait();

    let sendError;
    try {
      await (
        await contractClient.addAddressScope(
          targetAddress,
          `nonce-sync-follow-up-${Date.now()}`,
        )
      ).wait();
    } catch (error) {
      sendError = error;
    }

    expect(sendError).toBeUndefined();
  });
});
