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

const { readFile } = require('node:fs/promises');
const {
  every,
  filter,
  flatMap,
  isEmpty,
  isNil,
  join,
  map,
  pick,
  reject,
  size,
  sortBy,
  startsWith,
  trim,
} = require('lodash/fp');
const {
  ruleValues,
  selectClaims,
} = require('@verii/credentialing-hub-operator-api');
const { decodeCredentialJwt } = require('@verii/jwt');
const { extractCredentialType } = require('@verii/vc-checks');
const { initHubClient } = require('../clients/hub-client');
const { readSpec } = require('../spec/load-spec');
const { count } = require('../report/count');
const { ExitCodes } = require('./exit-codes');

// A JSON credential is an object. Anything else is a JWT, decoded as the Hub
// decodes a presented credential, so a VC 1.1 JWT's claims are read from the
// credential it carries.
const parseSample = (text) => {
  const trimmed = trim(text);
  return startsWith('{', trimmed)
    ? JSON.parse(trimmed)
    : decodeCredentialJwt(trimmed);
};

const readSample = async (file) => {
  try {
    const credential = parseSample(await readFile(file, 'utf8'));
    return { file, type: extractCredentialType(credential), credential };
  } catch (error) {
    throw new Error(
      `the sample ${file} is not a JSON credential or a JWT: ${error.message}`,
      {
        cause: error,
      },
    );
  }
};

// The Hub's equal rule uses a value only when the credentials give exactly one.
const candidateValues = (rule, values) =>
  rule.rule === 'equal' && size(values) !== 1 ? [] : values;

const pointerSelections = (rule) => (sample) => ({
  file: sample.file,
  pointers: map(
    (pointer) => ({
      pointer,
      selected: selectClaims(pointer, sample.credential),
    }),
    rule.path,
  ),
});

const checkRule = (samples) => (rule) => {
  const values = ruleValues(rule, samples);
  const ruleSamples = filter({ type: rule.type }, samples);
  return {
    rule,
    samples: map(pointerSelections(rule), ruleSamples),
    values,
    candidateValues: candidateValues(rule, values),
  };
};

const describeRule = ({ rule, valueIndex, type, valueType, valueFormat }) => {
  const details = reject(isNil, [type, rule, valueType, valueFormat]);
  return `Rule ${valueIndex}: ${join(', ', details)}`;
};

const formatSample = ({ file, pointers }) => [
  `  ${file}`,
  ...map(
    ({ pointer, selected }) =>
      `    ${JSON.stringify(pointer)} selects ${JSON.stringify(selected)}`,
    pointers,
  ),
];

const formatValues = ({ values, candidateValues: usable }) => {
  const listed = isEmpty(values)
    ? 'none'
    : join(', ', map(JSON.stringify, values));
  const note =
    size(usable) === size(values)
      ? ''
      : ', but equal uses a value only when there is exactly one, so the rule reads nothing';
  return `  values: ${listed}${note}`;
};

const formatRuleResult = (result) => {
  const sampleLines = isEmpty(result.samples)
    ? [`  no sample is a ${result.rule.type}`]
    : flatMap(formatSample, result.samples);
  return [describeRule(result.rule), ...sampleLines, formatValues(result), ''];
};

const readsValue = ({ candidateValues: usable }) => !isEmpty(usable);

const describeSample = ({ file, type }) => `${file} (${type})`;

const formatText = ({ samples, results }) => {
  const sampleList = join(', ', map(describeSample, samples));
  const readingRules = size(filter(readsValue, results));
  const lines = [
    `Samples: ${sampleList}`,
    '',
    ...flatMap(formatRuleResult, results),
    `${readingRules} of ${count(size(results), 'rule')} read a value from the samples.`,
  ];
  return `${join('\n', lines)}\n`;
};

const formatJson = ({ samples, results }) => {
  const report = {
    samples: map(pick(['file', 'type']), samples),
    rules: results,
  };
  return `${JSON.stringify(report, null, 2)}\n`;
};

const loadRules = async (specFile, options) => {
  const { spec, errors } = await readSpec(specFile);
  if (!isEmpty(errors)) {
    throw new Error(join('; ', map('reason', errors)));
  }
  const hub = initHubClient(options);
  const service = await hub.getIssuerService(spec);
  if (service == null) {
    throw new Error(
      `tenant ${spec.tenantId} has no issuer service ${spec.serviceId}`,
    );
  }
  if (isEmpty(service.verifiablePresentationAuthRules)) {
    throw new Error(
      `service ${spec.serviceId} has no verifiablePresentationAuthRules`,
    );
  }
  return sortBy('valueIndex', service.verifiablePresentationAuthRules);
};

/**
 * `batch-issuer check-rules <spec> --sample <credential>`: shows what each of
 * the service's auth rules reads from sample credentials, with the rule
 * evaluation the Hub uses.
 * @param {{ specFile: string, options: object }} input the spec file and the command's options
 * @param {{ stdout: Function }} io where the report goes
 * @returns {Promise<number>} the exit code: OK when every rule reads a value
 */
const runCheckRules = async ({ specFile, options }, io) => {
  const rules = await loadRules(specFile, options);
  const samples = await Promise.all(map(readSample, options.sample));
  const results = map(checkRule(samples), rules);
  const report = { samples, results };
  io.stdout(options.json ? formatJson(report) : formatText(report));
  return every(readsValue, results) ? ExitCodes.OK : ExitCodes.FAILED;
};

module.exports = { runCheckRules };
