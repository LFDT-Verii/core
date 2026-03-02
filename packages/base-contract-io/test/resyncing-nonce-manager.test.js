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

const { describe, it, mock } = require('node:test');
const { expect } = require('expect');

const { ResyncingNonceManager } = require('../src/resyncing-nonce-manager');

const createSigner = () => ({
  provider: {},
  getNonce: mock.fn((blockTag) => {
    if (blockTag === 'pending') {
      return Promise.resolve(10);
    }
    return Promise.resolve(10);
  }),
  populateTransaction: mock.fn((tx) =>
    Promise.resolve({ ...tx, gasLimit: 1n }),
  ),
  sendTransaction: mock.fn((tx) => Promise.resolve({ hash: '0x1', tx })),
});

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const waitForQueueTick = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe('ResyncingNonceManager', () => {
  it('uses explicit nonce on the first attempt', async () => {
    const signer = createSigner();
    const manager = new ResyncingNonceManager(signer);

    const result = await manager.sendTransaction({ to: '0xaaa' });

    expect(result).toEqual({
      hash: '0x1',
      tx: { to: '0xaaa', nonce: 10, gasLimit: 1n },
    });
    expect(signer.getNonce.mock.callCount()).toEqual(2);
    expect(signer.getNonce.mock.calls[0].arguments).toEqual(['pending']);
    expect(signer.getNonce.mock.calls[1].arguments).toEqual(['latest']);
    expect(signer.populateTransaction.mock.callCount()).toEqual(1);
    expect(signer.populateTransaction.mock.calls[0].arguments[0]).toEqual({
      to: '0xaaa',
      nonce: 10,
    });
    expect(signer.sendTransaction.mock.callCount()).toEqual(1);
    expect(signer.sendTransaction.mock.calls[0].arguments[0]).toEqual({
      to: '0xaaa',
      nonce: 10,
      gasLimit: 1n,
    });
  });

  it('retries nonce-conflict estimate failures and uses nonce from error', async () => {
    const signer = createSigner();
    const manager = new ResyncingNonceManager(signer);
    const originalReset = manager.reset.bind(manager);
    const resetMock = mock.fn(() => originalReset());
    manager.reset = resetMock;

    signer.getNonce.mock.mockImplementation((blockTag) => {
      if (blockTag === 'pending') {
        return Promise.resolve(0);
      }
      return Promise.resolve(0);
    });

    const nonceConflictError = Object.assign(
      new Error(
        'Nonce too low (transaction nonce 0 below sender account nonce 3)',
      ),
      { code: 'NONCE_EXPIRED' },
    );

    let populateCallCount = 0;
    signer.populateTransaction.mock.mockImplementation((tx) => {
      populateCallCount += 1;
      if (populateCallCount === 1) {
        return Promise.reject(nonceConflictError);
      }
      return Promise.resolve({ ...tx, gasLimit: 1n });
    });

    const result = await manager.sendTransaction({ to: '0xbbb' });

    expect(result).toEqual({
      hash: '0x1',
      tx: { to: '0xbbb', nonce: 3, gasLimit: 1n },
    });
    expect(resetMock.mock.callCount()).toEqual(1);
    expect(signer.populateTransaction.mock.callCount()).toEqual(2);
    expect(signer.populateTransaction.mock.calls[0].arguments[0]).toEqual({
      to: '0xbbb',
      nonce: 0,
    });
    expect(signer.populateTransaction.mock.calls[1].arguments[0]).toEqual({
      to: '0xbbb',
      nonce: 3,
    });
  });

  it('does not retry on non-nonce errors and resets once', async () => {
    const signer = createSigner();
    const manager = new ResyncingNonceManager(signer);
    const originalReset = manager.reset.bind(manager);
    const resetMock = mock.fn(() => originalReset());
    manager.reset = resetMock;
    const boom = new Error('boom');

    signer.populateTransaction.mock.mockImplementationOnce(() =>
      Promise.reject(boom),
    );

    await expect(manager.sendTransaction({ to: '0xccc' })).rejects.toThrow(
      'boom',
    );

    expect(resetMock.mock.callCount()).toEqual(1);
    expect(signer.populateTransaction.mock.callCount()).toEqual(1);
    expect(signer.sendTransaction.mock.callCount()).toEqual(0);
  });

  it('serializes concurrent sends through the internal queue', async () => {
    const signer = createSigner();
    const manager = new ResyncingNonceManager(signer);
    const firstPopulate = createDeferred();

    let populateCallCount = 0;
    signer.populateTransaction.mock.mockImplementation((tx) => {
      populateCallCount += 1;
      if (populateCallCount === 1) {
        return firstPopulate.promise;
      }
      return Promise.resolve({ ...tx, gasLimit: 2n });
    });

    const firstPromise = manager.sendTransaction({ nonce: 1 });
    const secondPromise = manager.sendTransaction({ nonce: 2 });

    await waitForQueueTick();
    expect(signer.populateTransaction.mock.callCount()).toEqual(1);

    firstPopulate.resolve({ nonce: 1, gasLimit: 1n });
    const [firstResult, secondResult] = await Promise.all([
      firstPromise,
      secondPromise,
    ]);

    expect(firstResult).toEqual({
      hash: '0x1',
      tx: { nonce: 10, gasLimit: 1n },
    });
    expect(secondResult).toEqual({
      hash: '0x1',
      tx: { nonce: 10, gasLimit: 2n },
    });
    expect(signer.populateTransaction.mock.callCount()).toEqual(2);
  });
});
