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

const { it } = require('node:test');
const { expect } = require('expect');
const { get, set } = require('lodash/fp');
const { loggerProvider } = require('@verii/logger');
const { loadTestEnv } = require('@verii/tests-helpers');

loadTestEnv();
const { config } = require('../src/config');

it('censors credential agent log fields', () => {
  const paths = [
    'body.deepLink',
    'body.exchange.identityMatcherValues',
    'body.exchange.pushDelegate.pushToken',
    'body.exchange.vendorUserId',
    'body.feed.preauthCode',
    'body.feeds[*].preauthCode',
    'body.identityMatcherValues',
    'body.jwt_vp',
    'body.preauthCode',
    'body.pushData.pushDelegate.pushToken',
    'body.push_delegate.push_token',
    'body.rawCredentials[*].rawCredential',
    'body.vp',
    'body.vp_jwt',
    'err.exchange.events',
    'err.exchange.identityMatcherValues',
    'err.exchange.pushDelegate.pushToken',
    'err.exchange.vendorUserId',
  ];
  // A path with [*] is checked on the first array element.
  const samplePath = (path) => path.replace('[*]', '[0]');
  const sample = 'fixture-value-to-censor';
  const payload = paths.reduce(
    (obj, path) => set(samplePath(path), sample, obj),
    {},
  );
  const entries = [];
  const log = loggerProvider({
    ...config,
    logSeverity: 'debug',
    destination: { write: (entry) => entries.push(entry) },
  });

  log.debug(payload);

  const [output] = entries;
  const entry = JSON.parse(output);
  expect(
    Object.fromEntries(
      paths.map((path) => [path, get(samplePath(path), entry)]),
    ),
  ).toEqual(Object.fromEntries(paths.map((path) => [path, '...shhh...'])));
  expect(output).not.toContain(sample);
});
