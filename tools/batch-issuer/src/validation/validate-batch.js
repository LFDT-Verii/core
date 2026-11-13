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
  get,
  isEmpty,
  map,
  pick,
  size,
} = require('lodash/fp');
const { loadSpec } = require('../spec/load-spec');
const { loadCsv } = require('../csv/load-csv');
const { checkService } = require('./check-service');
const { checkRows } = require('./check-rows');
const { checkCredentialSubjects } = require('./check-credential-subjects');
const { matchExistingDepots } = require('./match-existing-depots');

// What a load needs of each row: the depot to create, or the returning
// holder's depot to reuse, and the credentials.
const toBatchRow = (existingDepots) => (row) => ({
  row: row.row,
  depot: row.depot,
  authValues: row.authValues,
  existingDepot: get([row.row], existingDepots),
  credentials: map(pick(['template', 'type', 'credential']), row.credentials),
});

// Validates a batch as the README's steps describe, collecting every error.
const validateBatch = async ({ specFile, csvFile, vars, options }, clients) => {
  const { spec, templates, errors: specErrors } = await loadSpec(specFile);
  if (!isEmpty(specErrors)) {
    return { errors: specErrors };
  }
  const csv = await loadCsv(csvFile);
  if (!isEmpty(csv.errors)) {
    return { errors: csv.errors };
  }
  const service = await clients.hub.getIssuerService(spec);
  const { authColumns, errors: serviceErrors } = checkService({
    spec,
    templates,
    service,
  });
  const { rows, errors: rowErrors } = checkRows({
    spec,
    templates,
    authColumns,
    csv,
    vars,
    options,
  });
  const subjectErrors = await checkCredentialSubjects(
    rows,
    templates,
    clients.registrar,
  );
  const { existingDepots, errors: depotErrors } = await matchExistingDepots(
    rows,
    {
      spec,
      authColumns,
      hub: clients.hub,
      reuse: options.reuse,
      createdDepotIds: options.createdDepotIds,
    },
  );
  const batchRows = map(toBatchRow(existingDepots), rows);
  return {
    errors: [...serviceErrors, ...rowErrors, ...subjectErrors, ...depotErrors],
    batch: { spec, service, templates, rows: batchRows },
  };
};

/**
 * Counts what a load of a batch would create and reuse.
 * @param {{ rows: Array<object> }} batch the validated batch
 * @returns {{ rows: number, newDepots: number, existingDepots: number, credentials: number }}
 */
const summarizeBatch = ({ rows }) => {
  const existingDepots = flow(filter('existingDepot'), size)(rows);
  return {
    rows: size(rows),
    newDepots: size(rows) - existingDepots,
    existingDepots,
    credentials: flow(flatMap('credentials'), size)(rows),
  };
};

module.exports = { summarizeBatch, validateBatch };
