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

const { runCli } = require('../../src/cli');
const { AUTH_TOKEN, HUB_URL, REGISTRAR_URL } = require('./fixtures');

const HUB_ARGS = ['--endpoint', HUB_URL, '--auth-token', AUTH_TOKEN];

// Runs the command line in this process, so nock sees its requests.
const runCapture = async (args) => {
  const output = { stdout: '', stderr: '' };
  const io = {
    stdout: (text) => {
      output.stdout += text;
    },
    stderr: (text) => {
      output.stderr += text;
    },
  };
  const exitCode = await runCli(['node', 'batch-issuer', ...args], io);
  return { exitCode, ...output };
};

// batch-issuer validate with the Hub and the registrar.
const validate = ({ specFile, csvFile }, ...args) =>
  runCapture([
    'validate',
    specFile,
    csvFile,
    ...HUB_ARGS,
    '--registrar',
    REGISTRAR_URL,
    ...args,
  ]);

const validateJson = async (files, ...args) => {
  const result = await validate(files, '--json', ...args);
  return { ...result, report: JSON.parse(result.stdout) };
};

// batch-issuer load with the Hub and the registrar.
const load = ({ specFile, csvFile }, ...args) =>
  runCapture([
    'load',
    specFile,
    csvFile,
    ...HUB_ARGS,
    '--registrar',
    REGISTRAR_URL,
    ...args,
  ]);

const loadJson = async (files, ...args) => {
  const result = await load(files, '--json', ...args);
  return { ...result, report: JSON.parse(result.stdout) };
};

module.exports = {
  HUB_ARGS,
  load,
  loadJson,
  runCapture,
  validate,
  validateJson,
};
