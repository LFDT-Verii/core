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

const { describe, it } = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { expect } = require('expect');

const configPath = path.resolve(__dirname, '../src/config.js');

// The variables genericConfig requires outside tests
const productionEnv = {
  PATH: process.env.PATH,
  NODE_ENV: 'production',
  PORT: '3000',
  HOST: '0.0.0.0',
  HOST_URL: 'https://server.example.com',
  MONGO_URI: 'mongodb://localhost:27017/example',
  SECRET: 'example-secret',
  ROOT_PUBLIC_KEY: 'example-root-public-key',
};

// genericConfig reads the environment when it's first required, so load it in a fresh process
const loadSentrySettings = (env) => {
  const script = `const { sentryDsn, enableSentryDebug } = require(${JSON.stringify(configPath)});
process.stdout.write(JSON.stringify({ sentryDsn, enableSentryDebug }));`;
  return JSON.parse(execFileSync(process.execPath, ['-e', script], { env }));
};

describe('genericConfig Sentry settings', () => {
  it('should load outside tests without SENTRY_DSN, with Sentry off', () => {
    expect(loadSentrySettings(productionEnv)).toEqual({
      sentryDsn: '',
      enableSentryDebug: false,
    });
  });

  it('should read SENTRY_DSN and ENABLE_SENTRY_DEBUG', () => {
    expect(
      loadSentrySettings({
        ...productionEnv,
        SENTRY_DSN: 'https://public@sentry.example.com/1',
        ENABLE_SENTRY_DEBUG: 'true',
      }),
    ).toEqual({
      sentryDsn: 'https://public@sentry.example.com/1',
      enableSentryDebug: true,
    });
  });
});
