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
const Fastify = require('fastify');

const initSendError = mock.fn(() =>
  Promise.resolve({
    sendError: 'sendErrorFn',
  }),
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
      serviceName: 'testService',
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
          environment: 'testEnv',
          release: 'testVersion',
          serviceName: 'testService',
        },
      ],
    ]);
    expect(
      fakeServer.decorate.mock.calls.map((call) => call.arguments),
    ).toEqual([['sendError', 'sendErrorFn']]);
    expect(
      fakeServer.decorateRequest.mock.calls.map((call) => call.arguments),
    ).toEqual([['sendError', null]]);
    expect(fakeServer.addHook.mock.calls.map((call) => call.arguments)).toEqual(
      [['preHandler', expect.any(Function)]],
    );
  });
});

describe('Sentry reporting is off log', () => {
  const sentryOffMessage = 'Sentry reporting is off: SENTRY_DSN is not set';

  // Registers the plugin on a real server and returns the log lines it wrote
  const registerPlugin = async (config) => {
    const lines = [];
    const server = Fastify({
      logger: {
        level: 'info',
        stream: { write: (line) => lines.push(JSON.parse(line)) },
      },
    });
    server.decorate('config', config);
    await server.register(sendErrorPlugin).ready();
    await server.close();
    return lines.filter(({ msg }) => msg === sentryOffMessage);
  };

  it('should log once when a server outside tests has no DSN', async () => {
    const lines = await registerPlugin({ sentryDsn: '', isTest: false });

    expect(lines).toEqual([expect.objectContaining({ level: 30 })]);
  });

  it('should not log when the server has a DSN', async () => {
    expect(
      await registerPlugin({ sentryDsn: 'testDsn', isTest: false }),
    ).toEqual([]);
  });

  it('should not log in tests', async () => {
    expect(await registerPlugin({ sentryDsn: '', isTest: true })).toEqual([]);
  });
});
