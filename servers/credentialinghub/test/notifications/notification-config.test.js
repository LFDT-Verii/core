/*
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
 *
 */

const path = require('node:path');
const { beforeEach, describe, it } = require('node:test');
const { loadTestEnv } = require('@verii/tests-helpers');
const { expect } = require('expect');

const TEST_ENV_PATH = path.resolve(__dirname, '../helpers/.env.test');
const CONFIG_MODULE_PATH = '../../src/config/config';
const originalEnv = { ...process.env };

describe('notification config env validation', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    loadTestEnv(TEST_ENV_PATH);
    delete require.cache[require.resolve(CONFIG_MODULE_PATH)];
  });

  it('should reject insecure webhook URLs when notifications are enabled', () => {
    expect(() =>
      loadConfig({
        NOTIFICATIONS_ENABLED: 'true',
        NOTIFICATIONS_WEBHOOK_SECRET: 'secret',
        NOTIFICATIONS_WEBHOOK_URL: 'http://operator.localhost.test/events',
      }),
    ).toThrow('"NOTIFICATIONS_WEBHOOK_URL" must use https');
  });

  it('should reject webhook URLs with credentials when notifications are enabled', () => {
    expect(() =>
      loadConfig({
        NOTIFICATIONS_ENABLED: 'true',
        NOTIFICATIONS_WEBHOOK_SECRET: 'secret',
        NOTIFICATIONS_WEBHOOK_URL:
          'https://username:password@operator.localhost.test/events',
      }),
    ).toThrow('"NOTIFICATIONS_WEBHOOK_URL" must not include credentials');
  });

  it('should reject invalid worker modes through env parsing', () => {
    expect(() =>
      loadConfig({
        NOTIFICATIONS_WORKER_MODE: 'in-process',
      }),
    ).toThrow('"NOTIFICATIONS_WORKER_MODE" should be one of');
  });

  it('should reject invalid queue types through env parsing', () => {
    expect(() =>
      loadConfig({
        NOTIFICATIONS_QUEUE_TYPE: 'rabbit',
      }),
    ).toThrow('"NOTIFICATIONS_QUEUE_TYPE" should be one of');
  });

  it('should require webhook secrets when notifications are enabled', () => {
    expect(() =>
      loadConfig({
        NOTIFICATIONS_ENABLED: 'true',
        NOTIFICATIONS_WEBHOOK_URL: 'https://operator.localhost.test/events',
      }),
    ).toThrow('"NOTIFICATIONS_WEBHOOK_SECRET"');
  });

  it('should ignore invalid webhook URLs when notifications are disabled', () => {
    expect(
      loadConfig({
        NOTIFICATIONS_ENABLED: 'false',
        NOTIFICATIONS_WEBHOOK_URL: 'not a url',
      }).notifications,
    ).toEqual(
      expect.objectContaining({
        enabled: false,
        webhook: expect.objectContaining({
          url: 'not a url',
        }),
      }),
    );
  });
});

const loadConfig = (envOverrides) => {
  Object.assign(process.env, envOverrides);
  delete require.cache[require.resolve(CONFIG_MODULE_PATH)];
  return require(CONFIG_MODULE_PATH);
};
