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

const { EventEmitter, once } = require('node:events');
const { createServer } = require('node:http');
const { buffer } = require('node:stream/consumers');
const { gunzipSync } = require('node:zlib');

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

module.exports = { startSentryIngest };
