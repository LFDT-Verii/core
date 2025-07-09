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

const { initSendError } = require('@verii/error-aggregation');
const { sendErrorPlugin } = require('../src/send-error-plugin');

jest.mock('@verii/error-aggregation', () => {
  const originalModule = jest.requireActual('@verii/error-aggregation');
  return {
    ...originalModule,
    initSendError: jest.fn().mockReturnValue({
      sendError: 'sendErrorFn',
      startProfiling: 'startProfilingFn',
      finishProfiling: 'finishProfilingFn',
    }),
  };
});

describe('Capture Exception to Sentry plugin tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sendErrorPlugin', async () => {
    const config = {
      sentryDsn: 'testDsn',
      nodeEnv: 'testEnv',
      version: 'testVersion',
    };
    const fakeServer = {
      config,
      decorate: jest.fn(),
      decorateRequest: jest.fn(),
      addHook: jest.fn(),
    };
    await sendErrorPlugin(fakeServer);
    expect(initSendError.mock.calls).toEqual([
      [
        {
          dsn: 'testDsn',
          enableProfiling: undefined,
          environment: 'testEnv',
          release: 'testVersion',
        },
      ],
    ]);
    expect(fakeServer.decorate.mock.calls).toEqual([
      ['sendError', 'sendErrorFn'],
      ['startProfiling', 'startProfilingFn'],
      ['finishProfiling', 'finishProfilingFn'],
    ]);
    expect(fakeServer.decorateRequest.mock.calls).toEqual([
      ['sendError', null],
      ['profilingContext', null],
    ]);
    expect(fakeServer.addHook.mock.calls).toEqual([
      ['preHandler', expect.any(Function)],
      ['onRequest', expect.any(Function)],
      ['onResponse', expect.any(Function)],
    ]);
  });
});
