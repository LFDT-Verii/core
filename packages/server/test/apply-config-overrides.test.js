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
 *
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');
const { applyConfigOverrides } = require('../index');

describe('applyConfigOverrides', () => {
  const config = { logSeverity: 'info', logRedactPaths: ['body.serverSecret'] };
  const expectedWithOverrides = {
    logSeverity: 'debug',
    logRedactPaths: ['body.serverSecret', 'body.embedderSecret'],
  };
  const cases = [
    [
      'embedder overrides',
      { logSeverity: 'debug', logRedactPaths: ['body.embedderSecret'] },
      expectedWithOverrides,
    ],
    ['undefined overrides', undefined, config],
    ['null overrides', null, config],
  ];

  for (const [name, overrides, expected] of cases) {
    it(`applies ${name}`, () => {
      expect(applyConfigOverrides(config, overrides)).toEqual(expected);
    });
  }
});
