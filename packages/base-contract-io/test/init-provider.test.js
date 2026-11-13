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
const { flatten, map } = require('lodash/fp');

const { generateDisposablePrivateKey } = require('@verii/blockchain-functions');
const { initContractClient, initProvider } = require('../index');
const { deployContract } = require('./helpers/deployContract');
const testNoEventsAbi = require('./data/test-no-events-abi.json');

const rpcUrl = 'http://localhost:8545';
const authenticate = () => 'TOKEN';
const targetAddress = '0x0000000000000000000000000000000000000001';

// The JSON-RPC methods the provider sends to the node.
const recordRpcMethods = (rpcProvider) => {
  const methods = [];
  rpcProvider.on('debug', ({ action, payload }) => {
    if (action === 'sendRpcPayload') {
      methods.push(...map('method', flatten([payload])));
    }
  });
  return methods;
};

describe('initProvider', { timeout: 60000 }, () => {
  it('asks the node for the chain ID once when none is configured', async () => {
    const privateKey = generateDisposablePrivateKey();
    const contract = await deployContract(testNoEventsAbi, privateKey, rpcUrl);
    const rpcProvider = initProvider(rpcUrl, authenticate);
    const rpcMethods = recordRpcMethods(rpcProvider);
    const { contractClient } = await initContractClient(
      {
        privateKey,
        contractAddress: await contract.getAddress(),
        rpcProvider,
        contractAbi: testNoEventsAbi,
      },
      { log: { info: () => {}, error: () => {} } },
    );

    for (const scope of ['chain-id-first', 'chain-id-second']) {
      // eslint-disable-next-line no-await-in-loop
      const transaction = await contractClient.addAddressScope(
        targetAddress,
        `${scope}-${Date.now()}`,
      );
      // eslint-disable-next-line no-await-in-loop
      await transaction.wait();
    }

    expect(rpcMethods).toContain('eth_sendRawTransaction');
    expect(rpcMethods.filter((method) => method === 'eth_chainId')).toEqual([
      'eth_chainId',
    ]);
    rpcProvider.destroy();
  });
});
