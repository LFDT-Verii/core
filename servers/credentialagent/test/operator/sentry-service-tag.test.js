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
const { EventEmitter, once } = require('node:events');
const { createServer } = require('node:http');
const { buffer } = require('node:stream/consumers');
const { gunzipSync } = require('node:zlib');
const { expect } = require('expect');

const packageJson = require('../../package.json');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');

// Stands in for Sentry's ingest endpoint and emits each error event the SDK sends it, keyed by the error message
const startSentryIngest = async () => {
  const received = new EventEmitter();
  const server = createServer(async (req, res) => {
    const body = await buffer(req);
    const envelope =
      req.headers['content-encoding'] === 'gzip' ? gunzipSync(body) : body;
    // An envelope is a header line, then a header line and a payload line for each item
    const [, ...lines] = envelope.toString().split('\n').filter(Boolean);
    for (let i = 0; i < lines.length; i += 2) {
      if (JSON.parse(lines[i]).type === 'event') {
        const event = JSON.parse(lines[i + 1]);
        received.emit(event.exception.values[0].value, event);
      }
    }
    res.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  return {
    dsn: `http://public@127.0.0.1:${server.address().port}/1`,
    // Start waiting before raising the error, the SDK sends events asynchronously
    waitForError: async (message) => {
      const [event] = await once(received, message, {
        signal: AbortSignal.timeout(5000),
      });
      return event;
    },
    close: () => {
      server.close();
      return once(server, 'close');
    },
  };
};

describe('Sentry service tag', () => {
  let sentryIngest;
  let fastify;
  let serverUrl;

  before(async () => {
    sentryIngest = await startSentryIngest();
    fastify = buildFastify({ sentryDsn: sentryIngest.dsn });
    fastify.get('/sentry-test-error', async () => {
      throw new Error('route failed');
    });
    serverUrl = await fastify.listen({ port: 0, host: '127.0.0.1' });
  });

  after(async () => {
    await fastify.close();
    await sentryIngest.close();
  });

  it('should tag an error returned from a route with the server package name', async () => {
    const reported = sentryIngest.waitForError('route failed');

    const response = await fetch(`${serverUrl}/sentry-test-error`);

    expect(response.status).toEqual(500);
    expect((await reported).tags).toEqual({ service: packageJson.name });
  });

  it('should tag an error sent outside a request with the server package name', async () => {
    const reported = sentryIngest.waitForError('background job failed');

    fastify.sendError(new Error('background job failed'));

    expect((await reported).tags).toEqual({ service: packageJson.name });
  });
});
