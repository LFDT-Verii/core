const { classifyDeadline } = require('../domain/deadlines');
const { RunStates, TerminalRunStates } = require('../domain/states');
const { credentialResult, completeRun } = require('./terminal-result');

const LEASE_IN_MS = 30 * 1000;
const POLL_IN_MS = 3 * 1000;

const failures = Object.freeze({
  credentialRejected: {
    code: 'credential_rejected',
    message: 'The credential was rejected by the wallet user.',
  },
  walletActionTimeout: {
    code: 'wallet_action_timeout',
    message: 'The wallet interaction was not completed within 10 minutes.',
  },
  finalizationTimeout: {
    code: 'finalization_timeout',
    message: 'The wallet interaction did not finalize within 15 minutes.',
  },
});

const leaseRun = (run, context) => {
  const now = new Date(context.now());
  return context.db.collection('certificationRuns').findOneAndUpdate(
    {
      runId: run.runId,
      state: run.state,
      nextCheckAt: { $lte: now },
      $or: [
        { leaseUntil: { $exists: false } },
        { leaseUntil: null },
        { leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        leaseUntil: new Date(now.getTime() + LEASE_IN_MS),
        updatedAt: now,
      },
    },
    { returnDocument: 'after' },
  );
};

const scheduleRun = async (run, state, context) => {
  const now = new Date(context.now());
  const stateChanged = run.state !== state;
  await context.db.collection('certificationRuns').updateOne(
    { runId: run.runId, state: run.state },
    {
      $set: {
        state,
        nextCheckAt: new Date(now.getTime() + POLL_IN_MS),
        leaseUntil: null,
        updatedAt: now,
      },
      $inc: { revision: 1 },
      ...(stateChanged ? { $push: { journal: { state, at: now } } } : {}),
    },
  );
};

const retryRun = async (run, context) => {
  const now = new Date(context.now());
  await context.db.collection('certificationRuns').updateOne(
    { runId: run.runId, state: run.state },
    {
      $set: {
        lastReconcileErrorCode: 'hub_unavailable',
        nextCheckAt: new Date(now.getTime() + POLL_IN_MS),
        leaseUntil: null,
        updatedAt: now,
      },
      $inc: { reconcileFailures: 1, revision: 1 },
    },
  );
};

const timeoutFailure = (run) =>
  run.state === RunStates.FINALIZING
    ? failures.finalizationTimeout
    : failures.walletActionTimeout;

const completeFromCredential = (run, hubCredential, context) => {
  if (hubCredential?.acceptedAt && hubCredential.jwtVc) {
    return completeRun({
      run,
      state: RunStates.PASSED,
      credential: credentialResult(hubCredential),
      context,
    });
  }
  if (hubCredential?.rejectedAt) {
    return completeRun({
      run,
      state: RunStates.REJECTED,
      failure: failures.credentialRejected,
      context,
    });
  }
  return undefined;
};

const reconcileExchange = async (run, context) => {
  const exchange = await context.hubClient.getExchange({
    depotId: run.depotId,
  });
  if (exchange?.error) {
    return completeRun({
      run,
      state: RunStates.ERROR,
      failure: exchange.error,
      context,
    });
  }
  const deadlineState = classifyDeadline(run, exchange, context.now());
  if (deadlineState === RunStates.TIMED_OUT) {
    return completeRun({
      run,
      state: deadlineState,
      failure: timeoutFailure(run),
      context,
    });
  }
  await scheduleRun(run, deadlineState, context);
  return context.db
    .collection('certificationRuns')
    .findOne({ runId: run.runId });
};

const reconcileIssuance = async (run, context) => {
  const hubCredential = await context.hubClient.getCredential(
    run.setupCredentialId,
  );
  const completed = completeFromCredential(run, hubCredential, context);
  return completed ?? reconcileExchange(run, context);
};

const isDue = (run, now) =>
  !TerminalRunStates.has(run.state) &&
  run.nextCheckAt &&
  new Date(run.nextCheckAt) <= new Date(now);

const loadCurrentRun = (runId, context) =>
  context.db.collection('certificationRuns').findOne({ runId });

const reconcileLeased = async (run, context) => {
  try {
    return await reconcileIssuance(run, context);
  } catch (error) {
    if (error.code !== 'HUB_UNAVAILABLE') {
      throw error;
    }
    await retryRun(run, context);
    return loadCurrentRun(run.runId, context);
  }
};

const reconcileRun = async (run, context) => {
  if (!isDue(run, context.now())) {
    return run;
  }
  const leased = await leaseRun(run, context);
  if (!leased) {
    return loadCurrentRun(run.runId, context);
  }
  return reconcileLeased(leased, context);
};

module.exports = { reconcileRun };
