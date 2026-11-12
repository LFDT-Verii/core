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

/**
 * Validates a batch before anything is written: the spec, the spec against
 * the service (step 1), each row against the spec (step 2), each credential
 * against its type's schema (step 3), and the batch against the Hub's
 * depots (step 4). It collects every error. A spec with errors stops it before
 * the CSV is read.
 * @param {object} input
 * @param {string} input.specFile the YAML spec file
 * @param {string} input.csvFile the CSV file
 * @param {object} [input.vars] the --var values, which override CSV values of the same name
 * @param {{ defaultCountry?: string, reuse: boolean }} input.options
 * @param {{ hub: object, registrar?: object }} clients the Hub and registrar clients
 * @returns {Promise<{ errors: Array<{ row?: number, column?: string, template?: string, reason: string }>, batch?: object }>}
 *   the errors, and the validated batch. The batch is ready to load only when there are no errors
 * @throws when a file can't be read, or the Hub or the registrar fails
 */
const validateBatch = async ({ specFile, csvFile, vars, options }, clients) => {
  const { spec, templates, errors: specErrors } = await loadSpec(specFile);
  if (!isEmpty(specErrors)) {
    return { errors: specErrors };
  }
  const csv = await loadCsv(csvFile);
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
    { spec, authColumns, hub: clients.hub, reuse: options.reuse },
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
