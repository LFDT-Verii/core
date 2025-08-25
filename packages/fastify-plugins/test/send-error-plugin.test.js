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

const initSendError = mock.fn(() =>
  Promise.resolve({
    sendError: 'sendErrorFn',
    startProfiling: 'startProfilingFn',
    finishProfiling: 'finishProfilingFn',
  })
);
mock.module('@verii/error-aggregation', {
  namedExports: { initSendError },
});

const { sendErrorPlugin } = require('../src/send-error-plugin');

describe('Capture Exception to Sentry plugin tests', () => {
  beforeEach(() => {
    initSendError.mock.resetCalls();
  });

  after(() => {
    mock.reset();
  });

  it('sendErrorPlugin', async () => {
    const config = {
      sentryDsn: 'testDsn',
      nodeEnv: 'testEnv',
      version: 'testVersion',
    };
    const fakeServer = {
      config,
      decorate: mock.fn(),
      decorateRequest: mock.fn(),
      addHook: mock.fn(),
    };
    await sendErrorPlugin(fakeServer);
    expect(initSendError.mock.calls.map((call) => call.arguments)).toEqual([
      [
        {
          dsn: 'testDsn',
          enableProfiling: undefined,
          environment: 'testEnv',
          release: 'testVersion',
        },
      ],
    ]);
    expect(
      fakeServer.decorate.mock.calls.map((call) => call.arguments)
    ).toEqual([
      ['sendError', 'sendErrorFn'],
      ['startProfiling', 'startProfilingFn'],
      ['finishProfiling', 'finishProfilingFn'],
    ]);
    expect(
      fakeServer.decorateRequest.mock.calls.map((call) => call.arguments)
    ).toEqual([
      ['sendError', null],
      ['profilingContext', null],
    ]);
    expect(fakeServer.addHook.mock.calls.map((call) => call.arguments)).toEqual(
      [
        ['preHandler', expect.any(Function)],
        ['onRequest', expect.any(Function)],
        ['onResponse', expect.any(Function)],
      ]
    );
  });
});
