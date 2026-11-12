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

const { createHash } = require('node:crypto');
const {
  appendFile,
  readFile,
  truncate,
  writeFile,
} = require('node:fs/promises');
const path = require('node:path');
const {
  flatMap,
  flow,
  getOr,
  isEqual,
  isUndefined,
  join,
  last,
  map,
  replace,
  size,
  split,
  take,
  zipObject,
} = require('lodash/fp');

// The lists of a state. Each line after the batch's adds records to one.
const STATE_LISTS = ['depots', 'credentials', 'resolvedDepots', 'links'];

const mapWithIndex = map.convert({ cap: false });

const toLine = (record) => `${JSON.stringify(record)}\n`;

/**
 * Identifies a batch: its tenant and service, and a hash of everything that
 * decides what a load writes, which is the spec, its templates, the CSV, and
 * the --var and --default-country values.
 * @param {{ specFile: string, csvFile: string, vars: object, options: { defaultCountry?: string } }} input
 * @param {object} spec the batch's spec
 * @returns {Promise<{ tenantId: string, serviceId: string, hash: string }>}
 */
const identifyBatch = async ({ specFile, csvFile, vars, options }, spec) => {
  const templateFiles = map(
    ({ template }) => path.resolve(path.dirname(specFile), template),
    spec.credentials,
  );
  const files = await Promise.all(
    map(
      (file) => readFile(file, 'utf8'),
      [specFile, ...templateFiles, csvFile],
    ),
  );
  const hash = createHash('sha256')
    .update(
      JSON.stringify({ files, vars, defaultCountry: options.defaultCountry }),
    )
    .digest('hex');
  return { tenantId: spec.tenantId, serviceId: spec.serviceId, hash };
};

const readText = async (file) => {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return undefined;
    }
    throw new Error(`the state file ${file} can't be read: ${error.message}`, {
      cause: error,
    });
  }
};

// The last line can be a write that a crash tore. It's ignored, so its record
// counts as not done. Any other line must be JSON.
const parseLine = (file, lineCount) => (line, index) => {
  try {
    return JSON.parse(line);
  } catch (error) {
    if (index === lineCount - 1) {
      return undefined;
    }
    throw new Error(
      `the state file ${file} has a line that isn't JSON: line ${index + 1}`,
      { cause: error },
    );
  }
};

const foldRecords = ([first, ...records]) => {
  const listOf = (key) => flatMap(getOr([], [key]), records);
  return {
    batch: first.batch,
    ...zipObject(STATE_LISTS, map(listOf, STATE_LISTS)),
  };
};

/**
 * Reads a state file, which is JSON Lines: the batch's identity, then a line
 * for each write that the Hub confirmed, such as `{"depots":[{"row":3,"id":"…"}]}`.
 * @param {string} file the state file
 * @returns {Promise<{ state: object, length: number }|undefined>} the state, and the length in bytes of its
 *   whole lines, or undefined when there's no such file or it has no whole line
 * @throws when the file can't be read, or a line other than the last isn't JSON
 */
const readState = async (file) => {
  const text = await readText(file);
  if (text == null) {
    return undefined;
  }
  const lines = flow(replace(/\n$/, ''), split('\n'))(text);
  const records = mapWithIndex(parseLine(file, size(lines)), lines);
  const wholeLines = isUndefined(last(records)) ? size(lines) - 1 : size(lines);
  if (wholeLines === 0) {
    return undefined;
  }
  return {
    state: foldRecords(take(wholeLines, records)),
    length: Buffer.byteLength(join('\n', take(wholeLines, lines))),
  };
};

/**
 * Gives the state of a batch: the one read from its state file, or an empty
 * one when there was none.
 * @param {{ state: object }} [saved] what readState read from the state file
 * @param {{ tenantId: string, serviceId: string, hash: string }} batch the batch's identity
 * @param {string} file the state file
 * @returns {object} the state
 * @throws when the state file belongs to another batch
 */
const openState = (saved, batch, file) => {
  if (saved == null) {
    return {
      batch,
      ...zipObject(
        STATE_LISTS,
        map(() => [], STATE_LISTS),
      ),
    };
  }
  if (!isEqual(saved.state.batch, batch)) {
    throw new Error(
      `the state file ${file} belongs to a different batch: the spec, its templates, the CSV, --var or --default-country ` +
        'have changed since it was written. Rerun the batch it belongs to, or pass another --state',
    );
  }
  return saved.state;
};

/**
 * Gets a state file ready for a load's appends. A new file starts with the
 * batch's line. An existing one keeps its whole lines, which cuts off a line
 * that a crash tore, and ends with a newline.
 * @param {string} file the state file
 * @param {{ length: number }} [saved] what readState read from it
 * @param {object} batch the batch's identity
 * @returns {Promise<void>}
 */
const startState = async (file, saved, batch) => {
  if (saved == null) {
    await writeFile(file, toLine({ batch }));
    return;
  }
  await truncate(file, saved.length);
  await appendFile(file, '\n');
};

/**
 * Gives a function that appends a line of records to a state file.
 * @param {string} file the state file
 * @returns {(key: string, records: Array) => Promise<Array>} it takes one of the state's lists and the
 *   records to add to it, and gives the records
 */
const appendRecords = (file) => async (key, records) => {
  await appendFile(file, toLine({ [key]: records }));
  return records;
};

module.exports = {
  appendRecords,
  identifyBatch,
  openState,
  readState,
  startState,
};
