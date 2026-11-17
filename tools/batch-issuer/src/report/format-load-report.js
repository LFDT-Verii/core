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
  compact,
  flow,
  isEmpty,
  join,
  map,
  size,
  toPairs,
} = require('lodash/fp');
const { count, formatNumber } = require('./count');
const { describeError } = require('./describe-error');
const { formatErrors } = require('./format-report');

// Such as "2 created, 1 reused, 0 skipped".
const formatCounts = flow(
  toPairs,
  map(([outcome, number]) => `${formatNumber(number)} ${outcome}`),
  join(', '),
);

/**
 * Formats a finished load.
 * @param {{ load: object }} report the load's counts, its shared link, and its output and state files
 * @returns {string} the report
 */
const formatLoadReport = ({ load }) => {
  const lines = compact([
    `Depots: ${formatCounts(load.depots)}.`,
    `Credentials: ${formatCounts(load.credentials)}.`,
    load.resolvedDepots != null &&
      `Deferred credentials resolved: ${count(load.resolvedDepots, 'depot')}.`,
    load.link != null && `Issue link: ${load.link}`,
    `Links: ${load.output}`,
    `State: ${load.state}`,
  ]);
  return `${join('\n', lines)}\n`;
};

// How far the batch got, in this run and the earlier ones.
const formatProgress = ({ summary, load }) => {
  const depots = load.depots.skipped + load.depots.created;
  const newDepots = summary.rows - load.depots.reused;
  const credentials = load.credentials.skipped + load.credentials.created;
  return (
    `The load stopped after creating ${formatNumber(depots)} of ${count(newDepots, 'depot')} ` +
    `and ${formatNumber(credentials)} of ${count(summary.credentials, 'credential')}. ` +
    `${load.state} records what was created. Rerun the same command to continue.`
  );
};

/**
 * Formats a load that stopped: the rows the Hub refused, if any, the error,
 * and how far the load got.
 * @param {{ summary: object, load: object, error: Error }} report
 * @returns {string} the report
 */
const formatLoadFailure = (report) => {
  const { error } = report;
  const lines = [
    ...(error.errors == null ? [] : formatErrors(error.errors)),
    `Error: ${describeError(error)}`,
    formatProgress(report),
  ];
  return `${join('\n', lines)}\n`;
};

/**
 * Formats a load, finished or stopped, as JSON.
 * @param {{ summary: object, load: object, error?: Error }} report
 * @returns {string} `{ valid, errors, summary, load }`, where load has an error when the load stopped
 */
const formatJsonLoadReport = ({ summary, load, error }) => {
  const loadError = error && {
    message: describeError(error),
    errors: error.errors,
  };
  const report = {
    valid: true,
    errors: [],
    summary,
    load: { ...load, error: loadError },
  };
  return `${JSON.stringify(report, null, 2)}\n`;
};

const toNotificationError = ({ row, depotId, error }) => ({
  row,
  reason: join(
    ': ',
    compact([`the wallet message about depot ${depotId} failed`, error]),
  ),
});

/**
 * Formats the wallet messages that failed when a finished load resolved
 * deferred credentials, by row.
 * @param {{ load: { failedNotifications: Array<{ row: number, depotId: string, error?: string }> } }} report
 * @returns {string} the report, or nothing when none failed
 */
const formatFailedNotifications = ({ load }) => {
  const failed = load.failedNotifications;
  if (isEmpty(failed)) {
    return '';
  }
  const lines = [
    ...formatErrors(map(toNotificationError, failed)),
    `Error: the waiting wallets of ${count(size(failed), 'depot')} weren't told that their deferred credentials are ready. ` +
      'Rerun the same command to retry.',
  ];
  return `${join('\n', lines)}\n`;
};

module.exports = {
  formatFailedNotifications,
  formatJsonLoadReport,
  formatLoadFailure,
  formatLoadReport,
};
