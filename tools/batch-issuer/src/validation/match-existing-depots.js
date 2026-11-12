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
  difference,
  filter,
  flatMap,
  flow,
  fromPairs,
  get,
  getOr,
  groupBy,
  isEmpty,
  join,
  map,
  size,
  uniq,
  uniqBy,
} = require('lodash/fp');
const { authValuesKey } = require('./find-duplicates');

// Rows whose depot didn't render have no userReference to compare.
const isLookedUp = ({ authValues, depot }) =>
  !isEmpty(authValues) && depot != null;

const depotAuthValuesKey = flow(get('authValues'), authValuesKey);

// A returning holder's new credentials must be of types the depot expects,
// when it expects any.
const unexpectedTypes = (row, depot) => {
  if (isEmpty(depot.expectedCredentialTypes)) {
    return [];
  }
  const rowTypes = flow(map('type'), uniq)(row.credentials);
  return difference(rowTypes, depot.expectedCredentialTypes);
};

const checkReturningHolder = (row, depot) => {
  const types = unexpectedTypes(row, depot);
  return isEmpty(types)
    ? { existingDepot: depot, errors: [] }
    : {
        errors: [
          `belong to depot ${depot.id}, which doesn't expect credentials of type ${join(', ', types)}`,
        ],
      };
};

const checkMatch = (row, depots, { reuse }) => {
  if (isEmpty(depots)) {
    return { errors: [] };
  }
  if (size(depots) > 1) {
    return {
      errors: [
        `belong to ${size(depots)} depots: ${join(', ', map('id', depots))}`,
      ],
    };
  }
  const [depot] = depots;
  if (depot.userReference !== row.depot.userReference) {
    return {
      errors: [
        `belong to depot ${depot.id}, whose userReference is "${depot.userReference}"`,
      ],
    };
  }
  if (!reuse) {
    return { errors: [`belong to depot ${depot.id}, and --no-reuse is set`] };
  }
  return checkReturningHolder(row, depot);
};

/**
 * Step 4: finds the depots that already hold the rows' auth values, with
 * POST depots/get, and matches them to the rows by their normalized auth
 * values. A depot whose userReference is the row's is a returning holder's,
 * which the row reuses unless --no-reuse is set. A depot whose userReference
 * differs is always an error.
 * @param {Array<object>} rows the checked rows, from step 2. Only rows with valid auth values and a rendered depot are looked up
 * @param {object} context
 * @param {object} context.spec the spec, for its tenantId and serviceId
 * @param {Array<{ column: string }>} [context.authColumns] the auth value columns, from step 1
 * @param {{ findDepotsByAuthValues: Function }} context.hub the Hub client
 * @param {boolean} context.reuse whether rows may reuse returning holders' depots
 * @returns {Promise<{ existingDepots: object, errors: Array<object> }>} each reused depot by row number, and the errors
 */
const matchExistingDepots = async (rows, { spec, authColumns, hub, reuse }) => {
  const lookedUpRows = filter(isLookedUp, rows);
  if (isEmpty(lookedUpRows)) {
    return { existingDepots: {}, errors: [] };
  }
  const tuples = flow(map('authValues'), uniqBy(authValuesKey))(lookedUpRows);
  const depots = await hub.findDepotsByAuthValues(spec, tuples);
  const depotsByKey = groupBy(depotAuthValuesKey, depots);
  const matchRow = (row) => {
    const rowDepots = getOr([], [authValuesKey(row.authValues)], depotsByKey);
    return { row: row.row, ...checkMatch(row, rowDepots, { reuse }) };
  };
  const matches = map(matchRow, lookedUpRows);
  const existingDepots = flow(
    filter('existingDepot'),
    map(({ row, existingDepot }) => [row, existingDepot]),
    fromPairs,
  )(matches);
  const column = join(', ', map('column', authColumns));
  const toErrors = ({ row, errors: reasons }) =>
    map(
      (reason) => ({ row, column, reason: `the auth values ${reason}` }),
      reasons,
    );
  return { existingDepots, errors: flatMap(toErrors, matches) };
};

module.exports = { matchExistingDepots };
