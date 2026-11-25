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
const {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
  mock,
} = require('node:test');
const { expect } = require('expect');

const { generateKeyPair } = require('@verii/crypto');
const {
  mongoFactoryWrapper,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const { env: config } = require('@spencejs/spence-config');
const console = require('console');

const {
  generateAccount,
  generateDisposablePrivateKey,
} = require('@verii/blockchain-functions');

const { wait } = require('@verii/common-functions');
const testEventsAbi = require('./data/test-events-abi.json');
const { initContractClient, initProvider } = require('../index');
const { deployContract } = require('./helpers/deployContract');

const context = {
  log: console,
  config,
};

describe('Contract Client Test Suite', { timeout: 25000 }, () => {
  const deployerPrivateKey = generateDisposablePrivateKey();
  const randomAccount = generateAccount().address;
  const rpcUrl = 'http://localhost:8545';
  const authenticate = () => 'TOKEN';
  const rpcProvider = initProvider(rpcUrl, authenticate);

  const deployContractThatHasEvents = () =>
    deployContract(testEventsAbi, deployerPrivateKey, rpcUrl, (contract) =>
      contract.initialize(randomAccount, ['0x2c26']),
    );

  before(async () => {
    await mongoFactoryWrapper('test-contract', context);
  });

  afterEach(async () => {
    await wait(1000);
  });

  after(async () => {
    await mongoCloseWrapper();
  });

  describe('Contract Client Creation Test Suite', () => {
    let contractInstance;
    let contractClient;

    beforeEach(async () => {
      contractInstance = await deployContractThatHasEvents();
    });
    it('Creating a client with no contractAddress should fail', async () => {
      const clientPrivateKey = generateDisposablePrivateKey();
      const func = async () =>
        initContractClient(
          {
            privateKey: clientPrivateKey,
            contractAbi: testEventsAbi,
            rpcProvider,
          },
          context,
        );
      expect(func).rejects.toThrow(
        'Check the required parameters: contractAddress',
      );
    });

    it('Create a client', async () => {
      const { privateKey } = generateKeyPair({ format: 'jwk' });
      const contractAddress = await contractInstance.getAddress();
      const log = { info: mock.fn() };

      contractClient = await initContractClient(
        {
          privateKey,
          contractAddress,
          contractAbi: testEventsAbi,
          rpcProvider,
        },
        { ...context, log },
      );

      expect(contractClient.wallet.provider).toEqual(rpcProvider);
      expect(contractClient.contractClient.runner.provider).toEqual(
        rpcProvider,
      );
      expect(log.info.mock.calls.map((call) => call.arguments)).toEqual([
        [{ contractAddress, hasPrivateKey: true }, 'initContractClient'],
        ['initContractClient done'],
      ]);
    });
  });

  describe('Contract Client functions Test Suite', () => {
    let initialized;
    let contractWithEventsClient;

    before(async () => {
      const contractInstance = await deployContractThatHasEvents();
      [initialized] = await contractInstance.queryFilter('Initialized');
      // Make the event block historical so the upper bound differs from the head.
      const later = await contractInstance.runner.sendTransaction({
        to: randomAccount,
        value: 0,
      });
      await later.wait();
      const clientPrivateKey = generateDisposablePrivateKey();

      contractWithEventsClient = await initContractClient(
        {
          privateKey: clientPrivateKey,
          contractAddress: await contractInstance.getAddress(),
          contractAbi: testEventsAbi,
          rpcProvider,
        },
        context,
      );
    });

    it('clamps an event query to the chain head', async (t) => {
      const futureBlock = (await rpcProvider.getBlockNumber()) + 1000;
      const getBlockNumber = t.mock.method(rpcProvider, 'getBlockNumber');
      const getLogs = t.mock.method(rpcProvider, 'getLogs');
      const pullEvents = contractWithEventsClient.pullEvents(
        'CreatedMetadataList',
      );
      const { latestBlock, eventsCursor } = await pullEvents(0, futureBlock);
      const events = (await Array.fromAsync(eventsCursor())).flat();
      const [{ toBlock }] = getLogs.mock.calls.at(-1).arguments;
      const head = await getBlockNumber.mock.calls[0].result;

      expect({ latestBlock, toBlock, events }).toEqual({
        latestBlock: head,
        toBlock: head,
        events: [],
      });
    });

    [
      ['includes an event in a single-block range', 0],
      ['includes an event at the end of a bounded range', 500],
    ].forEach(([name, span]) => {
      it(name, async (t) => {
        const endBlock = initialized.blockNumber;
        // A fresh test chain may have fewer than 500 historical blocks.
        const fromBlock = Math.max(0, endBlock - span);
        const getLogs = t.mock.method(rpcProvider, 'getLogs');
        const pullEvents = contractWithEventsClient.pullEvents('Initialized');
        const { latestBlock, eventsCursor } = await pullEvents(
          fromBlock,
          endBlock,
        );
        const events = (await Array.fromAsync(eventsCursor())).flat();

        const firstRangeEnd = Math.min(fromBlock + 499, endBlock);
        const ranges = [[fromBlock, firstRangeEnd]];
        if (firstRangeEnd < endBlock) {
          ranges.push([endBlock, endBlock]);
        }

        expect({
          latestBlock,
          ranges: getLogs.mock.calls.map(
            ({ arguments: [{ fromBlock: from, toBlock: to }] }) => [from, to],
          ),
          events: events.map(({ transactionHash }) => transactionHash),
        }).toEqual({
          latestBlock: endBlock,
          ranges,
          events: [initialized.transactionHash],
        });
      });
    });
  });
});
