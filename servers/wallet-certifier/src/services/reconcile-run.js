const { classifyDeadline } = require('../domain/deadlines');
const { evaluateVerification } = require('../domain/results');
const { RunStates, TerminalRunStates } = require('../domain/states');
const {
  credentialResult,
  completeRun,
  prepareDisclosure,
} = require('./terminal-result');

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

const completeAcceptedCredential = (run, hubCredential, context) => {
  const credential = credentialResult(hubCredential);
  if (run.capability === 'VERIFICATION') {
    return prepareDisclosure({ run, credential, context });
  }
  return completeRun({
    run,
    state: RunStates.PASSED,
    credential,
    context,
  });
};

const completeFromCredential = (run, hubCredential, context) => {
  const accepted = hubCredential?.acceptedAt && hubCredential.jwtVc;
  if (accepted) {
    return completeAcceptedCredential(run, hubCredential, context);
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

const mapCredentialVerification = (credential) => ({
  format: credential.format,
  json: credential.w3cCredential,
  jwt: credential.credential,
  verified: credential.verified,
  checks: {
    tamper: credential.tamperCheck,
    trustedIssuer: credential.trustedIssuerCheck,
    trustedHolder: credential.trustedHolderCheck,
    revocation: credential.revocationCheck,
    expiry: credential.expiryCheck,
  },
});

const mapPresentationVerification = (verification) => ({
  presentation: {
    verified: verification.verified,
    checks: { tamper: verification.tamperCheck },
  },
  credentials: (verification.credentials ?? []).map(mapCredentialVerification),
});

const latestVerification = (presentation) => presentation.verifications?.at(-1);

const loadPresentationVerification = async (presentation, context) => {
  const existing = latestVerification(presentation);
  if (existing) {
    return existing;
  }
  const response = await context.hubClient.verifyPresentation(presentation.id);
  return response.verification;
};

const completeVerification = async (run, presentation, context) => {
  const verification = await loadPresentationVerification(
    presentation,
    context,
  );
  const result = mapPresentationVerification(verification);
  const evaluation = evaluateVerification({
    presentation: result.presentation,
    setupFingerprint: run.setupCredentialFingerprint,
    credentials: result.credentials,
  });
  const presentationResult = { ...result, ...evaluation };
  return completeRun({
    run,
    state: evaluation.passed ? RunStates.PASSED : RunStates.FAILED,
    evidenceFields: { presentationResult },
    resultSummary: {
      passed: evaluation.passed,
      setupBadgePresent: evaluation.setupBadgePresent,
      presentationVerified: result.presentation.verified,
      credentialCount: result.credentials.length,
    },
    context,
  });
};

const findDisclosedPresentation = async (exchange, run, context) => {
  if (!exchange?.presentationIds?.length) {
    return undefined;
  }
  const presentations = await context.hubClient.getPresentations({
    depotId: run.depotId,
    exchangeId: exchange.id,
  });
  return presentations.at(-1);
};

const finishOrScheduleExchange = async (run, exchange, context) => {
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
  return loadCurrentRun(run.runId, context);
};

const reconcileDisclosure = async (run, context) => {
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
  const presentation = await findDisclosedPresentation(exchange, run, context);
  if (presentation) {
    return completeVerification(run, presentation, context);
  }
  return finishOrScheduleExchange(run, exchange, context);
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

const isDisclosureRun = (run) =>
  run.state === RunStates.DISCLOSING ||
  (run.state === RunStates.FINALIZING && run.interactionPhase === 'DISCLOSING');

const reconcileActiveRun = (run, context) =>
  isDisclosureRun(run)
    ? reconcileDisclosure(run, context)
    : reconcileIssuance(run, context);

const isDue = (run, now) =>
  !TerminalRunStates.has(run.state) &&
  run.nextCheckAt &&
  new Date(run.nextCheckAt) <= new Date(now);

const loadCurrentRun = (runId, context) =>
  context.db.collection('certificationRuns').findOne({ runId });

const reconcileLeased = async (run, context) => {
  try {
    return await reconcileActiveRun(run, context);
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
