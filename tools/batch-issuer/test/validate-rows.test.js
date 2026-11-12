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
  mockFindDepots,
  mockGetService,
  mockServices,
  useNock,
} = require('./helpers/mock-services');
const { validate, validateJson } = require('./helpers/run-cli');
const {
  ADAM,
  BETH,
  TEMPLATE,
  baseSpec,
  buildService,
  depotOnlySpec,
  emailRule,
  loadJsonFixture,
  phoneRule,
  useTempFiles,
} = require('./helpers/fixtures');

const VALID = 'The batch is valid';

const withCredential = (credential) => ({
  ...baseSpec,
  credentials: [{ ...baseSpec.credentials[0], ...credential }],
});

const badgeWithSubject = (subject) => {
  const badge = loadJsonFixture('open-badge.template.json');
  return {
    ...badge,
    credentialSubject: { ...badge.credentialSubject, ...subject },
  };
};

describe('batch-issuer validate: each row against the spec', () => {
  useNock();
  const { writeBatch } = useTempFiles();

  it("doesn't check a block helper's parameter, so #if makes a column optional", async () => {
    mockServices();
    const badge = loadJsonFixture('open-badge.template.json');
    const achievement = {
      ...badge.credentialSubject.achievement,
      description:
        'Awarded to {{firstName}}{{#if middleName}} {{middleName}}{{/if}} {{lastName}}',
    };
    const templates = {
      'open-badge.template.json': badgeWithSubject({ achievement }),
    };

    const result = await validate(
      writeBatch({ csvLines: [ADAM, BETH], templates }),
    );

    expect(result).toEqual({
      exitCode: 0,
      stdout: `${VALID}: 2 rows, 2 new depots, 0 existing depots, 2 credentials. Nothing was written to the Hub.\n`,
      stderr: '',
    });
  });

  describe("what the Hub's schemas refuse", () => {
    const schemaCases = [
      {
        name: 'a userReference longer than 64 characters',
        spec: withCredential({ credentialReference: 'ivie-{{firstName}}' }),
        csvLines: [`E${'1'.repeat(64)},adam@example.com,Adam,Smith,1`],
        errors: [
          {
            row: 2,
            reason: 'depot/userReference must NOT have more than 64 characters',
          },
        ],
      },
      {
        name: 'a template whose type is a string',
        templates: {
          'open-badge.template.json': {
            ...loadJsonFixture('open-badge.template.json'),
            type: 'OpenBadgeCredential',
          },
        },
        csvLines: [ADAM],
        errors: [
          {
            row: 2,
            reason: 'credential/content/type must be array',
            template: TEMPLATE,
          },
        ],
      },
      {
        name: 'nothing for a typed userReference column, because references render as strings',
        spec: {
          ...baseSpec,
          columns: { ...baseSpec.columns, employeeId: 'number' },
        },
        csvLines: ['1001,adam@example.com,Adam,Smith,1.5'],
        errors: [],
      },
    ];

    for (const { name, spec, templates, csvLines, errors } of schemaCases) {
      it(name, async () => {
        mockServices();

        const { report } = await validateJson(
          writeBatch({ spec, templates, csvLines }),
        );

        expect(report.errors).toEqual(errors);
      });
    }
  });

  it('reports a credentialReference that two rows share', async () => {
    mockServices();
    const spec = withCredential({ credentialReference: '{{lastName}}-ivie' });
    const csvLines = [ADAM, 'E1002,beth@example.com,Beth,Smith,2'];

    const { exitCode, report } = await validateJson(
      writeBatch({ spec, csvLines }),
    );

    const reason =
      'credentialReference "Smith-ivie" is used 2 times in the batch, in 2 rows: 2, 3';
    expect(exitCode).toEqual(1);
    expect(report.errors).toEqual([
      { row: 2, template: TEMPLATE, reason },
      { row: 3, template: TEMPLATE, reason },
    ]);
  });

  describe('duplicate auth values', () => {
    it('compares them as the Hub matches them', async () => {
      mockServices();
      const csvLines = [
        'E1,adam@example.com,A,B,1',
        'E2, ADAM@example.com ,C,D,1',
        'E3,beth@example.com,E,F,1',
        'E4,Adam@Example.com,G,H,1',
      ];

      const { report } = await validateJson(writeBatch({ csvLines }));

      expect(report.errors).toEqual([
        {
          row: 2,
          column: 'email',
          reason: 'has the same auth values as 2 other rows: 3, 5',
        },
        {
          row: 3,
          column: 'email',
          reason: 'has the same auth values as 2 other rows: 2, 5',
        },
        {
          row: 5,
          column: 'email',
          reason: 'has the same auth values as 2 other rows: 2, 3',
        },
      ]);
    });

    it('counts the other rows of a large group and lists at most 10', async () => {
      const groupSize = 5000;
      mockGetService();
      mockFindDepots();
      const csvLines = Array.from(
        { length: groupSize },
        (value, index) => `E${index},same@example.com`,
      );
      const batch = writeBatch({
        spec: depotOnlySpec,
        csvText: `employeeId,email\n${csvLines.join('\n')}\n`,
      });

      const { report } = await validateJson(batch);

      expect(report.errors).toHaveLength(groupSize);
      expect(report.errors[0]).toEqual({
        row: 2,
        column: 'email',
        reason:
          'has the same auth values as 4,999 other rows: 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 and 4,989 more',
      });
      expect(report.errors[5].reason).toEqual(
        'has the same auth values as 4,999 other rows: 2, 3, 4, 5, 6, 8, 9, 10, 11, 12 and 4,989 more',
      );
      const longestReason = Math.max(
        ...report.errors.map(({ reason }) => reason.length),
      );
      expect(longestReason).toBeLessThanOrEqual(100);
    });
  });

  describe('phone numbers', () => {
    const phoneService = buildService({
      verifiablePresentationAuthRules: [{ ...phoneRule, valueIndex: 0 }],
    });
    const phoneSpec = {
      ...depotOnlySpec,
      depot: { ...depotOnlySpec.depot, authValues: [{ column: 'mobile' }] },
    };

    it('are normalized to E.164 with --default-country before they are looked up', async () => {
      const requests = [];
      mockGetService([phoneService]);
      mockFindDepots(() => [], requests);
      const csvText =
        'employeeId,mobile\nE1,(555) 619-2191\nE2,+61 412 345 678\n';

      const result = await validate(
        writeBatch({ spec: phoneSpec, csvText }),
        '--default-country',
        'us',
      );

      expect(result.exitCode).toEqual(0);
      expect(requests[0].authValues).toEqual([
        ['+15556192191'],
        ['+61412345678'],
      ]);
    });

    it('need a country code or --default-country', async () => {
      mockGetService([phoneService]);
      mockFindDepots();
      const csvText = 'employeeId,mobile\nE1,5556192191\n';

      const { exitCode, report } = await validateJson(
        writeBatch({ spec: phoneSpec, csvText }),
      );

      expect(exitCode).toEqual(1);
      expect(report.errors).toEqual([
        {
          row: 2,
          column: 'mobile',
          reason:
            '"5556192191" is not a phone number. It has no country code, so pass --default-country',
        },
      ]);
    });
  });

  it('sends an email and phone service its tuples in valueIndex order', async () => {
    const requests = [];
    mockGetService([
      buildService({ verifiablePresentationAuthRules: [phoneRule, emailRule] }),
    ]);
    mockFindDepots(() => [], requests);
    const spec = {
      ...depotOnlySpec,
      depot: {
        ...depotOnlySpec.depot,
        authValues: [{ column: 'email' }, { column: 'mobile' }],
      },
    };
    const csvText =
      'employeeId,email,mobile\nE1,adam@example.com,(555) 619-2191\nE2,adam@example.com,555.619.2192\n';

    const result = await validate(
      writeBatch({ spec, csvText }),
      '--default-country',
      'US',
    );

    expect(result.exitCode).toEqual(0);
    expect(requests[0].authValues).toEqual([
      ['adam@example.com', '+15556192191'],
      ['adam@example.com', '+15556192192'],
    ]);
  });

  describe('--var', () => {
    const varCases = [
      {
        name: 'overrides an auth value column, and only the first = separates the name',
        spec: depotOnlySpec,
        args: ['--var', 'email=a=b@example.com'],
        authValues: [['a=b@example.com']],
      },
      {
        name: 'provides a column the CSV lacks',
        spec: withCredential({
          credentialReference: '{{employeeId}}-{{cohort}}',
        }),
        args: ['--var', 'cohort=2026'],
        authValues: [['adam.smith@example.com']],
      },
      {
        name: 'overrides a typed column, which takes its type',
        csvLines: ['E1001,adam.smith@example.com,Adam,Smith,not-a-number'],
        args: ['--var', 'creditsEarned=3'],
        authValues: [['adam.smith@example.com']],
      },
    ];

    for (const {
      name,
      spec,
      csvLines = [ADAM],
      args,
      authValues,
    } of varCases) {
      it(name, async () => {
        const requests = [];
        mockServices({ requests });

        const { exitCode, report } = await validateJson(
          writeBatch({ spec, csvLines }),
          ...args,
        );

        expect({ exitCode, errors: report.errors }).toEqual({
          exitCode: 0,
          errors: [],
        });
        expect(requests[0].authValues).toEqual(authValues);
      });
    }
  });
});
