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

const { before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const { AbiCoder, makeError } = require('ethers');

const getRevokedStatus = mock.fn();
mock.module('@verii/base-contract-io', {
  namedExports: {
    initContractClient: mock.fn(async () => ({
      contractClient: { getRevokedStatus },
      pullEvents: () => mock.fn(),
    })),
    initContractWithTransactingClient: mock.fn(),
  },
});

const initRevocationRegistry = require('../src/revocation-registry');
const { RevocationRegistryErrorCodes } = require('../src/constants');

const contractAddress = `0x${'a'.repeat(40)}`;
const holderAddress = `0x${'b'.repeat(40)}`;
const statusUrl = `ethereum:${contractAddress}/getRevokedStatus?address=${holderAddress}&listId=1&index=10240`;
const transaction = { to: contractAddress, data: '0x' };
const abiCoder = AbiCoder.defaultAbiCoder();

// The CALL_EXCEPTION ethers builds from a call's revert data
const callException = (revertData) =>
  AbiCoder.getBuiltinCallException('call', transaction, revertData);

const errorStringRevertData = `0x08c379a0${abiCoder
  .encode(['string'], ['list index out of bound'])
  .slice(2)}`;
const panicRevertData = `0x4e487b71${abiCoder.encode(['uint256'], [0x11]).slice(2)}`;
const customErrorRevertData = '0xdeadbeef';

describe('getRevokedStatus contract call errors', () => {
  let revocationRegistry;

  before(async () => {
    revocationRegistry = await initRevocationRegistry(
      { contractAddress },
      { log: { info: () => {}, warn: () => {}, error: () => {} } },
    );
  });

  beforeEach(() => {
    getRevokedStatus.mock.resetCalls();
  });

  [
    {
      title: 'an Error(string)',
      buildError: () => callException(errorStringRevertData),
    },
    { title: 'a Panic', buildError: () => callException(panicRevertData) },
    {
      title: 'a custom error',
      buildError: () => callException(customErrorRevertData),
    },
  ].forEach(({ title, buildError }) => {
    it(`should throw an invalid_revocation_url error with the revert as its cause when the call reverts with ${title}`, async () => {
      const revert = buildError();
      getRevokedStatus.mock.mockImplementationOnce(() =>
        Promise.reject(revert),
      );

      const error = await revocationRegistry
        .getRevokedStatus(statusUrl)
        .catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBe(revert);
      expect(error).toMatchObject({
        message: revert.shortMessage,
        code: RevocationRegistryErrorCodes.INVALID_REVOCATION_URL,
        cause: revert,
      });
      expect(getRevokedStatus.mock.calls[0].arguments).toEqual([
        holderAddress,
        '1',
        '10240',
      ]);
    });
  });

  [
    {
      title: 'a CALL_EXCEPTION without revert data',
      buildError: () => callException(null),
    },
    {
      title: 'a CALL_EXCEPTION with empty revert data',
      buildError: () => callException('0x'),
    },
    {
      title: 'a BAD_DATA error',
      buildError: () =>
        makeError('could not decode result data', 'BAD_DATA', {
          value: '0x',
        }),
    },
    {
      title: 'a NETWORK_ERROR',
      buildError: () =>
        makeError('network error', 'NETWORK_ERROR', { event: 'noNetwork' }),
    },
    {
      title: 'a TIMEOUT',
      buildError: () =>
        makeError('request timeout', 'TIMEOUT', { operation: 'call' }),
    },
    {
      title: 'a SERVER_ERROR',
      buildError: () =>
        makeError('server response 503', 'SERVER_ERROR', { request: null }),
    },
    {
      title: 'a connection error',
      buildError: () =>
        Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8545'), {
          code: 'ECONNREFUSED',
        }),
    },
  ].forEach(({ title, buildError }) => {
    it(`should rethrow ${title} unchanged`, async () => {
      const callError = buildError();
      getRevokedStatus.mock.mockImplementationOnce(() =>
        Promise.reject(callError),
      );

      const error = await revocationRegistry
        .getRevokedStatus(statusUrl)
        .catch((e) => e);

      expect(error).toBe(callError);
      expect(error.code).not.toEqual(
        RevocationRegistryErrorCodes.INVALID_REVOCATION_URL,
      );
    });
  });

  it('should return the status when the call succeeds', async () => {
    getRevokedStatus.mock.mockImplementationOnce(() => Promise.resolve(1n));

    expect(await revocationRegistry.getRevokedStatus(statusUrl)).toEqual(1n);
  });
});
