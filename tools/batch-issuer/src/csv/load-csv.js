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

const { createReadStream } = require('node:fs');
const { pipeline } = require('node:stream');
const csv = require('csv-parser');
const { default: stripBom } = require('strip-bom-stream');
const {
  every,
  filter,
  flow,
  fromPairs,
  isEmpty,
  map,
  noop,
  size,
  trim,
  values,
} = require('lodash/fp');

const mapWithIndex = map.convert({ cap: false });

// csv-parser gives each record as { "0": cell, "1": cell, ... }, so a record
// holds only the cells its line has.
const cellsOf = values;

// The row's cells by column. A row with fewer cells than the header has no
// value for the remaining columns, rather than an empty one.
const toRowData = (headers, cells) => {
  const cellPairs = mapWithIndex(
    (cell, index) => [headers[index], cell],
    cells,
  );
  return flow(
    filter(([column]) => column != null),
    fromPairs,
  )(cellPairs);
};

// Rows are numbered as a spreadsheet numbers them: the header is row 1.
const toRow = (headers) => (record, index) => {
  const cells = cellsOf(record);
  return { row: index + 2, data: toRowData(headers, cells), cells };
};

const hasCells = ({ cells }) => !every(isEmpty, cells);

const withCellCount = ({ cells, ...row }) => ({
  ...row,
  cellCount: size(cells),
});

/**
 * Loads a CSV file whose first line is the header. A byte order mark is
 * stripped, header names are trimmed, and blank lines are skipped.
 * @param {string} fileName the CSV file
 * @returns {Promise<{ headers: Array<string>, rows: Array<{ row: number, data: object, cellCount: number }> }>}
 */
const loadCsv = async (fileName) => {
  // pipeline passes a read error, such as a missing file, on to the parser,
  // whose iteration then rejects with it.
  const parser = pipeline(
    createReadStream(fileName),
    stripBom(),
    csv({ headers: false }),
    noop,
  );
  const records = await Array.fromAsync(parser);
  const [headerRecord = {}, ...dataRecords] = records;
  const headers = flow(cellsOf, map(trim))(headerRecord);
  const rows = flow(
    mapWithIndex(toRow(headers)),
    filter(hasCells),
    map(withCellCount),
  )(dataRecords);
  return { headers, rows };
};

module.exports = { loadCsv };
