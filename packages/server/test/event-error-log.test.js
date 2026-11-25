/**
 * Copyright 2025 Velocity Team
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
const { it } = require('node:test');
const { expect } = require('expect');
const { omit } = require('lodash/fp');
const pinoTest = require('pino-test');
const { publish, subscribe } = require('@spencejs/spence-events');
const { loggerProvider } = require('@verii/logger');

const { buildMongoConnection, loadTestEnv } = require('@verii/tests-helpers');

loadTestEnv();
const { genericConfig } = require('@verii/config');
const { commonCreateServer } = require('../src/common-create-server');

it('logs only event identifiers and the subscriber error', async (t) => {
  const entries = [];
  const destination = pinoTest.sink();
  destination.on('data', (entry) => entries.push(entry));
  const config = {
    ...genericConfig,
    mongoConnection: buildMongoConnection('credentialagent'),
    logSeverity: 'error',
  };
  const server = commonCreateServer(
    config,
    loggerProvider({ ...config, destination }),
  );
  t.after(() => server.close());

  let eventId;
  subscribe('log-test', 'failing-event', async (event) => {
    eventId = event.meta.id;
    throw new Error('subscriber failure');
  });
  await publish('log-test', 'failing-event', { note: 'fixture' }, {});

  expect(entries.map(omit(['level', 'time', 'pid', 'hostname']))).toEqual([
    {
      msg: 'Error Context',
      eventId,
      topic: 'log-test',
      eventName: 'failing-event',
    },
    expect.objectContaining({ msg: 'subscriber failure' }),
  ]);
});
