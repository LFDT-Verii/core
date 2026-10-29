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
const { nanoid } = require('nanoid');
const { anchorVeriiCredentials } = require('@verii/verii-issuing');
const { buildVeriiIssuer } = require('../../credentials');
const { ExchangeStates } = require('../../exchanges');
const {
  retentionExpiresAt,
  startPollingWorker,
} = require('../../notifications');
const { buildAnchoringJobContext } = require('./build-anchoring-context');

// Anchoring jobs share the webhook delivery queue, under their own type.
const ANCHORING_JOB_TYPE = 'credential.anchoring';
const DUPLICATE_KEY_ERROR_CODE = 11000;
const FIRST_RETRY_DELAY_MS = 10 * 1000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;

// Retrying these can't succeed. Index already used needs #1117.
const PERMANENT_ERROR_CODES = new Set([
  'career_issuing_not_permitted',
  'contact_issuing_not_permitted',
  'identity_issuing_not_permitted',
  'tenant_not_found',
]);
const INDEX_ALREADY_USED = /Index already used/;

// The job's id comes from the exchange id, which the wallet sends as the
// notification_id, so a repeated notification can't enqueue a second job.
const enqueueAnchoring = async ({ credential, tenant }, { repos }) => {
  try {
    await repos.notification_events.insertEvents([
      {
        id: `anchoring-${credential.exchange.id}`,
        type: ANCHORING_JOB_TYPE,
        version: 1,
        caoDid: tenant.caoDid,
        credentialId: credential._id,
        exchangeId: credential.exchange.id,
        tenantId: tenant._id,
        credentialMetadata: credential.exchange.credentialMetadata,
      },
    ]);
  } catch (error) {
    if (error.code !== DUPLICATE_KEY_ERROR_CODE) {
      throw error;
    }
  }
};

const startAnchoringWorker = (options, context) =>
  startPollingWorker(
    {
      name: 'Anchoring worker',
      pollIntervalMs: context.config.anchoring.pollIntervalMs,
      processNext: anchorNextCredential,
      workerId:
        options?.workerId ?? `anchoring-worker-${process.pid}-${nanoid(6)}`,
    },
    context,
  );

const anchorNextCredential = async ({ workerId }, context) => {
  const { config, repos } = context;
  const now = new Date();
  const job = await repos.notification_events.claimDueEvent({
    now,
    workerId,
    lockDurationMs: config.anchoring.lockDurationMs,
    types: [ANCHORING_JOB_TYPE],
  });

  if (job == null) {
    return false;
  }

  await anchorClaimedJob(job, now, context);
  return true;
};

// The job is accepted when it's created, so createdAt becomes the credential's
// acceptedAt once it's anchored.
const anchorClaimedJob = async (job, now, context) => {
  const { config, log, repos } = context;
  const { credentialId, credentialMetadata, exchangeId } = job.payload;

  try {
    const jobContext = await buildAnchoringJobContext(job, context);
    await anchorVeriiCredentials(
      [credentialMetadata],
      buildVeriiIssuer(jobContext.tenant),
      jobContext,
    );
    await repos.credentials.addExchangeStateIfCurrent(
      credentialId,
      exchangeId,
      ExchangeStates.COMPLETE,
      { acceptedAt: job.createdAt, 'exchange.acceptedAt': job.createdAt },
    );
    await repos.notification_events.markDelivered({
      eventId: job._id,
      lockedBy: job.lockedBy,
      retentionExpiresAt: retentionExpiresAt(config, now),
    });
  } catch (error) {
    log.warn(
      { err: error, anchoringJobId: job._id, attempts: job.attempts },
      'Credential anchoring failed',
    );
    await markFailedAnchoring(job, error, now, context);
  }
};

const markFailedAnchoring = async (job, error, now, { config, repos }) => {
  const update = {
    eventId: job._id,
    lockedBy: job.lockedBy,
    lastError: omitBy(isNil, {
      message: error.message,
      errorCode: error.errorCode,
    }),
    now,
  };

  if (shouldRetry(error, job, config)) {
    await repos.notification_events.markRetrying({
      ...update,
      nextAttemptAt: nextAttemptAt(now, job.attempts),
    });
    return;
  }

  await repos.notification_events.markDead({
    ...update,
    retentionExpiresAt: retentionExpiresAt(config, now),
  });
  await repos.credentials.addExchangeStateIfCurrent(
    job.payload.credentialId,
    job.payload.exchangeId,
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

module.exports = {
  ANCHORING_JOB_TYPE,
  anchorNextCredential,
  enqueueAnchoring,
  startAnchoringWorker,
};
