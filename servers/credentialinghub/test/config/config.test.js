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
const { after, beforeEach, describe, it } = require('node:test');
const { loadTestEnv } = require('@verii/tests-helpers');
const { expect } = require('expect');

const TEST_ENV_PATH = path.resolve(__dirname, '../helpers/.env.test');
const CONFIG_MODULE_PATH = '../../src/config/config';
const originalEnv = { ...process.env };

describe('Hub config env validation', () => {
  after(() => {
    process.env = originalEnv;
    delete require.cache[require.resolve(CONFIG_MODULE_PATH)];
  });

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    loadTestEnv(TEST_ENV_PATH);
    delete process.env.OPENID4VCI_NONCE_SECRET;
    delete require.cache[require.resolve(CONFIG_MODULE_PATH)];
  });

  it('should require the OpenID4VCI nonce secret for the HTTP server', () => {
    expect(() => require(CONFIG_MODULE_PATH).buildConfig()).toThrow(
      '"OPENID4VCI_NONCE_SECRET" is a required variable',
    );
  });

  it('should not require the OpenID4VCI nonce secret for processes that serve no HTTP', () => {
    expect(
      require(CONFIG_MODULE_PATH).buildConfig({ servesHttp: false }),
    ).toEqual(expect.objectContaining({ openid4vciNonceSecret: undefined }));
  });
});
