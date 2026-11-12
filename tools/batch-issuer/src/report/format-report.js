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
  flatMap,
  flow,
  groupBy,
  has,
  isEmpty,
  join,
  map,
  partition,
  replace,
  size,
  sortBy,
  toPairs,
} = require('lodash/fp');
const { count } = require('./count');

const NOTHING_WRITTEN = 'Nothing was written to the Hub.';

// Errors without a row first, then by row. The sort is stable, so each row's
// errors keep their order.
const orderErrors = sortBy(({ row }) => row ?? 0);

// A multi-line reason, such as a Handlebars parse error, stays indented.
const indentLines = replace(/\n/g, '\n      ');

const formatError = ({ column, template, reason }) => {
  const columnPrefix = column == null ? '' : `${column}: `;
  const templateSuffix = template == null ? '' : ` (template ${template})`;
  return `  - ${columnPrefix}${indentLines(reason)}${templateSuffix}`;
};

const formatSection = (heading, errors) => [
  heading,
  ...map(formatError, errors),
  '',
];

const formatRowSection = ([row, errors]) =>
  formatSection(`Row ${row}:`, errors);

// Errors without a row, about the spec, the service or the whole CSV, come
// first, then each row's errors in row order.
const formatErrors = (errors) => {
  const [rowErrors, batchErrors] = partition(has('row'), errors);
  const batchSection = isEmpty(batchErrors)
    ? []
    : formatSection('Batch:', batchErrors);
  const rowSections = flow(
    groupBy('row'),
    toPairs,
    sortBy(([row]) => Number(row)),
    flatMap(formatRowSection),
  )(rowErrors);
  return [...batchSection, ...rowSections];
};

const formatSummary = (summary) =>
  join(', ', [
    count(summary.rows, 'row'),
    count(summary.newDepots, 'new depot'),
    count(summary.existingDepots, 'existing depot'),
    count(summary.credentials, 'credential'),
  ]);

/**
 * Formats a validation result as a readable report, grouped by row.
 * @param {{ errors: Array<object>, summary?: object }} result
 * @returns {string} the report
 */
const formatTextReport = ({ errors, summary }) => {
  if (isEmpty(errors)) {
    return `The batch is valid: ${formatSummary(summary)}. ${NOTHING_WRITTEN}\n`;
  }
  const lines = [
    ...formatErrors(errors),
    `The batch is not valid: ${count(size(errors), 'error')}. ${NOTHING_WRITTEN}`,
  ];
  return `${join('\n', lines)}\n`;
};

/**
 * Formats a validation result as JSON.
 * @param {{ errors: Array<object>, summary?: object }} result
 * @returns {string} `{ valid, errors, summary }`, where summary is missing when the spec has errors
 */
const formatJsonReport = ({ errors, summary }) => {
  const report = {
    valid: isEmpty(errors),
    errors: orderErrors(errors),
    summary,
  };
  return `${JSON.stringify(report, null, 2)}\n`;
};

module.exports = { formatJsonReport, formatTextReport };
