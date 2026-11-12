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
  MONGO_URI: 'mongodb://localhost:27017/example',
  SECRET: 'example-secret',
};

// genericConfig reads the environment when it's first required, so load it in a fresh process
const loadConfig = (env, keys) => {
  const script = `const { pick } = require('lodash/fp');
const config = require(${JSON.stringify(configPath)});
process.stdout.write(JSON.stringify(pick(${JSON.stringify(keys)}, config)));`;
  return JSON.parse(
    execFileSync(process.execPath, ['-e', script], {
      env,
      cwd: path.resolve(__dirname, '..'),
    }),
  );
};

describe('genericConfig server settings', () => {
  const serverKeys = ['appPort', 'appHost'];

  it('should default PORT and HOST', () => {
    expect(loadConfig(productionEnv, serverKeys)).toEqual({
      appPort: 3000,
      appHost: '0.0.0.0',
    });
  });

  it('should read PORT and HOST', () => {
    expect(
      loadConfig(
        { ...productionEnv, PORT: '3005', HOST: '127.0.0.1' },
        serverKeys,
      ),
    ).toEqual({
      appPort: 3005,
      appHost: '127.0.0.1',
    });
  });
});

describe('genericConfig Sentry settings', () => {
  const sentryKeys = ['sentryDsn', 'enableSentryDebug'];

  it('should load outside tests without SENTRY_DSN, with Sentry off', () => {
    expect(loadConfig(productionEnv, sentryKeys)).toEqual({
      sentryDsn: '',
      enableSentryDebug: false,
    });
  });

  it('should read SENTRY_DSN and ENABLE_SENTRY_DEBUG', () => {
    expect(
      loadConfig(
        {
          ...productionEnv,
          SENTRY_DSN: 'https://public@sentry.example.com/1',
          ENABLE_SENTRY_DEBUG: 'true',
        },
        sentryKeys,
      ),
    ).toEqual({
      sentryDsn: 'https://public@sentry.example.com/1',
      enableSentryDebug: true,
    });
  });
});

describe('genericConfig environment label', () => {
  const labelKeys = ['environmentLabel', 'nodeEnv'];

  it('should default ENVIRONMENT_LABEL to NODE_ENV', () => {
    expect(
      loadConfig({ ...productionEnv, NODE_ENV: 'staging' }, labelKeys),
    ).toEqual({
      environmentLabel: 'staging',
      nodeEnv: 'staging',
    });
  });

  it('should read ENVIRONMENT_LABEL', () => {
    expect(
      loadConfig({ ...productionEnv, ENVIRONMENT_LABEL: 'testnet' }, labelKeys),
    ).toEqual({
      environmentLabel: 'testnet',
      nodeEnv: 'production',
    });
  });
});
