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
const { describe, it } = require('node:test');
const { expect } = require('expect');
const { loadTestEnv } = require('@verii/tests-helpers');
const {
  operatorApiAjvFormats,
  operatorApiAjvOptions,
} = require('@verii/credentialing-hub-operator-api');

loadTestEnv(path.resolve(__dirname, '../helpers/.env.test'));
const { buildConfig } = require('../../src/config');

// Clients validate operator API requests with the package's validator, so it
// has to use the AJV options and formats the Hub validates requests with.
describe('operator API validator options', () => {
  const config = buildConfig();

  it('should be the AJV options the Hub uses', () => {
    expect(operatorApiAjvOptions).toEqual(config.ajvOptions);
  });

  it('should be the AJV formats the Hub uses', () => {
    expect(operatorApiAjvFormats).toEqual(config.ajvFormats);
  });
});
