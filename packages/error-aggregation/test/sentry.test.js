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

const { beforeEach, describe, it, mock, after } = require('node:test');
const { expect } = require('expect');

const mockSentryInit = mock.fn();
const mockSentryCaptureException = mock.fn();
const mockSentryStartTransaction = mock.fn();
const mockFinishTransaction = mock.fn();

mock.module('@sentry/node', {
  namedExports: {
    init: mockSentryInit,
    captureException: mockSentryCaptureException,
    startTransaction: mockSentryStartTransaction,
  },
});

const { initSendError } = require('..');

describe('Sentry test suite', () => {
  beforeEach(() => {
    mockSentryInit.mock.resetCalls();
    mockSentryCaptureException.mock.resetCalls();
    mockSentryStartTransaction.mock.resetCalls();
    mockFinishTransaction.mock.resetCalls();
  });

  after(() => {
    mock.reset();
  });

  it('should initialize sentry with captureException and startTransaction when dsn is provided and profiling is enabled', async () => {
    const { sendError, startProfiling } = await initSendError({
      dsn: 'test',
      enableProfiling: true,
    });
    const mockError = new Error('mock');
    sendError(mockError);
    startProfiling();
    expect(mockSentryInit.mock.callCount()).toEqual(1);
    expect(mockSentryInit.mock.calls[0].arguments).toEqual([
      {
        dsn: 'test',
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
        integrations: [expect.any(Object)],
        debug: expect.any(Boolean),
      },
    ]);
    expect(mockSentryCaptureException.mock.callCount()).toEqual(1);
    expect(mockSentryCaptureException.mock.calls[0].arguments).toEqual([
      mockError,
    ]);
    expect(mockSentryStartTransaction.mock.callCount()).toEqual(1);
    expect(mockSentryStartTransaction.mock.calls[0].arguments).toEqual([]);
  });

  it('should initialize sentry with captureException and without startTransaction when dsn is provided and profiling is disabled', async () => {
    const { sendError, startProfiling } = await initSendError({
      dsn: 'test',
    });
    const mockError = new Error('mock');
    sendError(mockError);
    startProfiling();
    expect(mockSentryInit.mock.callCount()).toEqual(1);
    expect(mockSentryInit.mock.calls[0].arguments).toEqual([
      {
        dsn: 'test',
        integrations: [],
        debug: expect.any(Boolean),
      },
    ]);
    expect(mockSentryCaptureException.mock.callCount()).toEqual(1);
    expect(mockSentryCaptureException.mock.calls[0].arguments).toEqual([
      mockError,
    ]);
    expect(mockSentryStartTransaction.mock.callCount()).toEqual(0);
  });

  it('await initSendError should not initialize sentry and return no-op functions when dsn is not provided', async () => {
    const { sendError, startProfiling } = await initSendError();
    const mockError = new Error('mock');
    sendError(mockError);
    startProfiling();
    expect(mockSentryInit.mock.callCount()).toEqual(0);
    expect(mockSentryCaptureException.mock.callCount()).toEqual(0);
    expect(mockSentryStartTransaction.mock.callCount()).toEqual(0);
  });

  it('finishProfiling should no-op when nothing passed to it', async () => {
    const { finishProfiling } = await initSendError();
    finishProfiling();
    expect(mockFinishTransaction.mock.callCount()).toEqual(0);
  });

  it('finishProfiling should call finish function when transaction is passed', async () => {
    const { finishProfiling } = await initSendError({ dsn: 'test' });
    const finishableTransaction = {
      finish: mockFinishTransaction,
    };
    finishProfiling(finishableTransaction);
    expect(mockFinishTransaction.mock.callCount()).toEqual(1);
  });

  it('finishProfiling should no-op transaction is not passed', async () => {
    const { finishProfiling } = await initSendError({ dsn: 'test' });
    finishProfiling();
    expect(mockFinishTransaction.mock.callCount()).toEqual(0);
  });

  it('finishProfiling should no-op if dsn is not passed', async () => {
    const { finishProfiling } = await initSendError();
    finishProfiling();
    expect(mockFinishTransaction.mock.callCount()).toEqual(0);
  });

  it('sendError should skip 4xx errors', async () => {
    const { sendError } = await initSendError({ dsn: 'test' });
    const mockError = {
      status: 400,
    };
    sendError(mockError);
    expect(mockSentryCaptureException.mock.callCount()).toEqual(0);
  });
});
