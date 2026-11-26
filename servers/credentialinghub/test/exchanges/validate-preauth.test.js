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

const { throws } = require('node:assert/strict');
const { it, mock } = require('node:test');
const { expect } = require('expect');
const { calcSha384 } = require('@verii/crypto');
const {
  validatePreauth,
} = require('../../src/entities/exchanges/domain/validate-preauth');

it('logs the depot ID and presented code hash on preauth rejection', () => {
  const preauthCode = 'presented-code-fixture';
  const depot = { _id: 'depot-id', preauthCodeHash: calcSha384('other-code') };
  const log = { error: mock.fn() };

  throws(() => validatePreauth(preauthCode, depot, { log }), {
    statusCode: 401,
  });

  expect(log.error.mock.calls.map(({ arguments: args }) => args)).toEqual([
    [
      { depotId: depot._id, preauthCodeHash: calcSha384(preauthCode) },
      'Preauth failed',
    ],
  ]);
});
