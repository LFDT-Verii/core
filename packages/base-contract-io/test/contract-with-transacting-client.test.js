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
const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { generateKeyPair } = require('@verii/crypto');
const {
  mongoFactoryWrapper,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const { env: config } = require('@spencejs/spence-config');
const console = require('console');

const testEventsAbi = require('./data/test-events-abi.json');
const testNoEventsAbi = require('./data/test-no-events-abi.json');

const { initContractWithTransactingClient, initProvider } = require('../index');
const { deployContract } = require('./helpers/deployContract');

const context = {
  log: console,
  config,
};

describe(
  'Contract With Transacting Client Test Suite',
  { timeout: 15000 },
  () => {
    const { privateKey: deployerPrivateKey } = generateKeyPair();
    const rpcUrl = 'http://localhost:8545';
    const authenticate = () => 'TOKEN';
    const rpcProvider = initProvider(rpcUrl, authenticate);

    const deployContractWrapper = () =>
      deployContract(testNoEventsAbi, deployerPrivateKey, rpcUrl);

    before(async () => {
      await mongoFactoryWrapper(
        'test-contract-with-transacting-client',
        context
      );
    });

    after(async () => {
      await mongoCloseWrapper();
    });

    describe('Contract With Transacting Client Creation Test Suite', () => {
      let contractInstance;
      let contractClient;

      beforeEach(async () => {
        contractInstance = await deployContractWrapper();
      });
      it('Creating a client with no contractAddress should fail', async () => {
        const { privateKey: clientPrivateKey } = generateKeyPair();
        const func = async () =>
          initContractWithTransactingClient(
            {
              privateKey: clientPrivateKey,
              contractAbi: testEventsAbi,
              rpcProvider,
            },
            context
          );
        expect(func).rejects.toThrow(
          'Check the required parameters: contractAddress'
        );
      });

      it('Create a client', async () => {
        const { privateKey: clientPrivateKey } = generateKeyPair();

        const { transactingClient } = await initContractWithTransactingClient(
          {
            privateKey: clientPrivateKey,
            contractAddress: await contractInstance.getAddress(),
            contractAbi: testEventsAbi,
            rpcProvider,
          },
          context
        );
        contractClient = transactingClient;

        expect(contractClient.wallet.provider).toEqual(rpcProvider);
        expect(contractClient.contractClient.runner.provider).toEqual(
          rpcProvider
        );
      });
    });
  }
);
