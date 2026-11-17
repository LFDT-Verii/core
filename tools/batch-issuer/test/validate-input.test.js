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
const { mockServices, useNock } = require('./helpers/mock-services');
const { validate, validateJson } = require('./helpers/run-cli');
const {
  ADAM,
  BETH,
  HEADER,
  TEMPLATE,
  baseSpec,
  depotOnlySpec,
  loadJsonFixture,
  useTempFiles,
} = require('./helpers/fixtures');

const NOT_IN_CSV = 'is used by the spec, but the CSV has no such column';

const withCredential = (credential) => ({
  ...baseSpec,
  credentials: [{ ...baseSpec.credentials[0], ...credential }],
});

// The problems in these tables stop validation before the Hub is called, so
// nothing is mocked: a Hub request would fail with exit code 2.
describe('batch-issuer validate: the spec, templates and CSV', () => {
  useNock();
  const { writeBatch } = useTempFiles();

  describe('a spec with errors', () => {
    const depotOnlyError = {
      reason:
        'a spec without credentials loads depots only, so it needs depot.deferredCredentials: true',
    };
    const specErrors = [
      {
        name: 'YAML that does not parse',
        spec: 'tenantId: [unclosed',
        errors: [
          { reason: expect.stringMatching(/^the spec is not valid YAML: /) },
        ],
      },
      {
        name: 'a spec that is not an object',
        spec: '',
        errors: [{ reason: 'spec must be object' }],
      },
      {
        name: 'schema errors, each with its path',
        spec: {
          serviceId: '',
          depot: { authValues: [{ col: 'email' }], deferredCredentials: 'no' },
          columns: { year: 'date' },
          credentials: [{ tags: [1] }],
          extra: true,
        },
        errors: [
          { reason: "spec must have required property 'tenantId'" },
          { reason: 'spec must NOT have additional properties: extra' },
          { reason: 'spec.serviceId must NOT have fewer than 1 characters' },
          { reason: "spec.depot must have required property 'userReference'" },
          {
            reason:
              "spec.depot.authValues.0 must have required property 'column'",
          },
          {
            reason:
              'spec.depot.authValues.0 must NOT have additional properties: col',
          },
          { reason: 'spec.depot.deferredCredentials must be boolean' },
          {
            reason:
              'spec.columns.year must be equal to one of the allowed values: string, number, boolean',
          },
          {
            reason: "spec.credentials.0 must have required property 'template'",
          },
          {
            reason:
              "spec.credentials.0 must have required property 'credentialReference'",
          },
          { reason: 'spec.credentials.0.tags.0 must be string' },
        ],
      },
      {
        name: 'a depot-only spec whose depots do not defer credentials',
        spec: {
          ...depotOnlySpec,
          depot: { ...depotOnlySpec.depot, deferredCredentials: false },
        },
        errors: [depotOnlyError],
      },
      {
        name: 'a depot-only spec that does not say whether depots defer credentials',
        spec: {
          ...depotOnlySpec,
          depot: { ...depotOnlySpec.depot, deferredCredentials: undefined },
        },
        errors: [depotOnlyError],
      },
    ];

    for (const { name, spec, errors } of specErrors) {
      it(name, async () => {
        const { exitCode, report, stderr } = await validateJson(
          writeBatch({ spec, csvLines: [ADAM] }),
        );

        expect({ exitCode, report, stderr }).toEqual({
          exitCode: 1,
          report: { valid: false, errors },
          stderr: '',
        });
      });
    }
  });

  describe('a template file with problems', () => {
    const templateErrors = [
      {
        name: 'a missing file',
        credential: { template: './missing.json' },
        reason: expect.stringMatching(
          /^template \.\/missing\.json can't be read: ENOENT: no such file or directory/,
        ),
      },
      {
        name: 'a file that is not JSON',
        content: '{ "type": ',
        reason: expect.stringMatching(
          /^template \.\/badge\.json is not valid JSON: /,
        ),
      },
      {
        name: 'JSON that is not an object',
        content: '["OpenBadgeCredential"]',
        reason: 'template ./badge.json is not a JSON object',
      },
      {
        name: 'a template without a credential type',
        content: { type: ['VerifiableCredential'], credentialSubject: {} },
        reason: 'template ./badge.json has no credential type',
      },
      {
        name: 'a type that is a Handlebars template',
        content: { type: ['{{type}}'], credentialSubject: {} },
        reason:
          "template ./badge.json's type must not be a Handlebars template",
      },
    ];

    for (const {
      name,
      credential = { template: './badge.json' },
      content,
      reason,
    } of templateErrors) {
      it(name, async () => {
        const templates = content == null ? {} : { 'badge.json': content };
        const batch = writeBatch({
          spec: withCredential(credential),
          csvLines: [ADAM],
          templates,
        });

        const { exitCode, report } = await validateJson(batch);

        expect({ exitCode, report }).toEqual({
          exitCode: 1,
          report: { valid: false, errors: [{ reason }] },
        });
      });
    }
  });

  it('reports Handlebars syntax errors in the spec and the templates', async () => {
    const spec = {
      ...withCredential({ tags: ['{{#if x}}'] }),
      depot: { ...baseSpec.depot, userReference: '{{employeeId' },
    };
    const badge = loadJsonFixture('open-badge.template.json');
    const template = {
      ...badge,
      credentialSubject: { ...badge.credentialSubject, type: '{{type}' },
    };
    const batch = writeBatch({
      spec,
      csvLines: [ADAM],
      templates: { 'open-badge.template.json': template },
    });

    const result = await validate(batch);

    expect(result).toEqual({
      exitCode: 1,
      stdout: [
        'Batch:',
        '  - the spec has a template error: Parse error on line 1:',
        '      {{employeeId',
        '      --^',
        "      Expecting 'ID', 'STRING', 'NUMBER', 'BOOLEAN', 'UNDEFINED', 'NULL', 'DATA', got 'INVALID'",
        '  - the spec has a template error: Parse error on line 1:',
        '      {{#if x}}',
        '      ---------^',
        "      Expecting 'COMMENT', 'CONTENT', 'OPEN_RAW_BLOCK', 'OPEN_BLOCK', 'OPEN_INVERSE', 'OPEN_INVERSE_CHAIN', " +
          "'INVERSE', 'OPEN_ENDBLOCK', 'OPEN', 'OPEN_UNESCAPED', 'OPEN_PARTIAL', 'OPEN_PARTIAL_BLOCK', got 'EOF'",
        `  - template ${TEMPLATE} has a template error: Parse error on line 1:`,
        '      {{type}',
        '      ------^',
        "      Expecting 'CLOSE_RAW_BLOCK', 'CLOSE', 'CLOSE_UNESCAPED', 'OPEN_SEXPR', 'CLOSE_SEXPR', 'ID', " +
          "'OPEN_BLOCK_PARAMS', 'STRING', 'NUMBER', 'BOOLEAN', 'UNDEFINED', 'NULL', 'DATA', 'SEP', got 'INVALID'",
        '',
        'The batch is not valid: 3 errors. Nothing was written to the Hub.',
        '',
      ].join('\n'),
      stderr: '',
    });
  });

  describe('a CSV that does not parse', () => {
    const quoteNotClosed = 'opens a quoted cell that is never closed';
    const parseErrors = [
      {
        name: 'a quote that is never closed',
        csvText:
          'id,email,name\nE1,a@example.com,"Adam\nE2,b@example.com,Beth\n',
        error: { row: 2, reason: quoteNotClosed },
      },
      {
        name: 'a quote that is never closed, after a multi-line cell and a blank line',
        csvText: 'id,note\nE1,"two\nlines"\n\nE2,x\nE3,"open\nE4,y\n',
        error: { row: 5, reason: quoteNotClosed },
      },
      {
        name: 'a quote inside an unquoted cell',
        csvText: 'id,name\nE1,Adam\nE2,Beth "BJ" Jones\n',
        error: {
          row: 3,
          reason: expect.stringMatching(
            /^can't be parsed: Invalid Opening Quote: /,
          ),
        },
      },
      {
        name: 'text after a closing quote',
        csvText: 'id,name\nE1,"Adam" Smith\n',
        error: {
          row: 2,
          reason: expect.stringMatching(
            /^can't be parsed: Invalid Closing Quote: /,
          ),
        },
      },
    ];

    for (const { name, csvText, error } of parseErrors) {
      it(name, async () => {
        const { exitCode, report } = await validateJson(
          writeBatch({ spec: depotOnlySpec, csvText }),
        );

        expect({ exitCode, report }).toEqual({
          exitCode: 1,
          report: { valid: false, errors: [error] },
        });
      });
    }
  });

  it('numbers rows as a spreadsheet does, through a BOM, Windows line endings, blank lines and multi-line cells', async () => {
    mockServices();
    const csvText = [
      `\uFEFF${HEADER}`,
      'E1001,adam@example.com,Adam,"Smith',
      'Jones",1',
      '',
      'E1002,beth@example.com,Beth,Jones,2',
      'E1003,carl@,Carl,Ng,1',
      '',
    ].join('\r\n');

    const { exitCode, report } = await validateJson(writeBatch({ csvText }));

    expect(exitCode).toEqual(1);
    expect(report.errors).toEqual([
      { row: 5, column: 'email', reason: '"carl@" is not an email address' },
    ]);
  });

  describe('a CSV whose structure does not fit the spec', () => {
    const structureErrors = [
      {
        name: 'a header without rows',
        csvText: `${HEADER}\n`,
        errors: [{ reason: 'the CSV has no rows' }],
      },
      {
        name: 'a column in the header twice',
        csvText: `${HEADER},email\nE1001,adam@example.com,Adam,Smith,1.5,adam@example.com\n`,
        errors: [
          { column: 'email', reason: 'is in the header more than once' },
        ],
      },
      {
        name: 'a column the templates use, once rather than for each row',
        spec: withCredential({
          credentialReference: '{{employeeId}}-{{cohort}}',
        }),
        csvLines: [ADAM, BETH],
        errors: [{ column: 'cohort', reason: NOT_IN_CSV }],
      },
      {
        name: 'a row without the userReference column',
        csvText:
          'email,firstName,lastName,creditsEarned,employeeId\nadam@example.com,Adam,Smith,1.5\n',
        errors: [
          { row: 2, column: 'employeeId', reason: 'is missing' },
          {
            row: 2,
            column: 'employeeId',
            reason: 'is missing',
            template: TEMPLATE,
          },
        ],
      },
      {
        name: 'a row with more cells than the header',
        csvLines: [`${ADAM},extra`],
        errors: [
          { row: 2, reason: 'has 6 cells, but the header has 5 columns' },
        ],
      },
      {
        name: 'an auth value column named like an inherited property',
        spec: {
          ...baseSpec,
          depot: { ...baseSpec.depot, authValues: [{ column: 'constructor' }] },
        },
        csvLines: [ADAM],
        errors: [{ column: 'constructor', reason: NOT_IN_CSV }],
      },
    ];

    for (const { name, spec, csvLines, csvText, errors } of structureErrors) {
      it(name, async () => {
        mockServices();

        const { exitCode, report } = await validateJson(
          writeBatch({ spec, csvLines, csvText }),
        );

        expect(exitCode).toEqual(1);
        expect(report.errors).toEqual(errors);
      });
    }
  });
});
