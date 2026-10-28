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

const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const { startSentryIngest } = require('@verii/tests-helpers');

const packageJson = require('../package.json');

describe('Sentry reporting', () => {
  let sentryIngest;
  let fastify;
  let serverUrl;

  before(async () => {
    sentryIngest = await startSentryIngest();
    // The Hub reads SENTRY_DSN when its config loads, so set it before loading the server
    process.env.SENTRY_DSN = sentryIngest.dsn;
    const createTestFastify = require('./helpers/create-test-fastify');
    fastify = createTestFastify();
    fastify.get('/sentry-test-error', async () => {
      throw new Error('route failed');
    });
    serverUrl = await fastify.listen({ port: 0, host: '127.0.0.1' });
  });

  after(async () => {
    await fastify.close();
    await sentryIngest.close();
    delete process.env.SENTRY_DSN;
  });

  it('should report a route error with the Hub package name when SENTRY_DSN is set', async () => {
    const reported = sentryIngest.waitForError('route failed');

    const response = await fetch(`${serverUrl}/sentry-test-error`);

    expect(response.status).toEqual(500);
    expect((await reported).tags).toEqual({ service: packageJson.name });
  });
});
