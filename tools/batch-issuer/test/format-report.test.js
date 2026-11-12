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
const { expect } = require('expect');
const {
  formatJsonReport,
  formatTextReport,
} = require('../src/report/format-report');

const errors = [
  { row: 10, column: 'email', reason: 'is blank' },
  { reason: 'the registrar has no credential type BadgeV1.0' },
  {
    row: 2,
    template: './badge.json',
    reason: 'credentialSubject must be object',
  },
  {
    column: 'cohort',
    reason: 'is used by the spec, but the CSV has no such column',
  },
  { row: 2, column: 'email', reason: 'is blank' },
  { reason: 'the spec has a template error: Parse error on line 1:\n{{x\n--^' },
];

describe('formatTextReport', () => {
  it('prints the batch errors first, then each row in order', () => {
    expect(formatTextReport({ errors })).toEqual(
      [
        'Batch:',
        '  - the registrar has no credential type BadgeV1.0',
        '  - cohort: is used by the spec, but the CSV has no such column',
        '  - the spec has a template error: Parse error on line 1:',
        '      {{x',
        '      --^',
        '',
        'Row 2:',
        '  - credentialSubject must be object (template ./badge.json)',
        '  - email: is blank',
        '',
        'Row 10:',
        '  - email: is blank',
        '',
        'The batch is not valid: 6 errors. Nothing was written to the Hub.',
        '',
      ].join('\n'),
    );
  });

  it('counts one error', () => {
    expect(formatTextReport({ errors: [errors[1]] })).toContain(
      'The batch is not valid: 1 error.',
    );
  });

  it('summarizes a valid batch', () => {
    const summary = {
      rows: 1,
      newDepots: 0,
      existingDepots: 1,
      credentials: 2,
    };
    expect(formatTextReport({ errors: [], summary })).toEqual(
      'The batch is valid: 1 row, 0 new depots, 1 existing depot, 2 credentials. Nothing was written to the Hub.\n',
    );
  });
});

describe('formatJsonReport', () => {
  it('orders the errors as the text report does', () => {
    expect(JSON.parse(formatJsonReport({ errors }))).toEqual({
      valid: false,
      errors: [
        errors[1],
        errors[3],
        errors[5],
        errors[2],
        errors[4],
        errors[0],
      ],
    });
  });
});
