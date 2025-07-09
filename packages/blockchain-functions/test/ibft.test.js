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

const { initGetSignerMetrics } = require('../src/ibft');

jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  JsonRpcProvider: jest.fn(() => ({
    send: () => Promise.resolve(signerMetricsResult),
  })),
}));

const rpcUrl = 'RPC-URL';
const authenticate = () => Promise.resolve('TOKEN');
const signerMetricsResult = [
  {
    address: '0x5f46681ccef906ac45f1348fefff31ff498650e2',
    proposedBlockCount: '0x19',
    lastProposedBlockNumber: '0x575f0c',
  },
  {
    address: '0x2f47c6f1e96c8fb4d94c66579f54b44cd8a90b6e',
    proposedBlockCount: '0x19',
    lastProposedBlockNumber: '0x575f0a',
  },
  {
    address: '0xea80db5c770bdd377e04902a6d068ac850f35649',
    proposedBlockCount: '0x19',
    lastProposedBlockNumber: '0x575f09',
  },
  {
    address: '0x528684eb5133dbf9ec3672a71e95b0e1cde8282d',
    proposedBlockCount: '0x19',
    lastProposedBlockNumber: '0x575f0b',
  },
];

describe('IBFT Signer Metrics', () => {
  it('Should return IBFT signer merics', async () => {
    const getSignerMetrics = await initGetSignerMetrics({
      rpcUrl,
      authenticate,
    });

    const result = await getSignerMetrics();

    expect(result).toEqual(signerMetricsResult);
  });
});
