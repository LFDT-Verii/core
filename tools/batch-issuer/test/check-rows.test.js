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
const { checkRows } = require('../src/validation/check-rows');
const { baseSpec, emailRule, phoneRule } = require('./helpers/fixtures');

const HEADERS = [
  'employeeId',
  'email',
  'firstName',
  'lastName',
  'creditsEarned',
];

const badgeContent = {
  type: ['OpenBadgeCredential'],
  credentialSubject: {
    name: '{{firstName}} {{lastName}}',
    creditsEarned: '{{creditsEarned}}',
  },
};

const badgeTemplate = {
  template: './badge.json',
  credentialReference: '{{employeeId}}-ivie',
  tags: ['batch-2026-11'],
  content: badgeContent,
  type: 'OpenBadgeCredential',
};

const emailColumns = [{ column: 'email', rule: emailRule }];

const holder = (overrides = {}) => ({
  employeeId: 'E1001',
  email: 'adam@example.com',
  firstName: 'Adam',
  lastName: 'Smith',
  creditsEarned: '1.5',
  ...overrides,
});

const csvOf = (rows, headers = HEADERS) => ({
  headers,
  rows: rows.map((data, index) => ({
    row: index + 2,
    data,
    cellCount: Object.keys(data).length,
  })),
});

const check = ({
  rows = [holder()],
  headers,
  spec = baseSpec,
  templates = [badgeTemplate],
  authColumns = emailColumns,
  vars,
  options = {},
}) =>
  checkRows({
    spec,
    templates,
    authColumns,
    csv: csvOf(rows, headers),
    vars,
    options,
  });

