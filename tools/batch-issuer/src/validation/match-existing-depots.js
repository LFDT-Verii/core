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
  has,
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

// The credential types a returning holder's depot will receive: the row's
// credentials' types or, in a depot-only load, the spec's
// expectedCredentialTypes, which a later load adds.
const incomingTypes = (row, { depotOnly, specExpectedTypes }) =>
  depotOnly ? specExpectedTypes : flow(map('type'), uniq)(row.credentials);

// The depot must expect each of them, when it expects any.
const unexpectedTypeErrors = (row, depot, context) => {
  const expectedTypes = depot.expectedCredentialTypes;
  const types = difference(incomingTypes(row, context), expectedTypes);
  return isEmpty(expectedTypes) || isEmpty(types)
    ? []
    : [
        `the auth values belong to depot ${depot.id}, which doesn't expect credentials of type ${join(', ', types)}`,
      ];
};

// A depot-only load adds no credentials, so a returning holder's depot must
// wait for them, as the load's new depots do. A depot's deferredCredentials
// can't be changed, and a depot that doesn't defer would give the holder an
// empty offer.
const undeferredErrors = (depot, { depotOnly }) =>
  depotOnly && depot.deferredCredentials !== true
    ? [
        `the auth values belong to depot ${depot.id}, which doesn't defer credentials, so a depot-only load can't reuse it`,
      ]
    : [];

const checkReturningHolder = (row, depot, context) => {
  const errors = [
    ...unexpectedTypeErrors(row, depot, context),
    ...undeferredErrors(depot, context),
  ];
  return isEmpty(errors) ? { existingDepot: depot, errors } : { errors };
};

const checkMatch = (row, depots, context) => {
  if (isEmpty(depots)) {
    return { errors: [] };
  }
  if (size(depots) > 1) {
    const ids = join(', ', map('id', depots));
    return {
      errors: [`the auth values belong to ${size(depots)} depots: ${ids}`],
    };
  }
  const [depot] = depots;
  if (depot.userReference !== row.depot.userReference) {
    return {
      errors: [
        `the auth values belong to depot ${depot.id}, whose userReference is "${depot.userReference}"`,
      ],
    };
  }
  if (!context.reuse) {
    return {
      errors: [
        `the auth values belong to depot ${depot.id}, and --no-reuse is set`,
      ],
    };
  }
  return checkReturningHolder(row, depot, context);
};

// Step 4: the rows against the depots that already hold their auth values.
const matchExistingDepots = async (rows, { spec, authColumns, hub, reuse }) => {
  const lookedUpRows = filter(isLookedUp, rows);
  if (isEmpty(lookedUpRows)) {
    return { existingDepots: {}, errors: [] };
  }
  const tuples = flow(map('authValues'), uniqBy(authValuesKey))(lookedUpRows);
  const depots = await hub.findDepotsByAuthValues(spec, tuples);
  const depotsByKey = groupBy(depotAuthValuesKey, depots);
  const matchContext = {
    reuse,
    depotOnly: !has('credentials', spec),
    specExpectedTypes: getOr([], ['depot', 'expectedCredentialTypes'], spec),
  };
  const matchRow = (row) => {
    const rowDepots = getOr([], [authValuesKey(row.authValues)], depotsByKey);
    return { row: row.row, ...checkMatch(row, rowDepots, matchContext) };
  };
  const matches = map(matchRow, lookedUpRows);
  const existingDepots = flow(
    filter('existingDepot'),
    map(({ row, existingDepot }) => [row, existingDepot]),
    fromPairs,
  )(matches);
  const column = join(', ', map('column', authColumns));
  const toErrors = ({ row, errors: reasons }) =>
    map((reason) => ({ row, column, reason }), reasons);
  return { existingDepots, errors: flatMap(toErrors, matches) };
};

module.exports = { matchExistingDepots };
