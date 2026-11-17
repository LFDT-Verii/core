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

const { randomUUID } = require('node:crypto');
const { env } = require('node:process');
const { initHttpClient } = require('@verii/http-client');
const { noop } = require('lodash/fp');

// The HTTP client logs each request with its headers, which hold the operator
// token, so it gets a log that drops everything.
const silentLog = { info: noop, warn: noop, error: noop, debug: noop };

/**
 * Builds an HTTP client for one base URL, as data-loader does.
 * NODE_TLS_REJECT_UNAUTHORIZED=0 turns off TLS verification.
 * @param {{ prefixUrl: string, bearerToken?: string }} options
 * @returns {{ get: Function, post: Function }} the client
 */
const initClient = ({ prefixUrl, bearerToken }) =>
  initHttpClient({
    prefixUrl,
    bearerToken,
    isTest: env.NODE_ENV === 'test',
    tlsRejectUnauthorized: env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
  })({ log: silentLog, traceId: randomUUID() });

module.exports = { initClient };
