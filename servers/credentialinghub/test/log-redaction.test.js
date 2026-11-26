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

const { resolve } = require('node:path');
const { it } = require('node:test');
const { expect } = require('expect');
const { get, set } = require('lodash/fp');
const { loggerProvider } = require('@verii/logger');
const { buildMongoConnection, loadTestEnv } = require('@verii/tests-helpers');

loadTestEnv(resolve(__dirname, 'helpers/.env.test'));
const { buildConfig } = require('../src/config');
const { createAppServer } = require('../src');

it('censors credentialing hub log fields', () => {
  const paths = [
    'body.jwt_vp',
    'body.openidCredentialOffer',
    'body.preauthCode',
    'body.push_delegate.push_token',
    'body.redirectUrl',
    'body.vnProtocolLink',
    'body.vp_jwt',
    'err.exchange.events',
    'err.exchange.messagingSettings.authToken',
    'preauthCode',
  ];
  const sample = 'fixture-value-to-censor';
  const payload = paths.reduce((obj, path) => set(path, sample, obj), {});
  const entries = [];
  const log = loggerProvider({
    ...buildConfig(),
    logSeverity: 'debug',
    destination: { write: (entry) => entries.push(entry) },
  });

  log.debug(payload);

  const [output] = entries;
  const entry = JSON.parse(output);
  expect(
    Object.fromEntries(paths.map((path) => [path, get(path, entry)])),
  ).toEqual(Object.fromEntries(paths.map((path) => [path, '...shhh...'])));
  expect(output).not.toContain(sample);
});

it('keeps the hub redaction paths when an embedder adds a path', async (t) => {
  const extraPath = 'body.fixtureSecret';
  const server = createAppServer({
    configOverrides: {
      logSeverity: 'silent',
      logRedactPaths: [extraPath],
      mongoConnection: buildMongoConnection(
        'test-credentialing-hub-log-redaction',
      ),
    },
  });
  t.after(() => server.close());
  await server.ready();

  expect(server.config.logRedactPaths).toEqual([
    ...buildConfig().logRedactPaths,
    extraPath,
  ]);
});
