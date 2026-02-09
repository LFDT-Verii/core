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

const { generateKeyPair } = require('@verii/crypto');
const { initContractClient, initProvider } = require('../index');
const { deployContract } = require('./helpers/deployContract');
const testNoEventsAbi = require('./data/test-no-events-abi.json');

const rpcUrl = 'http://localhost:8545';
const authenticate = () => 'TOKEN';
const targetAddress = '0x0000000000000000000000000000000000000001';
const attemptsCount = 20;

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

describe('Contract Client Nonce Management', { timeout: 120000 }, () => {
  it('reproduces nonce collisions when signer caching is disabled', async () => {
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
      cacheSigner: false,
    });

    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some(hasNonceCollisionError)).toEqual(true);
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
});
