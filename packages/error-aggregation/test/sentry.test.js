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

mock.module('@sentry/node', {
  namedExports: {
    init: mockSentryInit,
    captureException: mockSentryCaptureException,
  },
});

const { initSendError } = require('..');

describe('Sentry test suite', () => {
  beforeEach(() => {
    mockSentryInit.mock.resetCalls();
    mockSentryCaptureException.mock.resetCalls();
  });

  after(() => {
    mock.reset();
  });

  it('should initialize sentry with captureException when dsn is provided', async () => {
    const { sendError } = await initSendError({
      dsn: 'test',
    });
    const mockError = new Error('mock');
    sendError(mockError);
    expect(mockSentryInit.mock.callCount()).toEqual(1);
    expect(mockSentryInit.mock.calls[0].arguments).toEqual([
      {
        dsn: 'test',
        debug: expect.any(Boolean),
      },
    ]);
    expect(mockSentryCaptureException.mock.callCount()).toEqual(1);
    expect(mockSentryCaptureException.mock.calls[0].arguments).toEqual([
      mockError,
    ]);
  });

  it('await initSendError should not initialize sentry and return a no-op sender when dsn is not provided', async () => {
    const { sendError } = await initSendError();
    const mockError = new Error('mock');
    sendError(mockError);
    expect(mockSentryInit.mock.callCount()).toEqual(0);
    expect(mockSentryCaptureException.mock.callCount()).toEqual(0);
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
