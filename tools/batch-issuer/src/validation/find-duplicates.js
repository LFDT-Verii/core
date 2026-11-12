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

const {
  filter,
  flatMap,
  flow,
  groupBy,
  isEmpty,
  isString,
  join,
  map,
  size,
  uniq,
  values,
  without,
} = require('lodash/fp');
const {
  buildAuthMatchValues,
} = require('@verii/credentialing-hub-operator-api');

// Auth values are compared as the Hub matches them: normalized with
// buildAuthMatchValues, and compared by type, so "12345" and 12345 differ.
const authValuesKey = flow(buildAuthMatchValues, JSON.stringify);

const duplicateGroups = (keyOf) =>
  flow(
    groupBy(keyOf),
    values,
    filter((group) => size(group) > 1),
  );

const describeRows = (rowNumbers) =>
  size(rowNumbers) === 1
    ? `row ${rowNumbers[0]}`
    : `rows ${join(', ', rowNumbers)}`;

const hasAuthValues = ({ authValues }) => !isEmpty(authValues);

/**
 * Finds rows whose auth values are the same once normalized.
 * @param {Array<{ row: number, authValues?: Array }>} rows the checked rows
 * @param {Array<{ column: string }>} authColumns the auth value columns
 * @returns {Array<{ row: number, column: string, reason: string }>} an error for each row of each group of duplicates
 */
const findDuplicateAuthValues = (rows, authColumns) => {
  const column = join(', ', map('column', authColumns));
  const toErrors = (group) => {
    const rowNumbers = map('row', group);
    return map(
      ({ row }) => ({
        row,
        column,
        reason: `has the same auth values as ${describeRows(without([row], rowNumbers))}`,
      }),
      group,
    );
  };
  return flow(
    filter(hasAuthValues),
    duplicateGroups(({ authValues }) => authValuesKey(authValues)),
    flatMap(toErrors),
  )(rows);
};

const credentialReferencesOf = ({ row, credentials }) =>
  flow(
    filter(({ credential }) => isString(credential.credentialReference)),
    map(({ template, credential }) => ({
      row,
      template,
      credentialReference: credential.credentialReference,
    })),
  )(credentials);

/**
 * Finds credentials that share a credentialReference anywhere in the batch.
 * @param {Array<{ row: number, credentials: Array<object> }>} rows the checked rows
 * @returns {Array<{ row: number, template: string, reason: string }>} an error for each credential of each group of duplicates
 */
const findDuplicateCredentialReferences = (rows) => {
  const toErrors = (group) => {
    const rowNumbers = flow(map('row'), uniq)(group);
    return map(
      ({ row, template, credentialReference }) => ({
        row,
        template,
        reason: `credentialReference "${credentialReference}" is used ${size(group)} times in the batch, in ${describeRows(rowNumbers)}`,
      }),
      group,
    );
  };
  return flow(
    flatMap(credentialReferencesOf),
    duplicateGroups('credentialReference'),
    flatMap(toErrors),
  )(rows);
};

module.exports = {
  authValuesKey,
  describeRows,
  findDuplicateAuthValues,
  findDuplicateCredentialReferences,
};
