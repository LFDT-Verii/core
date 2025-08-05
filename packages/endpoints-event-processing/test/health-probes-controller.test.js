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

const { after, before, describe, it, mock } = require('node:test');
const { expect } = require('expect');

mock.module('@verii/blockchain-functions', {
  namedExports: {
    initGetSignerMetrics: mock.fn(),
    initGetBlockNumber: mock.fn(),
    initGetBlock: mock.fn(),
  },
});

const {
  initGetSignerMetrics,
  initGetBlockNumber,
  initGetBlock,
} = require('@verii/blockchain-functions');
const buildFastify = require('./helpers/build-fastify');

jest.mock('@verii/blockchain-functions', () => ({
  initGetSignerMetrics: jest.fn(),
  initGetBlockNumber: jest.fn(),
  initGetBlock: jest.fn(),
}));

describe('Blockchain Health', () => {
  const baseUrl = 'api/v0.6/health-probes';
  const nodeAddress = '0x0';
  let fastify;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
    mock.reset();
  });

  describe('Consensus Health', () => {
    it('Should return UP if last block is from last few seconds', async () => {
      initGetBlockNumber.mock.mockImplementationOnce(() =>
        Promise.resolve(() => Promise.resolve(1))
      );
      initGetBlock.mock.mockImplementationOnce(() =>
        Promise.resolve(() =>
          Promise.resolve({
            timestamp: Math.floor(new Date().getTime() / 1000),
          })
        )
      );

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/consensus`,
      });

      expect(response.json).toEqual({ status: 'UP' });
    });

    it('Should return DOWN too much time has passed since last block', async () => {
      initGetBlockNumber.mock.mockImplementationOnce(() =>
        Promise.resolve(() => Promise.resolve(1))
      );
      initGetBlock.mock.mockImplementationOnce(() =>
        Promise.resolve(() =>
          Promise.resolve({
            timestamp: 1,
          })
        )
      );

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/consensus`,
      });

      expect(response.json).toEqual({ status: 'DOWN' });
    });
  });

  describe('Node Health', () => {
    it('Should return UP if node metrics changed', async () => {
      initGetSignerMetrics.mock.mockImplementationOnce(() =>
        Promise.resolve(() =>
          Promise.resolve([
            { address: nodeAddress, lastProposedBlockNumber: '0x1' },
            { address: '0x1', lastProposedBlockNumber: '0x2' },
          ])
        )
      );
      initGetBlockNumber.mock.mockImplementationOnce(() =>
        Promise.resolve(() => Promise.resolve(2))
      );

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/node/${nodeAddress}`,
      });

      expect(response.json).toEqual({ status: 'UP' });
    });

    it('Should return DOWN if node metrics did not change', async () => {
      initGetSignerMetrics.mock.mockImplementationOnce(() =>
        Promise.resolve(() =>
          Promise.resolve([
            { address: nodeAddress, lastProposedBlockNumber: '0x1' },
            { address: '0x1', lastProposedBlockNumber: '0x2' },
          ])
        )
      );
      initGetBlockNumber.mock.mockImplementationOnce(() =>
        Promise.resolve(() => Promise.resolve(8))
      );

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/node/${nodeAddress}`,
      });

      expect(response.json).toEqual({ status: 'DOWN' });
    });
  });
});
