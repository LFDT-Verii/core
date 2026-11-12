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
  first,
  flatMap,
  flow,
  groupBy,
  isEmpty,
  isString,
  join,
  map,
  size,
  take,
  uniq,
  values,
  without,
} = require('lodash/fp');
const {
  buildAuthMatchValues,
} = require('@verii/credentialing-hub-operator-api');
const { count, formatNumber } = require('../report/count');

// A reason lists at most this many rows, so every row of a large group of
// duplicates gets a short reason, rather than the numbers of all the others.
const MAX_LISTED_ROWS = 10;

// Auth values are compared as the Hub matches them: normalized with
// buildAuthMatchValues, and compared by type, so "12345" and 12345 differ.
const authValuesKey = flow(buildAuthMatchValues, JSON.stringify);

const duplicateGroups = (keyOf) =>
  flow(
    groupBy(keyOf),
    values,
    filter((group) => size(group) > 1),
  );

// "3, 5", or "3, 4, …, 12 and 49,989 more" when there are more rows than
// listed.
const listRows = (listedRows, rowCount) => {
  const listed = join(', ', listedRows);
  const unlistedCount = rowCount - size(listedRows);
  return unlistedCount > 0
    ? `${listed} and ${formatNumber(unlistedCount)} more`
    : listed;
};

// Describes the other rows of a row's group, such as "2 other rows: 3, 5".
// Only the group's first MAX_LISTED_ROWS + 1 rows are looked at, so each
// row's description takes the same time however large the group is.
const describeOtherRows = (rowNumbers) => {
  const candidates = take(MAX_LISTED_ROWS + 1, rowNumbers);
  const otherCount = size(rowNumbers) - 1;
  return (row) => {
    const listedRows = flow(without([row]), take(MAX_LISTED_ROWS))(candidates);
    const otherRows = listRows(listedRows, otherCount);
    return `${count(otherCount, 'other row')}: ${otherRows}`;
  };
};

const hasAuthValues = ({ authValues }) => !isEmpty(authValues);

/**
 * Finds rows whose auth values are the same once normalized. Each row of a
 * group gets an error that counts the other rows and lists at most 10 of them.
 * @param {Array<{ row: number, authValues?: Array }>} rows the checked rows
 * @param {Array<{ column: string }>} authColumns the auth value columns
 * @returns {Array<{ row: number, column: string, reason: string }>} an error for each row of each group of duplicates
 */
const findDuplicateAuthValues = (rows, authColumns) => {
  const column = join(', ', map('column', authColumns));
  const toErrors = (group) => {
    const describeOthers = describeOtherRows(map('row', group));
    const toError = ({ row }) => ({
      row,
      column,
      reason: `has the same auth values as ${describeOthers(row)}`,
    });
    return map(toError, group);
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

// One reason for the whole group, such as 'credentialReference "E1" is used
// 3 times in the batch, in 2 rows: 2, 3'.
const describeCredentialReferenceGroup = (group) => {
  const { credentialReference } = first(group);
  const rowNumbers = flow(map('row'), uniq)(group);
  const rowCount = size(rowNumbers);
  const listedRows = listRows(take(MAX_LISTED_ROWS, rowNumbers), rowCount);
  const uses = count(size(group), 'time');
  return `credentialReference "${credentialReference}" is used ${uses} in the batch, in ${count(rowCount, 'row')}: ${listedRows}`;
};

/**
 * Finds credentials that share a credentialReference anywhere in the batch.
 * Each credential of a group gets an error that counts the group's uses and
 * rows, and lists at most 10 of the rows.
 * @param {Array<{ row: number, credentials: Array<object> }>} rows the checked rows
 * @returns {Array<{ row: number, template: string, reason: string }>} an error for each credential of each group of duplicates
 */
const findDuplicateCredentialReferences = (rows) => {
  const toErrors = (group) => {
    const reason = describeCredentialReferenceGroup(group);
    return map(({ row, template }) => ({ row, template, reason }), group);
  };
  return flow(
    flatMap(credentialReferencesOf),
    duplicateGroups('credentialReference'),
    flatMap(toErrors),
  )(rows);
};

module.exports = {
  authValuesKey,
  findDuplicateAuthValues,
  findDuplicateCredentialReferences,
};
