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

const { readFile } = require('node:fs/promises');
const { CsvError, parse } = require('csv-parse/sync');
const {
  every,
  filter,
  flow,
  fromPairs,
  isEmpty,
  map,
  size,
  trim,
  zip,
} = require('lodash/fp');

// bom strips a byte order mark, and relax_column_count keeps rows with fewer
// or more cells than the header, which validation reports. Quoting stays
// strict: csv-parse refuses a quote that is never closed, which would
// otherwise take the rest of the file into one cell and lose its rows.
const PARSE_OPTIONS = { bom: true, relax_column_count: true };

const QUOTE_NOT_CLOSED = 'CSV_QUOTE_NOT_CLOSED';

const mapWithIndex = map.convert({ cap: false });

const parseErrorReason = (error) =>
  error.code === QUOTE_NOT_CLOSED
    ? 'opens a quoted cell that is never closed'
    : `can't be parsed: ${error.message}`;

// error.records counts the records before the one that failed, the header and
// blank lines included, so the failed record is row records + 1.
const toParseError = (error) => ({
  row: error.records + 1,
  reason: parseErrorReason(error),
});

const parseRecords = (text) => {
  try {
    return { records: parse(text, PARSE_OPTIONS) };
  } catch (error) {
    if (!(error instanceof CsvError)) {
      throw error;
    }
    return { errors: [toParseError(error)] };
  }
};

const isCellOfColumn = ([column, cell]) => column != null && cell != null;

// The row's cells by column. A row with fewer cells than the header has no
// value for the remaining columns, rather than an empty one, and cells past
// the header's columns are left out.
const toRowData = (headers, cells) =>
  flow(zip(headers), filter(isCellOfColumn), fromPairs)(cells);

// Rows are numbered as a spreadsheet numbers them: the header is row 1.
const toRow = (headers) => (cells, index) => ({
  row: index + 2,
  data: toRowData(headers, cells),
  cells,
});

const hasCells = ({ cells }) => !every(isEmpty, cells);

const withCellCount = ({ cells, ...row }) => ({
  ...row,
  cellCount: size(cells),
});

const toCsv = (records) => {
  const [headerRecord = [], ...dataRecords] = records;
  const headers = map(trim, headerRecord);
  const rows = flow(
    mapWithIndex(toRow(headers)),
    filter(hasCells),
    map(withCellCount),
  )(dataRecords);
  return { headers, rows, errors: [] };
};

/**
 * Loads a CSV file whose first line is the header. A byte order mark is
 * stripped, header names are trimmed, and blank lines are skipped. A file that
 * doesn't parse, such as one with a quote that is never closed, gives an error
 * for the row where parsing failed instead of rows.
 * @param {string} fileName the CSV file
 * @returns {Promise<{ headers?: Array<string>, rows?: Array<{ row: number, data: object, cellCount: number }>,
 *   errors: Array<{ row: number, reason: string }> }>}
 * @throws when the file can't be read
 */
const loadCsv = async (fileName) => {
  const text = await readFile(fileName, 'utf8');
  const { records, errors } = parseRecords(text);
  return errors == null ? toCsv(records) : { errors };
};

module.exports = { loadCsv };
