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

const { writeFile } = require('node:fs/promises');
const path = require('node:path');
const { stringify } = require('csv-stringify/sync');
const { isEmpty, map, pick } = require('lodash/fp');
const { initHubClient } = require('../clients/hub-client');
const { initRegistrarClient } = require('../clients/registrar-client');
const {
  summarizeBatch,
  validateBatch,
} = require('../validation/validate-batch');
const {
  PRIVATE_FILE_MODE,
  identifyBatch,
  openState,
  readState,
} = require('../state/state-file');
const { listLinks, loadBatch, summarizeLoad } = require('../load/load-batch');
const {
  formatJsonReport,
  formatSummary,
  formatTextReport,
} = require('../report/format-report');
const {
  formatJsonLoadReport,
  formatLoadFailure,
  formatLoadReport,
} = require('../report/format-load-report');
const { ExitCodes } = require('./exit-codes');

const LINK_COLUMNS = ['row', 'userReference', 'redirectUrl'];

// The registrar is only needed to check credentials.
const initClients = ({ endpoint, authToken, registrar }) => ({
  hub: initHubClient({ endpoint, authToken }),
  registrar: registrar == null ? undefined : initRegistrarClient({ registrar }),
});

// holders.csv gives holders.state.jsonl, in the same directory.
const besideCsv = (csvFile, extension) => {
  const { dir, name } = path.parse(csvFile);
  return path.join(dir, `${name}${extension}`);
};

// Validates the batch, with the depots its state file records as its own,
// and opens the state, which must belong to the batch.
const validate = async (input, clients, stateFile) => {
  const saved = await readState(stateFile);
  const createdDepotIds = new Set(map('id', saved?.state.depots));
  const { errors, batch } = await validateBatch(
    { ...input, options: { ...input.options, createdDepotIds } },
    clients,
  );
  if (batch == null) {
    return { errors };
  }
  const batchId = await identifyBatch(input, batch.spec);
  const state = openState(saved, batchId, stateFile);
  return { errors, batch, saved, state, summary: summarizeBatch(batch) };
};

const reportValidation = ({ errors, summary }, options, io) => {
  const formatReport = options.json ? formatJsonReport : formatTextReport;
  io.stdout(formatReport({ errors, summary }));
  return isEmpty(errors) ? ExitCodes.OK : ExitCodes.FAILED;
};

// A load that stops reports what the state file holds then.
const load = async (
  { batch, summary, saved, state, files, hub, options },
  io,
) => {
  const report = (final, extras) => ({
    summary,
    load: {
      ...summarizeLoad(batch.rows, state, final, options),
      ...extras,
      state: files.state,
    },
  });
  try {
    const loaded = await loadBatch(batch, {
      hub,
      state,
      saved,
      stateFile: files.state,
      resolveDeferred: options.resolveDeferred,
    });
    const links = listLinks(batch.rows, loaded.state, loaded.sharedLink);
    await writeFile(
      files.output,
      stringify(links, { header: true, columns: LINK_COLUMNS }),
      { mode: PRIVATE_FILE_MODE },
    );
    const done = report(loaded.state, {
      link: loaded.sharedLink,
      output: files.output,
    });
    io.stdout(
      options.json ? formatJsonLoadReport(done) : formatLoadReport(done),
    );
    return ExitCodes.OK;
  } catch (error) {
    const final = (await readState(files.state))?.state ?? state;
    const stopped = { ...report(final), error };
    if (options.json) {
      io.stdout(formatJsonLoadReport(stopped));
    } else {
      io.stderr(formatLoadFailure(stopped));
    }
    return ExitCodes.ERROR;
  }
};

/**
 * `batch-issuer load <spec> <csv>`: validates a batch and, when it's valid,
 * loads it into the Hub. With `dryrun`, it stops after validating, which is
 * `batch-issuer validate`.
 * @param {{ specFile: string, csvFile: string, options: object }} input the files and the command's options
 * @param {{ stdout: Function, stderr: Function }} io where the reports go
 * @returns {Promise<number>} the exit code
 */
const runLoad = async ({ specFile, csvFile, options }, io) => {
  const files = {
    state: options.state ?? besideCsv(csvFile, '.state.jsonl'),
    output: options.output ?? besideCsv(csvFile, '.links.csv'),
  };
  const clients = initClients(options);
  const input = {
    specFile,
    csvFile,
    vars: options.var,
    options: pick(['defaultCountry', 'reuse'], options),
  };
  const validation = await validate(input, clients, files.state);
  if (!isEmpty(validation.errors) || options.dryrun) {
    return reportValidation(validation, options, io);
  }
  if (!options.json) {
    io.stdout(`The batch is valid: ${formatSummary(validation.summary)}.\n`);
  }
  return load({ ...validation, files, hub: clients.hub, options }, io);
};

module.exports = { runLoad };
