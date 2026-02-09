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

const { after, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const ethers = require('ethers');

const superSendTransactionMock = mock.fn();
const getNonceMock = mock.fn();
const incrementMock = mock.fn();
const resetMock = mock.fn();

const nonceManagerPrototype = ethers.NonceManager.prototype;
const originalSendTransaction = nonceManagerPrototype.sendTransaction;
const originalGetNonce = nonceManagerPrototype.getNonce;
const originalIncrement = nonceManagerPrototype.increment;
const originalReset = nonceManagerPrototype.reset;

nonceManagerPrototype.sendTransaction = (tx) => superSendTransactionMock(tx);

nonceManagerPrototype.getNonce = (blockTag) => getNonceMock(blockTag);

nonceManagerPrototype.increment = () => {
  incrementMock();
};

nonceManagerPrototype.reset = () => {
  resetMock();
};

const { ResyncingNonceManager } = require('../src/resyncing-nonce-manager');

const createSigner = () => ({
  provider: {},
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

describe('ResyncingNonceManager', () => {
  beforeEach(() => {
    superSendTransactionMock.mock.resetCalls();
    getNonceMock.mock.resetCalls();
    incrementMock.mock.resetCalls();
    resetMock.mock.resetCalls();

    superSendTransactionMock.mock.mockImplementation((tx) =>
      Promise.resolve({ hash: '0xsuper', tx }),
    );
    getNonceMock.mock.mockImplementation(() => Promise.resolve(10));
  });

  after(() => {
    nonceManagerPrototype.sendTransaction = originalSendTransaction;
    nonceManagerPrototype.getNonce = originalGetNonce;
    nonceManagerPrototype.increment = originalIncrement;
    nonceManagerPrototype.reset = originalReset;
    mock.reset();
  });

  it('uses regular NonceManager flow on the first attempt', async () => {
    const signer = createSigner();
    const manager = new ResyncingNonceManager(signer);

    const result = await manager.sendTransaction({ to: '0xaaa' });

    expect(result).toEqual({ hash: '0xsuper', tx: { to: '0xaaa' } });
    expect(superSendTransactionMock.mock.callCount()).toEqual(1);
    expect(superSendTransactionMock.mock.calls[0].arguments[0]).toEqual({
      to: '0xaaa',
    });
    expect(getNonceMock.mock.callCount()).toEqual(0);
    expect(incrementMock.mock.callCount()).toEqual(0);
    expect(resetMock.mock.callCount()).toEqual(0);
    expect(signer.populateTransaction.mock.callCount()).toEqual(0);
    expect(signer.sendTransaction.mock.callCount()).toEqual(0);
  });

  it('retries with explicit nonce on nonce-conflict errors', async () => {
    const signer = createSigner();
    const manager = new ResyncingNonceManager(signer);
    const nonceConflictError = Object.assign(new Error('nonce conflict'), {
      info: { error: { code: 'NONCE_EXPIRED' } },
    });

    superSendTransactionMock.mock.mockImplementationOnce(() =>
      Promise.reject(nonceConflictError),
    );
    getNonceMock.mock.mockImplementationOnce(() => Promise.resolve(42));

    const result = await manager.sendTransaction({ to: '0xbbb' });

    expect(result).toEqual({
      hash: '0x1',
      tx: { to: '0xbbb', nonce: 42, gasLimit: 1n },
    });
    expect(superSendTransactionMock.mock.callCount()).toEqual(1);
    expect(resetMock.mock.callCount()).toEqual(1);
    expect(getNonceMock.mock.callCount()).toEqual(1);
    expect(getNonceMock.mock.calls[0].arguments).toEqual(['pending']);
    expect(incrementMock.mock.callCount()).toEqual(1);
    expect(signer.populateTransaction.mock.callCount()).toEqual(1);
    expect(signer.populateTransaction.mock.calls[0].arguments[0]).toEqual({
      to: '0xbbb',
      nonce: 42,
    });
    expect(signer.sendTransaction.mock.callCount()).toEqual(1);
    expect(signer.sendTransaction.mock.calls[0].arguments[0]).toEqual({
      to: '0xbbb',
      nonce: 42,
      gasLimit: 1n,
    });
  });

  it('does not retry on non-nonce errors and resets once', async () => {
    const signer = createSigner();
    const manager = new ResyncingNonceManager(signer);
    const boom = new Error('boom');

    superSendTransactionMock.mock.mockImplementationOnce(() =>
      Promise.reject(boom),
    );

    await expect(manager.sendTransaction({ to: '0xccc' })).rejects.toThrow(
      'boom',
    );

    expect(superSendTransactionMock.mock.callCount()).toEqual(1);
    expect(resetMock.mock.callCount()).toEqual(1);
    expect(getNonceMock.mock.callCount()).toEqual(0);
    expect(incrementMock.mock.callCount()).toEqual(0);
    expect(signer.populateTransaction.mock.callCount()).toEqual(0);
    expect(signer.sendTransaction.mock.callCount()).toEqual(0);
  });

  it('resets twice when retry explicit send setup fails', async () => {
    const signer = createSigner();
    const manager = new ResyncingNonceManager(signer);
    const nonceConflictError = Object.assign(new Error('nonce conflict'), {
      code: 'NONCE_EXPIRED',
    });

    superSendTransactionMock.mock.mockImplementationOnce(() =>
      Promise.reject(nonceConflictError),
    );
    getNonceMock.mock.mockImplementationOnce(() => Promise.resolve(7));
    signer.populateTransaction.mock.mockImplementationOnce(() =>
      Promise.reject(new Error('retry populate failed')),
    );

    await expect(manager.sendTransaction({ to: '0xddd' })).rejects.toThrow(
      'retry populate failed',
    );

    expect(resetMock.mock.callCount()).toEqual(2);
    expect(incrementMock.mock.callCount()).toEqual(1);
    expect(signer.sendTransaction.mock.callCount()).toEqual(0);
  });

  it('serializes concurrent sends through the internal queue', async () => {
    const signer = createSigner();
    const manager = new ResyncingNonceManager(signer);
    const firstSend = createDeferred();
    let sendCallNumber = 0;

    superSendTransactionMock.mock.mockImplementation((tx) => {
      sendCallNumber += 1;
      if (sendCallNumber === 1) {
        return firstSend.promise;
      }
      return Promise.resolve({ hash: '0xsecond', tx });
    });

    const firstPromise = manager.sendTransaction({ nonce: 1 });
    const secondPromise = manager.sendTransaction({ nonce: 2 });

    await Promise.resolve();
    expect(superSendTransactionMock.mock.callCount()).toEqual(1);

    firstSend.resolve({ hash: '0xfirst', tx: { nonce: 1 } });
    const [firstResult, secondResult] = await Promise.all([
      firstPromise,
      secondPromise,
    ]);

    expect(firstResult).toEqual({ hash: '0xfirst', tx: { nonce: 1 } });
    expect(secondResult).toEqual({ hash: '0xsecond', tx: { nonce: 2 } });
    expect(superSendTransactionMock.mock.callCount()).toEqual(2);
    expect(superSendTransactionMock.mock.calls[0].arguments[0]).toEqual({
      nonce: 1,
    });
    expect(superSendTransactionMock.mock.calls[1].arguments[0]).toEqual({
      nonce: 2,
    });
  });
});
