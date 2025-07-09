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

const mockSentryInit = jest.fn();
const mockSentryCaptureException = jest.fn();
const mockSentryStartTransaction = jest.fn();
const mockFinishTransaction = jest.fn();

const { initSendError } = require('..');

jest.mock('@sentry/node', () => {
  const originalModule = jest.requireActual('@sentry/node');
  return {
    ...originalModule,
    init: mockSentryInit,
    captureException: mockSentryCaptureException,
    startTransaction: mockSentryStartTransaction,
  };
});

describe('Sentry test suite', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('should initialize sentry with captureException and startTransaction when dsn is provided and profiling is enabled', () => {
    const { sendError, startProfiling } = initSendError({
      dsn: 'test',
      enableProfiling: true,
    });
    const mockError = new Error('mock');
    sendError(mockError);
    startProfiling();
    expect(mockSentryInit).toHaveBeenCalledTimes(1);
    expect(mockSentryInit).toHaveBeenLastCalledWith({
      dsn: 'test',
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
      integrations: [expect.any(Object)],
      debug: expect.any(Boolean),
    });
    expect(mockSentryCaptureException).toHaveBeenCalledTimes(1);
    expect(mockSentryCaptureException).toHaveBeenLastCalledWith(mockError);
    expect(mockSentryStartTransaction).toHaveBeenCalledTimes(1);
    expect(mockSentryStartTransaction).toHaveBeenLastCalledWith();
  });

  it('should initialize sentry with captureException and without startTransaction when dsn is provided and profiling is disabled', () => {
    const { sendError, startProfiling } = initSendError({
      dsn: 'test',
    });
    const mockError = new Error('mock');
    sendError(mockError);
    startProfiling();
    expect(mockSentryInit).toHaveBeenCalledTimes(1);
    expect(mockSentryInit).toHaveBeenLastCalledWith({
      dsn: 'test',
      integrations: [],
      debug: expect.any(Boolean),
    });
    expect(mockSentryCaptureException).toHaveBeenCalledTimes(1);
    expect(mockSentryCaptureException).toHaveBeenLastCalledWith(mockError);
    expect(mockSentryStartTransaction).toHaveBeenCalledTimes(0);
  });

  it('initSendError should not initialize sentry and return no-op functions when dsn is not provided', () => {
    const { sendError, startProfiling } = initSendError();
    const mockError = new Error('mock');
    sendError(mockError);
    startProfiling();
    expect(mockSentryInit).toHaveBeenCalledTimes(0);
    expect(mockSentryCaptureException).toHaveBeenCalledTimes(0);
    expect(mockSentryStartTransaction).toHaveBeenCalledTimes(0);
  });

  it('finishProfiling should no-op when nothing passed to it', () => {
    const { finishProfiling } = initSendError();
    finishProfiling();
    expect(mockFinishTransaction).toHaveBeenCalledTimes(0);
  });

  it('finishProfiling should call finish function when transaction is passed', () => {
    const { finishProfiling } = initSendError({ dsn: 'test' });
    const finishableTransaction = {
      finish: mockFinishTransaction,
    };
    finishProfiling(finishableTransaction);
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
  });

  it('finishProfiling should no-op transaction is not passed', () => {
    const { finishProfiling } = initSendError({ dsn: 'test' });
    finishProfiling();
    expect(mockFinishTransaction).toHaveBeenCalledTimes(0);
  });

  it('finishProfiling should no-op if dsn is not passed', () => {
    const { finishProfiling } = initSendError();
    finishProfiling();
    expect(mockFinishTransaction).toHaveBeenCalledTimes(0);
  });

  it('sendError should skip 4xx errors', () => {
    const { sendError } = initSendError({ dsn: 'test' });
    const mockError = {
      status: 400,
    };
    sendError(mockError);
    expect(mockSentryCaptureException).toHaveBeenCalledTimes(0);
  });
});
