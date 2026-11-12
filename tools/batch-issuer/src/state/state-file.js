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
const { readFile, rename, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { isEqual, map } = require('lodash/fp');

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

/**
 * Reads a state file.
 * @param {string} file the state file
 * @returns {Promise<object|undefined>} the state, or undefined when there's no such file
 * @throws when the file can't be read or isn't JSON
 */
const readState = async (file) => {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return undefined;
    }
    throw new Error(`the state file ${file} can't be read: ${error.message}`, {
      cause: error,
    });
  }
};

/**
 * Gives the state of a batch: the one read from its state file, or an empty
 * one when there was none.
 * @param {object} [savedState] the state read from the state file
 * @param {{ tenantId: string, serviceId: string, hash: string }} batch the batch's identity
 * @param {string} file the state file
 * @returns {object} the state
 * @throws when the state file belongs to another batch
 */
const openState = (savedState, batch, file) => {
  if (savedState == null) {
    return {
      batch,
      depots: [],
      credentials: [],
      resolvedDepots: [],
      links: [],
    };
  }
  if (!isEqual(savedState.batch, batch)) {
    throw new Error(
      `the state file ${file} belongs to a different batch: the spec, its templates, the CSV, --var or --default-country ` +
        'have changed since it was written. Rerun the batch it belongs to, or pass another --state',
    );
  }
  return savedState;
};

/**
 * Writes a state file atomically: a temporary file, then a rename, so the
 * file is never half written.
 * @param {string} file the state file
 * @param {object} state the state
 * @returns {Promise<void>}
 */
const writeState = async (file, state) => {
  const tempFile = `${file}.tmp`;
  await writeFile(tempFile, JSON.stringify(state));
  await rename(tempFile, file);
};

/**
 * Gives a function that adds records to one of a state's lists and writes
 * the state file.
 * @param {string} file the state file
 * @returns {(state: object, key: string, records: Array<object>) => Promise<object>} it gives the new state
 */
const addRecords = (file) => async (state, key, records) => {
  const next = { ...state, [key]: [...state[key], ...records] };
  await writeState(file, next);
  return next;
};

module.exports = {
  addRecords,
  identifyBatch,
  openState,
  readState,
  writeState,
};
