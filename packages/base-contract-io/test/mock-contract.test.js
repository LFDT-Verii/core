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
  afterEach,
  beforeEach,
  describe,
  it,
  mock,
  after,
} = require('node:test');
const { expect } = require('expect');

const mockEncodeFilterTopics = mock.fn();
const mockGetBlockNumber = mock.fn();
const mockQueryFilter = mock.fn();
class Contract {}
Contract.prototype.getAddress = () => 'foo';
Contract.prototype.interface = {
  encodeFilterTopics: mockEncodeFilterTopics,
};
Contract.prototype.runner = {
  provider: {
    getBlockNumber: mockGetBlockNumber,
    connection: {
      headers: {},
    },
  },
};
Contract.prototype.queryFilter = mockQueryFilter;
class Wallet {}

mock.module('ethers', {
  defaultExport: {
    Wallet,
    Contract,
  },
});

const { range, map } = require('lodash/fp');
const { generateKeyPair } = require('@verii/crypto');
const { env: config } = require('@spencejs/spence-config');
const console = require('console');

const { wait } = require('@verii/common-functions');
const testEventsAbi = require('./data/test-events-abi.json');

const { initContractClient, initProvider } = require('../index');

const context = {
  log: console,
  config,
};
describe.skip('Mocked Contract Client Test Suite', () => {
  const authenticate = () => 'TOKEN';

  afterEach(async () => {
    await wait(1000);
  });

  beforeEach(() => {
    // mockContract.mock.resetCalls();
    // mockContract.mock.mockImplementation();
    mockEncodeFilterTopics.mock.mockImplementation(() => [
      'fooTopic1',
      'fooTopic2',
    ]);
  });

  after(() => {
    mock.reset();
  });

  describe('Contract Client functions Test Suite', () => {
    let contractWithEventsClient;

    beforeEach(async () => {
      const { privateKey: clientPrivateKey } = generateKeyPair();

      contractWithEventsClient = await initContractClient(
        {
          privateKey: clientPrivateKey,
          contractAddress: 'foo',
          contractAbi: testEventsAbi,
          rpcProvider: initProvider('foo', authenticate),
        },
        context,
      );
    });

    it('Should be able to get events', async () => {
      mockGetBlockNumber.mock.mockImplementation(() => Promise.resolve(3432));
      mockQueryFilter.mock.mockImplementation(() =>
        Promise.resolve(map((n) => ({ event: n }), range(0, 200))),
      );

      const pullFooEvents = contractWithEventsClient.pullEvents(
        'CreatedMetadataList',
      );
      const { latestBlock, eventsCursor } = await pullFooEvents();

      for await (const events of eventsCursor()) {
        expect(events).toHaveLength(200);
      }
      expect(latestBlock).toEqual(3432);
      expect(mockQueryFilter.mock.callCount()).toEqual(7);
      expect(mockQueryFilter).toHaveBeenNthCalledWith(
        1,
        'CreatedMetadataList',
        0,
        499,
      );
      expect(mockQueryFilter).toHaveBeenNthCalledWith(
        2,
        'CreatedMetadataList',
        500,
        999,
      );
      expect(mockQueryFilter).toHaveBeenNthCalledWith(
        3,
        'CreatedMetadataList',
        1000,
        1499,
      );
      expect(mockQueryFilter).toHaveBeenNthCalledWith(
        4,
        'CreatedMetadataList',
        1500,
        1999,
      );
      expect(mockQueryFilter).toHaveBeenNthCalledWith(
        5,
        'CreatedMetadataList',
        2000,
        2499,
      );
      expect(mockQueryFilter).toHaveBeenNthCalledWith(
        6,
        'CreatedMetadataList',
        2500,
        2999,
      );
      expect(mockQueryFilter).toHaveBeenNthCalledWith(
        7,
        'CreatedMetadataList',
        3000,
        3432,
      );
    });
  });
});
