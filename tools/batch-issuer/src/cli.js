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

const { Command, InvalidArgumentError, Option } = require('commander');
const { isSupportedCountry } = require('libphonenumber-js');
const { isEmpty, join, split, toUpper } = require('lodash/fp');
const packageJson = require('../package.json');
const { ExitCodes } = require('./commands/exit-codes');
const { runValidate } = require('./commands/validate');
const { runCheckRules } = require('./commands/check-rules');

const AUTH_TOKEN_ENV = 'BATCH_ISSUER_AUTH_TOKEN';

// A value may itself hold "=", so only the first one separates the name.
const parseVar = (text, vars) => {
  const [name, ...valueParts] = split('=', text);
  if (isEmpty(name) || isEmpty(valueParts)) {
    throw new InvalidArgumentError('Use name=value.');
  }
  return { ...vars, [name]: join('=', valueParts) };
};

const parseCountry = (text) => {
  const country = toUpper(text);
  if (!isSupportedCountry(country)) {
    throw new InvalidArgumentError(
      'Use a two-letter country code, such as US.',
    );
  }
  return country;
};

const addHubOptions = (command) =>
  command
    .requiredOption('-e, --endpoint <url>', "the Credentialing Hub's base URL")
    .addOption(
      new Option(
        '-a, --auth-token <token>',
        `an operator API token. Prefer ${AUTH_TOKEN_ENV}, which keeps it out of the shell history`,
      )
        .env(AUTH_TOKEN_ENV)
        .makeOptionMandatory(),
    )
    .option('--json', 'print the report as JSON');

const addValidateCommand = (program, io, resolve) =>
  addHubOptions(
    program
      .command('validate')
      .description(
        'Validate a batch against its spec, the registrar and the Hub. Nothing is written to the Hub.',
      )
      .argument('<spec>', 'the YAML spec file')
      .argument('<csv>', 'the CSV file, with a header line'),
  )
    .option(
      '-r, --registrar <url>',
      "the registrar's base URL, to check credentials against their types' schemas",
    )
    .option(
      '--default-country <code>',
      'the country of phone numbers written without a country code',
      parseCountry,
    )
    .option(
      '--var <name=value>',
      'a value that overrides the CSV column of the same name. Repeatable',
      parseVar,
      {},
    )
    .option(
      '--no-reuse',
      'treat rows whose auth values already belong to a depot as errors',
    )
    .action(async (specFile, csvFile, options) => {
      resolve(await runValidate({ specFile, csvFile, options }, io));
    });

const addCheckRulesCommand = (program, io, resolve) =>
  addHubOptions(
    program
      .command('check-rules')
      .description(
        "Show what the service's auth rules read from sample credentials.",
      )
      .argument('<spec>', 'the YAML spec file, for its tenantId and serviceId'),
  )
    .requiredOption(
      '-s, --sample <credential...>',
      'a credential, as a JSON file or a file holding a JWT',
    )
    .action(async (specFile, options) => {
      resolve(await runCheckRules({ specFile, options }, io));
    });

// Commander throws instead of exiting. Help and the version exit with 0.
const exitCodeOf = (error) =>
  error.exitCode === 0 ? ExitCodes.OK : ExitCodes.ERROR;

/**
 * Runs the batch-issuer command line.
 * @param {Array<string>} argv the arguments, as process.argv gives them
 * @param {{ stdout: Function, stderr: Function }} io where output and errors go
 * @returns {Promise<number>} the exit code
 */
const runCli = (argv, io) =>
  new Promise((resolve) => {
    const program = new Command('batch-issuer')
      .description(
        'Load Credentialing Hub depots and credentials from a CSV file.',
      )
      .version(packageJson.version)
      .exitOverride()
      .configureOutput({ writeOut: io.stdout, writeErr: io.stderr });
    addValidateCommand(program, io, resolve);
    addCheckRulesCommand(program, io, resolve);
    // A command resolves with its exit code before parseAsync settles, so the
    // then only applies to a parse that runs no command.
    program
      .parseAsync(argv)
      .then(() => resolve(ExitCodes.ERROR))
      .catch((error) => resolve(exitCodeOf(error)));
  });

module.exports = { runCli };
