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

const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const { expect } = require('expect');
const { loadCsv } = require('../src/csv/load-csv');
const { fixturePath, makeTempDir } = require('./helpers/fixtures');

const writeCsv = (content) => {
  const file = path.join(makeTempDir(), 'rows.csv');
  fs.writeFileSync(file, content);
  return file;
};

describe('loadCsv', () => {
  it('loads the header and the rows, numbered as in a spreadsheet', async () => {
    expect(await loadCsv(fixturePath('holders.csv'))).toEqual({
      headers: [
        'employeeId',
        'email',
        'firstName',
        'lastName',
        'creditsEarned',
      ],
      rows: [
        {
          row: 2,
          data: {
            employeeId: 'E1001',
            email: 'adam.smith@example.com',
            firstName: 'Adam',
            lastName: 'Smith',
            creditsEarned: '1.5',
          },
          cellCount: 5,
        },
        {
          row: 3,
          data: {
            employeeId: 'E1002',
            email: 'Beth.Jones@Example.com',
            firstName: 'Beth',
            lastName: 'Jones',
            creditsEarned: '2',
          },
          cellCount: 5,
        },
        {
          row: 4,
          data: {
            employeeId: 'E1003',
            email: 'carl.ng@example.com',
            firstName: 'Carl',
            lastName: 'Ng "CJ"',
            creditsEarned: '0.5',
          },
          cellCount: 5,
        },
      ],
    });
  });

  it('strips a byte order mark and trims header names', async () => {
    const file = writeCsv('\uFEFFemail , name\nadam@example.com,Adam\n');
    expect(await loadCsv(file)).toEqual({
      headers: ['email', 'name'],
      rows: [
        {
          row: 2,
          data: { email: 'adam@example.com', name: 'Adam' },
          cellCount: 2,
        },
      ],
    });
  });

  it('skips blank lines but keeps the row numbers', async () => {
    const file = writeCsv(
      'email,name\n\na@example.com,A\n,\nb@example.com,B\n',
    );
    const { rows } = await loadCsv(file);
    expect(rows).toEqual([
      { row: 3, data: { email: 'a@example.com', name: 'A' }, cellCount: 2 },
      { row: 5, data: { email: 'b@example.com', name: 'B' }, cellCount: 2 },
    ]);
  });

  it('counts a row with a line break in a quoted cell as one row', async () => {
    const file = writeCsv(
      'email,note\na@example.com,"two\nlines"\nb@example.com,x\n',
    );
    const { rows } = await loadCsv(file);
    expect(rows).toEqual([
      {
        row: 2,
        data: { email: 'a@example.com', note: 'two\nlines' },
        cellCount: 2,
      },
      { row: 3, data: { email: 'b@example.com', note: 'x' }, cellCount: 2 },
    ]);
  });

  it('leaves out the cells a short row does not have', async () => {
    const file = writeCsv('email,name,id\na@example.com\n');
    const { rows } = await loadCsv(file);
    expect(rows).toEqual([
      { row: 2, data: { email: 'a@example.com' }, cellCount: 1 },
    ]);
  });

  it('counts the extra cells of a long row', async () => {
    const file = writeCsv('email,name\na@example.com,A,extra\n');
    const { rows } = await loadCsv(file);
    expect(rows).toEqual([
      { row: 2, data: { email: 'a@example.com', name: 'A' }, cellCount: 3 },
    ]);
  });

  it('loads an empty file', async () => {
    expect(await loadCsv(writeCsv(''))).toEqual({ headers: [], rows: [] });
  });

  it('rejects when the file cannot be read', async () => {
    await expect(loadCsv('/does/not/exist.csv')).rejects.toThrow('ENOENT');
  });
});
