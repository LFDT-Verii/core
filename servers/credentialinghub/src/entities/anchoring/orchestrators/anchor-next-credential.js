/*
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
 *
 */

const { isNil, omitBy } = require('lodash/fp');
const { anchorVeriiCredentialsFacade } = require('../../credentials');
const { ExchangeStates } = require('../../exchanges');
const { buildAnchoringJobContext } = require('./build-anchoring-context');

const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;
const FIRST_RETRY_DELAY_MS = 10 * 1000;

// Retrying these can't succeed. Index already used needs #1117.
const PERMANENT_ERROR_CODES = new Set([
  'career_issuing_not_permitted',
  'contact_issuing_not_permitted',
  'identity_issuing_not_permitted',
  'tenant_not_found',
]);
const INDEX_ALREADY_USED = /Index already used/;

const anchorNextCredential = async ({ workerId }, workerContext) => {
  const { config, repos } = workerContext;
  const now = new Date();
  const job = await repos.anchoring_jobs.claimDueJob({
    now,
    workerId,
    lockDurationMs: config.anchoring.lockDurationMs,
  });

  if (job == null) {
    return false;
  }

  await anchorClaimedJob(job, now, workerContext);
  return true;
};

const anchorClaimedJob = async (job, now, workerContext) => {
  const { log, repos } = workerContext;

  try {
    const jobContext = await buildAnchoringJobContext(job, workerContext);
    await anchorVeriiCredentialsFacade([job.credentialMetadata], jobContext);
    await repos.credentials.addExchangeStateIfCurrent(
      job.credentialId,
      job._id,
      ExchangeStates.COMPLETE,
      { acceptedAt: job.acceptedAt, 'exchange.acceptedAt': job.acceptedAt },
    );
    await repos.anchoring_jobs.markAnchored({
      jobId: job._id,
      lockedBy: job.lockedBy,
    });
  } catch (error) {
    log.warn(
      { err: error, anchoringJobId: job._id, attempts: job.attempts },
      'Credential anchoring failed',
    );
    await markFailedAnchoring(job, error, now, workerContext);
  }
};

const markFailedAnchoring = async (job, error, now, { config, repos }) => {
  const update = {
    jobId: job._id,
    lockedBy: job.lockedBy,
    lastError: omitBy(isNil, {
      message: error.message,
      errorCode: error.errorCode,
    }),
    now,
  };

  if (shouldRetry(error, job, config)) {
    await repos.anchoring_jobs.markRetrying({
      ...update,
      nextAttemptAt: nextAttemptAt(now, job.attempts),
    });
    return;
  }

  await repos.anchoring_jobs.markDead(update);
  await repos.credentials.addExchangeStateIfCurrent(
    job.credentialId,
    job._id,
    ExchangeStates.UNEXPECTED_ERROR,
    omitBy(isNil, {
      'exchange.err': error.message,
      'exchange.errorCode': error.errorCode,
    }),
  );
};

const shouldRetry = (error, job, config) =>
  job.attempts < config.anchoring.maxAttempts && !isPermanentError(error);

const isPermanentError = (error) =>
  PERMANENT_ERROR_CODES.has(error.errorCode) ||
  INDEX_ALREADY_USED.test(error.message ?? '');

const nextAttemptAt = (now, attempts) =>
  new Date(
    now.getTime() +
      Math.min(MAX_RETRY_DELAY_MS, FIRST_RETRY_DELAY_MS * 2 ** (attempts - 1)),
  );

module.exports = { anchorNextCredential };
