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

const { isEmpty } = require('lodash/fp');
const { initHubClient } = require('../clients/hub-client');
const { initRegistrarClient } = require('../clients/registrar-client');
const {
  summarizeBatch,
  validateBatch,
} = require('../validation/validate-batch');
const {
  formatJsonReport,
  formatTextReport,
} = require('../report/format-report');
const { ExitCodes } = require('./exit-codes');

// The registrar is only needed to check credentials.
const initClients = ({ endpoint, authToken, registrar }) => ({
  hub: initHubClient({ endpoint, authToken }),
  registrar: registrar == null ? undefined : initRegistrarClient({ registrar }),
});

/**
 * `batch-issuer validate <spec> <csv>`: validates a batch and prints every
 * error. Nothing is written to the Hub.
 * @param {{ specFile: string, csvFile: string, options: object }} input the files and the command's options
 * @param {{ stdout: Function }} io where the report goes
 * @returns {Promise<number>} the exit code
 */
const runValidate = async ({ specFile, csvFile, options }, io) => {
  const input = {
    specFile,
    csvFile,
    vars: options.var,
    options: { defaultCountry: options.defaultCountry, reuse: options.reuse },
  };
  const { errors, batch } = await validateBatch(input, initClients(options));
  const summary = batch == null ? undefined : summarizeBatch(batch);
  const formatReport = options.json ? formatJsonReport : formatTextReport;
  io.stdout(formatReport({ errors, summary }));
  return isEmpty(errors) ? ExitCodes.OK : ExitCodes.FAILED;
};

module.exports = { runValidate };