describe('checkRows', () => {
  it("renders each row's depot and credentials", () => {
    expect(check({})).toEqual({
      rows: [
        {
          row: 2,
          depot: {
            userReference: 'E1001',
            authValues: ['adam@example.com'],
            expectedCredentialTypes: ['OpenBadgeCredential'],
            deferredCredentials: false,
          },
          authValues: ['adam@example.com'],
          credentials: [
            {
              template: './badge.json',
              type: 'OpenBadgeCredential',
              credential: {
                credentialReference: 'E1001-ivie',
                content: {
                  type: ['OpenBadgeCredential'],
                  credentialSubject: { name: 'Adam Smith', creditsEarned: 1.5 },
                },
                tags: ['batch-2026-11'],
              },
              errors: [],
            },
          ],
          errors: [],
        },
      ],
      errors: [],
    });
  });

  it('renders userReference, credentialReference and tags as strings', () => {
    const spec = { ...baseSpec, columns: { employeeId: 'number' } };
    const [row] = check({ spec, rows: [holder({ employeeId: '1001' })] }).rows;
    expect(row.depot.userReference).toEqual('1001');
    expect(row.credentials[0].credential.credentialReference).toEqual(
      '1001-ivie',
    );
  });

  it('renders templated tags', () => {
    const templates = [{ ...badgeTemplate, tags: ['cohort-{{lastName}}'] }];
    const [row] = check({ templates }).rows;
    expect(row.credentials[0].credential.tags).toEqual(['cohort-Smith']);
  });

  it('leaves out tags, expectedCredentialTypes and deferredCredentials the spec does not set', () => {
    const spec = {
      ...baseSpec,
      depot: {
        userReference: '{{employeeId}}',
        authValues: [{ column: 'email' }],
      },
    };
    const templates = [{ ...badgeTemplate, tags: undefined }];
    const [row] = check({ spec, templates }).rows;
    expect(row.depot).toEqual({
      userReference: 'E1001',
      authValues: ['adam@example.com'],
    });
    expect(row.credentials[0].credential).not.toHaveProperty('tags');
  });

  it('builds depots without authValues for a service without auth rules', () => {
    const [row] = check({ authColumns: [] }).rows;
    expect(row.authValues).toEqual([]);
    expect(row.depot).not.toHaveProperty('authValues');
  });

  it('does not check auth values when the spec does not fit the service', () => {
    const { rows, errors } = check({
      authColumns: null,
      rows: [holder({ email: 'adam' })],
    });
    expect(errors).toEqual([]);
    expect(rows[0].authValues).toBeUndefined();
    expect(rows[0].depot).not.toHaveProperty('authValues');
  });

  describe('--var', () => {
    it('overrides CSV values of the same name', () => {
      const [row] = check({ vars: { lastName: 'Jones' } }).rows;
      expect(
        row.credentials[0].credential.content.credentialSubject.name,
      ).toEqual('Adam Jones');
    });

    it('provides a column the CSV does not have', () => {
      const templates = [
        { ...badgeTemplate, credentialReference: '{{employeeId}}-{{cohort}}' },
      ];
      const { rows, errors } = check({ templates, vars: { cohort: '2026' } });
      expect(errors).toEqual([]);
      expect(rows[0].credentials[0].credential.credentialReference).toEqual(
        'E1001-2026',
      );
    });

    it('takes the typed column type', () => {
      const [row] = check({ vars: { creditsEarned: '3' } }).rows;
      expect(
        row.credentials[0].credential.content.credentialSubject.creditsEarned,
      ).toEqual(3);
    });
  });

  describe('row errors', () => {
    it('reports every error of a row', () => {
      const rows = [
        holder({ email: 'adam@', creditsEarned: 'one' }),
        {
          employeeId: 'E1002',
          email: 'beth@example.com',
          firstName: 'Beth',
          creditsEarned: '2',
        },
      ];
      expect(check({ rows }).errors).toEqual([
        { row: 2, column: 'email', reason: '"adam@" is not an email address' },
        {
          row: 2,
          column: 'creditsEarned',
          reason: '"one" is not a number',
          template: './badge.json',
        },
        {
          row: 3,
          column: 'lastName',
          reason: 'is missing',
          template: './badge.json',
        },
      ]);
    });

    it('reports a missing or blank auth value', () => {
      const { email, ...withoutEmail } = holder({ employeeId: 'E2' });
      const rows = [holder({ email: ' ' }), withoutEmail];
      expect(email).toEqual('adam@example.com');
      expect(check({ rows }).errors).toEqual([
        { row: 2, column: 'email', reason: 'is blank' },
        { row: 3, column: 'email', reason: 'is missing' },
      ]);
    });

    it('reports a missing userReference column', () => {
      const { employeeId, ...withoutId } = holder({
        email: 'beth@example.com',
      });
      const { rows, errors } = check({ rows: [holder(), withoutId] });
      expect(employeeId).toEqual('E1001');
      expect(errors).toEqual([
        { row: 3, column: 'employeeId', reason: 'is missing' },
        {
          row: 3,
          column: 'employeeId',
          reason: 'is missing',
          template: './badge.json',
        },
      ]);
      expect(rows[1].depot).toBeUndefined();
    });

    it('reports a row with more cells than the header', () => {
      const csv = csvOf([holder()]);
      const { errors } = checkRows({
        spec: baseSpec,
        templates: [badgeTemplate],
        authColumns: emailColumns,
        csv: { ...csv, rows: [{ ...csv.rows[0], cellCount: 7 }] },
        options: {},
      });
      expect(errors).toEqual([
        { row: 2, reason: 'has 7 cells, but the header has 5 columns' },
      ]);
    });

    it('normalizes phone auth values with the default country', () => {
      const spec = {
        ...baseSpec,
        depot: {
          ...baseSpec.depot,
          authValues: [{ column: 'email' }, { column: 'mobile' }],
        },
      };
      const authColumns = [
        ...emailColumns,
        { column: 'mobile', rule: phoneRule },
      ];
      const { rows, errors } = check({
        spec,
        authColumns,
        headers: [...HEADERS, 'mobile'],
        rows: [
          holder({ mobile: '(555) 619-2191' }),
          holder({ employeeId: 'E2', email: 'b@example.com', mobile: '12' }),
        ],
        options: { defaultCountry: 'US' },
      });
      expect(rows[0].depot.authValues).toEqual([
        'adam@example.com',
        '+15556192191',
      ]);
      expect(errors).toEqual([
        { row: 3, column: 'mobile', reason: '"12" is not a phone number' },
      ]);
    });
  });

  describe('the operator API schemas', () => {
    it('reports a depot the Hub would refuse', () => {
      const spec = {
        ...baseSpec,
        depot: {
          ...baseSpec.depot,
          expectedCredentialTypes: [
            'OpenBadgeCredential',
            'OpenBadgeCredential',
          ],
        },
      };
      expect(check({ spec }).errors).toEqual([
        {
          row: 2,
          reason:
            'depot/expectedCredentialTypes must NOT have duplicate items (items ## 1 and 0 are identical)',
        },
      ]);
    });

    it('reports a credential the Hub would refuse', () => {
      const templates = [
        {
          ...badgeTemplate,
          content: { ...badgeContent, type: 'OpenBadgeCredential' },
        },
      ];
      expect(check({ templates }).errors).toEqual([
        {
          row: 2,
          reason: 'credential/content/type must be array',
          template: './badge.json',
        },
      ]);
    });

    it('does not check a credential that did not render', () => {
      const templates = [
        {
          ...badgeTemplate,
          content: {
            type: 'OpenBadgeCredential',
            credentialSubject: '{{nope}}',
          },
        },
      ];
      expect(check({ templates }).errors).toEqual([
        {
          column: 'nope',
          reason: 'is used by the spec, but the CSV has no such column',
        },
      ]);
    });
  });

  describe('batch errors', () => {
    it('reports a CSV without rows', () => {
      expect(check({ rows: [] }).errors).toEqual([
        { reason: 'the CSV has no rows' },
      ]);
    });

    it('reports a column that is in the header more than once', () => {
      expect(check({ headers: [...HEADERS, 'email'] }).errors).toEqual([
        { column: 'email', reason: 'is in the header more than once' },
      ]);
    });

    it("reports a column the CSV doesn't have once, rather than for each row", () => {
      const templates = [
        { ...badgeTemplate, credentialReference: '{{employeeId}}-{{cohort}}' },
      ];
      const rows = [
        holder(),
        holder({ employeeId: 'E2', email: 'b@example.com' }),
      ];
      expect(check({ templates, rows }).errors).toEqual([
        {
          column: 'cohort',
          reason: 'is used by the spec, but the CSV has no such column',
        },
      ]);
    });

    it("reports an auth value column named like an inherited property that the CSV doesn't have", () => {
      const rule = { ...emailRule, type: 'IdV1.0' };
      const authColumns = [{ column: 'constructor', rule }];
      expect(check({ authColumns }).errors).toEqual([
        {
          column: 'constructor',
          reason: 'is used by the spec, but the CSV has no such column',
        },
      ]);
    });

    it("reports an auth value column the CSV doesn't have once", () => {
      const authColumns = [{ column: 'workEmail', rule: emailRule }];
      const rows = [holder(), holder({ employeeId: 'E2' })];
      expect(check({ authColumns, rows }).errors).toEqual([
        {
          column: 'workEmail',
          reason: 'is used by the spec, but the CSV has no such column',
        },
      ]);
    });
  });

  describe('duplicates', () => {
    it('reports rows with the same normalized auth values', () => {
      const rows = [
        holder(),
        holder({ employeeId: 'E2', email: ' ADAM@example.com ' }),
        holder({ employeeId: 'E3', email: 'beth@example.com' }),
        holder({ employeeId: 'E4', email: 'Adam@Example.com' }),
      ];
      expect(check({ rows }).errors).toEqual([
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

    it('compares phone numbers once they are normalized', () => {
      const authColumns = [
        { column: 'mobile', rule: { ...phoneRule, valueIndex: 0 } },
      ];
      const rows = [
        holder({ mobile: '+1 (555) 619-2191' }),
        holder({ employeeId: 'E2', mobile: '555.619.2191' }),
      ];
      expect(
        check({
          authColumns,
          rows,
          headers: [...HEADERS, 'mobile'],
          options: { defaultCountry: 'US' },
        }).errors,
      ).toEqual([
        {
          row: 2,
          column: 'mobile',
          reason: 'has the same auth values as 1 other row: 3',
        },
        {
          row: 3,
          column: 'mobile',
          reason: 'has the same auth values as 1 other row: 2',
        },
      ]);
    });

    it('compares numbers and strings by type', () => {
      const numberRule = {
        ...emailRule,
        type: 'EmployeeIdV1.0',
        valueType: 'number',
      };
      const authColumns = [{ column: 'employeeId', rule: numberRule }];
      const rows = [
        holder({ employeeId: '12345' }),
        holder({ employeeId: '012345' }),
      ];
      const spec = {
        ...baseSpec,
        depot: { ...baseSpec.depot, authValues: [{ column: 'employeeId' }] },
      };
      const templates = [
        { ...badgeTemplate, credentialReference: '{{employeeId}}-{{email}}' },
      ];
      const { errors } = check({ spec, authColumns, rows, templates });
      expect(errors).toEqual([
        {
          row: 2,
          column: 'employeeId',
          reason: 'has the same auth values as 1 other row: 3',
        },
        {
          row: 3,
          column: 'employeeId',
          reason: 'has the same auth values as 1 other row: 2',
        },
      ]);
    });

    it('compares a tuple of auth values as a whole', () => {
      const authColumns = [
        ...emailColumns,
        { column: 'mobile', rule: phoneRule },
      ];
      const rows = [
        holder({ mobile: '+15556192191' }),
        holder({ employeeId: 'E2', mobile: '+15556192192' }),
      ];
      expect(
        check({ authColumns, rows, headers: [...HEADERS, 'mobile'] }).errors,
      ).toEqual([]);
    });

    it('reports a credentialReference used more than once in the batch', () => {
      const templates = [
        { ...badgeTemplate, credentialReference: '{{lastName}}' },
        {
          ...badgeTemplate,
          template: './second.json',
          credentialReference: 'Jones',
        },
      ];
      const rows = [
        holder(),
        holder({ employeeId: 'E2', email: 'b@example.com', lastName: 'Jones' }),
      ];
      const reason =
        'credentialReference "Jones" is used 3 times in the batch, in 2 rows: 2, 3';
      expect(check({ templates, rows }).errors).toEqual([
        { row: 2, template: './second.json', reason },
        { row: 3, template: './badge.json', reason },
        { row: 3, template: './second.json', reason },
      ]);
    });

    describe('in a large group', () => {
      const MAX_REASON_LENGTH = 120;
      const GROUP_SIZE = 5000;
      const holders = (overrides) =>
        Array.from({ length: GROUP_SIZE }, (value, index) =>
          holder({ employeeId: `E${index}`, ...overrides(index) }),
        );

      it('counts the other rows and lists at most 10 of them', () => {
        const rows = holders(() => ({ email: 'same@example.com' }));
        const { errors } = check({ rows, templates: [] });

        expect(errors).toHaveLength(GROUP_SIZE);
        expect(errors[0]).toEqual({
          row: 2,
          column: 'email',
          reason:
            'has the same auth values as 4,999 other rows: 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 and 4,989 more',
        });
        expect(errors[5].reason).toEqual(
          'has the same auth values as 4,999 other rows: 2, 3, 4, 5, 6, 8, 9, 10, 11, 12 and 4,989 more',
        );
        expect(errors[GROUP_SIZE - 1]).toEqual({
          row: GROUP_SIZE + 1,
          column: 'email',
          reason:
            'has the same auth values as 4,999 other rows: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 and 4,989 more',
        });
        for (const { reason } of errors) {
          expect(reason.length).toBeLessThanOrEqual(MAX_REASON_LENGTH);
        }
      });

      it('lists at most 10 rows of a credentialReference', () => {
        const rows = holders((index) => ({
          email: `holder-${index}@example.com`,
        }));
        const templates = [{ ...badgeTemplate, credentialReference: 'same' }];
        const { errors } = check({ rows, templates });

        expect(errors).toHaveLength(GROUP_SIZE);
        const reason =
          'credentialReference "same" is used 5,000 times in the batch, in 5,000 rows: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 and 4,990 more';
        for (const error of errors) {
          expect(error.reason).toEqual(reason);
        }
      });
    });

    it('compares credentialReferences exactly', () => {
      const templates = [
        { ...badgeTemplate, credentialReference: '{{lastName}}' },
      ];
      const rows = [
        holder(),
        holder({ employeeId: 'E2', email: 'b@example.com', lastName: 'SMITH' }),
      ];
      expect(check({ templates, rows }).errors).toEqual([]);
    });
  });
});
