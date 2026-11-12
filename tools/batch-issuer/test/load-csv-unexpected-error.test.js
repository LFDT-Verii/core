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

const { describe, it, mock } = require('node:test');
const { expect } = require('expect');
const { CsvError } = require('csv-parse/sync');
const { fixturePath } = require('./helpers/fixtures');

mock.module('csv-parse/sync', {
  namedExports: {
    CsvError,
    parse: () => {
      throw new TypeError('unexpected');
    },
  },
});

const { loadCsv } = require('../src/csv/load-csv');

describe('loadCsv with an unexpected parser error', () => {
  it('rejects with the error rather than reporting a row', async () => {
    await expect(loadCsv(fixturePath('holders.csv'))).rejects.toThrow(
      new TypeError('unexpected'),
    );
  });
});
